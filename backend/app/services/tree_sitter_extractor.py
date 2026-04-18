"""Tree-sitter function/class extractor and semantic code chunker.

Replaces all regex-based extraction in ``repo_analyzer.py``.
Also provides ``chunk_file()`` used by ``embedding_service.py`` for CodeBERT.

Supported languages: Python, JavaScript, TypeScript, Go, Rust, C, C++.

Each extracted function dict has:
    name        (str)          identifier
    type        (str)          function | async_function | class | method |
                               arrow_function | struct | enum | trait | impl
    line        (int)          1-indexed start line
    line_count  (int)          number of lines in the body
    params      (list[str])    parameter names (simplified, no types)
    returns     (str | None)   return type annotation if detectable
    body        (str)          raw source text of the definition
"""
from __future__ import annotations

import logging
from pathlib import PurePosixPath
from typing import Any

_log = logging.getLogger(__name__)

# ── Parser cache ─────────────────────────────────────────────────────────────
_PARSER_CACHE: dict[str, Any] = {}

# Per-language package mapping (new tree-sitter >=0.24 API)
_LANG_MODULE: dict[str, str] = {
    "python":     "tree_sitter_python",
    "javascript": "tree_sitter_javascript",
    "typescript": "tree_sitter_typescript",
    "go":         "tree_sitter_go",
    "rust":       "tree_sitter_rust",
    "c":          "tree_sitter_c",
    "cpp":        "tree_sitter_cpp",
}


def _get_parser(lang: str) -> Any:
    """Return a cached tree_sitter.Parser for the given language.

    Uses the new per-language packages (tree-sitter-python, etc.) which
    support Python 3.14, instead of the legacy tree_sitter_languages bundle
    (which was capped at Python <3.12).
    """
    if lang not in _PARSER_CACHE:
        import importlib
        import tree_sitter

        mod_name = _LANG_MODULE.get(lang)
        if mod_name is None:
            raise ImportError(f"No tree-sitter package for language: {lang!r}")

        mod = importlib.import_module(mod_name)

        # tree-sitter >= 0.24: Language(capsule) + Parser(language)
        language = tree_sitter.Language(mod.language())
        parser   = tree_sitter.Parser(language)
        _PARSER_CACHE[lang] = parser

    return _PARSER_CACHE[lang]


# ── Extension → language name ──────────────────────────────────────────────────
_EXT_TO_LANG: dict[str, str] = {
    ".py":  "python",
    ".js":  "javascript",
    ".jsx": "javascript",
    ".ts":  "typescript",
    ".tsx": "typescript",
    ".go":  "go",
    ".rs":  "rust",
    ".c":   "c",
    ".h":   "c",
    ".cpp": "cpp",
    ".cc":  "cpp",
    ".cxx": "cpp",
    ".hpp": "cpp",
}


def lang_from_path(rel_path: str) -> str | None:
    return _EXT_TO_LANG.get(PurePosixPath(rel_path).suffix.lower())


# ── Generic helpers ────────────────────────────────────────────────────────────

def _text(node: Any) -> str:
    return node.text.decode("utf-8", errors="replace") if node else ""


def _is_async(node: Any) -> bool:
    return any(c.type == "async" for c in node.children)


def _body_lines(node: Any, source_lines: list[str]) -> tuple[int, int, str]:
    """Returns (1-indexed start, line_count, body_text).

    Handles both old tuple-style (row, col) and new Point namedtuple.
    """
    sp = node.start_point
    ep = node.end_point
    # tree-sitter >= 0.24 returns Point(row, column); older returns (row, col)
    s = sp.row if hasattr(sp, "row") else sp[0]
    e = ep.row if hasattr(ep, "row") else ep[0]
    body = "\n".join(source_lines[s:e + 1])
    return s + 1, e - s + 1, body


# ── Parameter extraction ───────────────────────────────────────────────────────

def _py_params(func_node: Any) -> tuple[list[str], str | None]:
    """Python function_definition → (param_names, return_annotation)."""
    params: list[str] = []
    pnode = func_node.child_by_field_name("parameters")
    SKIP = {"self", "cls"}
    if pnode:
        for ch in pnode.named_children:
            t = ch.type
            if t == "identifier":
                n = _text(ch)
                if n not in SKIP:
                    params.append(n)
            elif t in ("typed_parameter", "default_parameter", "typed_default_parameter"):
                name_ch = ch.child_by_field_name("name") or (
                    ch.named_children[0] if ch.named_children else None
                )
                if name_ch and name_ch.type == "identifier":
                    n = _text(name_ch)
                    if n not in SKIP:
                        params.append(n)
            elif t == "list_splat_pattern":
                inner = next((c for c in ch.named_children if c.type == "identifier"), None)
                if inner:
                    params.append(f"*{_text(inner)}")
            elif t == "dictionary_splat_pattern":
                inner = next((c for c in ch.named_children if c.type == "identifier"), None)
                if inner:
                    params.append(f"**{_text(inner)}")

    returns: str | None = None
    ret = func_node.child_by_field_name("return_type")
    if ret and ret.named_children:
        returns = _text(ret.named_children[-1])
    return params, returns


def _formal_params(pnode: Any) -> list[str]:
    """JS/TS formal_parameters | Go parameter_list → param names."""
    if pnode is None:
        return []
    params: list[str] = []
    for ch in pnode.named_children:
        t = ch.type
        if t == "identifier":
            params.append(_text(ch))
        elif t in ("required_parameter", "optional_parameter"):
            pat = ch.child_by_field_name("pattern")
            if pat:
                params.append(_text(pat))
        elif t == "rest_pattern":
            inner = next((c for c in ch.named_children if c.type == "identifier"), None)
            if inner:
                params.append(f"...{_text(inner)}")
        elif t == "assignment_pattern":
            left = ch.child_by_field_name("left")
            if left and left.type == "identifier":
                params.append(_text(left))
        elif t == "parameter_declaration":          # Go: name… type
            names = [c for c in ch.named_children if c.type == "identifier"]
            params.extend(_text(n) for n in names[:-1])   # last is type
        elif t == "variadic_parameter_declaration":  # Go: ...T
            names = [c for c in ch.named_children if c.type == "identifier"]
            if names:
                params.append(f"...{_text(names[0])}")
    return params


def _rust_params(func_node: Any) -> tuple[list[str], str | None]:
    params: list[str] = []
    pnode = func_node.child_by_field_name("parameters")
    if pnode:
        for ch in pnode.named_children:
            if ch.type == "self_parameter":
                continue
            if ch.type == "parameter":
                pat = ch.child_by_field_name("pattern")
                if pat:
                    params.append(_text(pat))
            elif ch.type == "variadic_parameter":
                params.append("...")
    returns: str | None = None
    ret = func_node.child_by_field_name("return_type")
    if ret:
        returns = _text(ret).lstrip("->").strip()
    return params, returns


def _go_return(func_node: Any) -> str | None:
    ret = func_node.child_by_field_name("result")
    return _text(ret) if ret else None


def _ts_return(func_node: Any) -> str | None:
    ret = func_node.child_by_field_name("return_type")
    return _text(ret).lstrip(":").strip() if ret else None


# ── Language walkers ───────────────────────────────────────────────────────────

def _walk_python(root: Any, source_lines: list[str]) -> list[dict]:
    results: list[dict] = []

    def recurse(node: Any) -> None:
        t = node.type
        if t in ("function_definition", "async_function_definition"):
            name_node = node.child_by_field_name("name")
            name = _text(name_node) if name_node else "<anonymous>"
            kind = "async_function" if t == "async_function_definition" else "function"
            params, returns = _py_params(node)
            line, lc, body = _body_lines(node, source_lines)
            results.append(dict(name=name, type=kind, line=line, line_count=lc,
                                params=params, returns=returns, body=body))
            for ch in node.children:
                recurse(ch)

        elif t == "class_definition":
            name_node = node.child_by_field_name("name")
            name = _text(name_node) if name_node else "<anonymous>"
            line, lc, body = _body_lines(node, source_lines)
            results.append(dict(name=name, type="class", line=line, line_count=lc,
                                params=[], returns=None, body=body))
            for ch in node.children:
                recurse(ch)

        elif t == "decorated_definition":
            # Use decorator's start point but inner node's metadata
            deco_start = node.start_point[0]
            deco_end = node.end_point[0]
            before_len = len(results)
            for ch in node.children:
                if ch.type in ("function_definition", "async_function_definition",
                               "class_definition"):
                    recurse(ch)
            # Patch start/line_count to include the decorator
            if len(results) > before_len:
                results[before_len]["line"] = deco_start + 1
                results[before_len]["line_count"] = deco_end - deco_start + 1
                results[before_len]["body"] = "\n".join(
                    source_lines[deco_start:deco_end + 1]
                )
        else:
            for ch in node.children:
                recurse(ch)

    recurse(root)
    results.sort(key=lambda x: x["line"])
    return results


def _walk_js_ts(root: Any, source_lines: list[str]) -> list[dict]:
    results: list[dict] = []

    def _arrow_or_fn_entry(name: str, fn_node: Any, container_node: Any) -> None:
        """Add a result entry for an arrow function / function-expression."""
        pnode = fn_node.child_by_field_name("parameters") or \
                fn_node.child_by_field_name("parameter")
        params = _formal_params(pnode)
        kind = "async_function" if _is_async(fn_node) else \
               ("arrow_function" if fn_node.type == "arrow_function" else "function")
        line, lc, body = _body_lines(container_node, source_lines)
        results.append(dict(name=name, type=kind, line=line, line_count=lc,
                            params=params, returns=None, body=body))

    def recurse(node: Any) -> None:
        t = node.type

        if t in ("function_declaration", "generator_function_declaration",
                 "function_expression"):
            name_node = node.child_by_field_name("name")
            name = _text(name_node) if name_node else "<anonymous>"
            params = _formal_params(node.child_by_field_name("parameters"))
            returns = _ts_return(node)
            kind = "async_function" if _is_async(node) else "function"
            line, lc, body = _body_lines(node, source_lines)
            results.append(dict(name=name, type=kind, line=line, line_count=lc,
                                params=params, returns=returns, body=body))
            # recurse to find nested functions
            for ch in node.children:
                recurse(ch)
            return  # prevent outer loop from double-recursing

        if t == "class_declaration":
            name_node = node.child_by_field_name("name")
            name = _text(name_node) if name_node else "<anonymous>"
            line, lc, body = _body_lines(node, source_lines)
            results.append(dict(name=name, type="class", line=line, line_count=lc,
                                params=[], returns=None, body=body))
            for ch in node.children:
                recurse(ch)
            return

        if t == "method_definition":
            name_node = node.child_by_field_name("name")
            name = _text(name_node) if name_node else "<anonymous>"
            params = _formal_params(node.child_by_field_name("parameters"))
            returns = _ts_return(node)
            kind = "async_function" if _is_async(node) else "method"
            line, lc, body = _body_lines(node, source_lines)
            results.append(dict(name=name, type=kind, line=line, line_count=lc,
                                params=params, returns=returns, body=body))
            return  # don't recurse into method bodies for top-level scan

        if t == "variable_declarator":
            # const/let name = () => {}  |  const name = function() {}
            value = node.child_by_field_name("value")
            if value and value.type in ("arrow_function", "function",
                                        "function_expression"):
                name_node = node.child_by_field_name("name")
                _arrow_or_fn_entry(
                    _text(name_node) if name_node else "<anonymous>",
                    value, node,
                )
                for ch in value.children:
                    recurse(ch)
                return

        if t == "assignment_expression":
            # exports.foo = async (req, res) => {}
            # module.exports.foo = function() {}
            right = node.child_by_field_name("right")
            if right and right.type in ("arrow_function", "function",
                                        "function_expression"):
                left = node.child_by_field_name("left")
                name = "<anonymous>"
                if left:
                    if left.type == "identifier":
                        name = _text(left)
                    elif left.type == "member_expression":
                        # exports.createEvent  → use the property name
                        prop = left.child_by_field_name("property")
                        if prop:
                            name = _text(prop)
                _arrow_or_fn_entry(name, right, node)
                for ch in right.children:
                    recurse(ch)
                return

        # Default: keep walking
        for ch in node.children:
            recurse(ch)

    recurse(root)
    results.sort(key=lambda x: x["line"])
    return results


def _walk_go(root: Any, source_lines: list[str]) -> list[dict]:
    results: list[dict] = []

    def recurse(node: Any) -> None:
        if node.type in ("function_declaration", "method_declaration"):
            name_node = node.child_by_field_name("name")
            name = _text(name_node) if name_node else "<anonymous>"
            params = _formal_params(node.child_by_field_name("parameters"))
            returns = _go_return(node)
            line, lc, body = _body_lines(node, source_lines)
            results.append(dict(name=name, type="function", line=line, line_count=lc,
                                params=params, returns=returns, body=body))
            for ch in node.children:
                recurse(ch)
        else:
            for ch in node.children:
                recurse(ch)

    recurse(root)
    results.sort(key=lambda x: x["line"])
    return results


_RUST_TYPE_MAP = {
    "function_item": "function",
    "struct_item":   "struct",
    "enum_item":     "enum",
    "trait_item":    "trait",
    "impl_item":     "impl",
}


def _walk_rust(root: Any, source_lines: list[str]) -> list[dict]:
    results: list[dict] = []

    def recurse(node: Any) -> None:
        t = node.type
        if t in _RUST_TYPE_MAP:
            name_node = node.child_by_field_name("name")
            name = _text(name_node) if name_node else "<anonymous>"
            kind = _RUST_TYPE_MAP[t]
            params: list[str] = []
            returns: str | None = None
            if t == "function_item":
                params, returns = _rust_params(node)
                if _is_async(node):
                    kind = "async_function"
            line, lc, body = _body_lines(node, source_lines)
            results.append(dict(name=name, type=kind, line=line, line_count=lc,
                                params=params, returns=returns, body=body))
            for ch in node.children:
                recurse(ch)
        else:
            for ch in node.children:
                recurse(ch)

    recurse(root)
    results.sort(key=lambda x: x["line"])
    return results


def _walk_c_cpp(root: Any, source_lines: list[str]) -> list[dict]:
    results: list[dict] = []

    def recurse(node: Any) -> None:
        t = node.type
        if t == "function_definition":
            # Name lives inside the declarator chain
            name = "<anonymous>"
            params: list[str] = []
            decl = node.child_by_field_name("declarator")
            # Unwrap pointer/reference declarators to reach function_declarator
            while decl and decl.type not in ("function_declarator", "identifier"):
                inner = next((c for c in decl.children
                              if c.is_named and c.type != "type_qualifier"), None)
                decl = inner
            if decl and decl.type == "function_declarator":
                name_node = decl.child_by_field_name("declarator")
                if name_node:
                    name = _text(name_node)
                pnode = decl.child_by_field_name("parameters")
                if pnode:
                    for ch in pnode.named_children:
                        if ch.type == "parameter_declaration":
                            for c in ch.named_children:
                                if c.type == "identifier":
                                    params.append(_text(c))
                                    break
            line, lc, body = _body_lines(node, source_lines)
            results.append(dict(name=name, type="function", line=line, line_count=lc,
                                params=params, returns=None, body=body))
            for ch in node.children:
                recurse(ch)

        elif t in ("class_specifier", "struct_specifier"):
            name_node = node.child_by_field_name("name")
            name = _text(name_node) if name_node else "<anonymous>"
            kind = "class" if t == "class_specifier" else "struct"
            line, lc, body = _body_lines(node, source_lines)
            results.append(dict(name=name, type=kind, line=line, line_count=lc,
                                params=[], returns=None, body=body))
            for ch in node.children:
                recurse(ch)
        else:
            for ch in node.children:
                recurse(ch)

    recurse(root)
    results.sort(key=lambda x: x["line"])
    return results


# ── Public API ─────────────────────────────────────────────────────────────────

def extract_functions(source: str, lang: str) -> list[dict]:
    """Parse source and return all function/class definitions.

    Each entry: {name, type, line, line_count, params, returns, body}.
    ``body`` is the raw source text of the definition (used for chunking).
    """
    try:
        parser = _get_parser(lang)
        tree = parser.parse(source.encode("utf-8", errors="replace"))
        lines = source.splitlines()

        if lang == "python":
            return _walk_python(tree.root_node, lines)
        if lang in ("javascript", "typescript"):
            return _walk_js_ts(tree.root_node, lines)
        if lang == "go":
            return _walk_go(tree.root_node, lines)
        if lang == "rust":
            return _walk_rust(tree.root_node, lines)
        if lang in ("c", "cpp"):
            return _walk_c_cpp(tree.root_node, lines)
    except Exception as exc:
        _log.warning("[tree-sitter] extract_functions(%s) error: %s", lang, exc, exc_info=True)
    return []


def extract_functions_from_file(file_path: "Path", rel_path: str) -> list[dict]:  # type: ignore[name-defined]
    """Read file from disk and extract function/class info.

    Returns the same structure as ``extract_functions()`` minus the ``body``
    key (body is stripped to keep node.data lean in MongoDB).
    """
    lang = lang_from_path(rel_path)
    if lang is None:
        return []
    try:
        from pathlib import Path
        source = Path(file_path).read_text(encoding="utf-8", errors="ignore")
    except Exception as exc:
        _log.warning("[tree-sitter] Cannot read %s: %s", file_path, exc)
        return []

    funcs = extract_functions(source, lang)
    _log.debug("[tree-sitter] %s (%s) → %d functions", rel_path, lang, len(funcs))
    # Strip body from the metadata dict — it's large and only needed for chunking
    for f in funcs:
        f.pop("body", None)
    return funcs


def chunk_file(source: str, lang: str) -> list[str]:
    """Split source into semantically meaningful chunks for CodeBERT.

    Strategy:
    1.  Extract all top-level function/class bodies (tree-sitter).
        "Top-level" = not fully contained within another extracted definition.
    2.  "File header" = lines before the first top-level definition
        (imports, module docstring, constants).
    3.  Each chunk is a complete function/class body — never mid-definition.
    4.  Returns a list of source-text strings.  The caller (embedding_service)
        is responsible for further sub-chunking if a body exceeds 512 tokens.
    """
    funcs = extract_functions(source, lang)
    if not funcs:
        return [source] if source.strip() else []

    # Keep only top-level defs (not fully contained inside another)
    top: list[dict] = []
    for f in funcs:
        f_end = f["line"] + f["line_count"] - 1
        contained = any(
            t["line"] <= f["line"] and (t["line"] + t["line_count"] - 1) >= f_end
            for t in top
        )
        if not contained:
            top.append(f)

    source_lines = source.splitlines()
    chunks: list[str] = []

    # Header chunk (imports / module-level code)
    first_line = top[0]["line"] - 1  # 0-indexed
    if first_line > 0:
        header = "\n".join(source_lines[:first_line])
        if header.strip():
            chunks.append(header)

    # Function / class body chunks
    for f in top:
        body = f.get("body", "")
        if body.strip():
            chunks.append(body)

    return chunks if chunks else [source]
