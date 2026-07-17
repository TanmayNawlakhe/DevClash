"""Tree-sitter AST extractors: functions, call sites, imports, and chunking.

Provides:
    * ``extract_functions`` — function/class definitions per file.
    * ``extract_call_edges`` — intra-file caller→callee call sites (call graph).
    * ``extract_import_specifiers`` — JS/TS/TSX import specifiers from the AST.
    * ``chunk_file`` — function-boundary chunks used by ``embedding_service``.

Supported languages: Python, JavaScript, TypeScript (+ TSX), Go, Rust, C, C++.

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
    "tsx":        "tree_sitter_typescript",
    "go":         "tree_sitter_go",
    "rust":       "tree_sitter_rust",
    "c":          "tree_sitter_c",
    "cpp":        "tree_sitter_cpp",
    "html":       "tree_sitter_html",
    "css":        "tree_sitter_css",
}

# Most grammar packages expose ``language()``. The TypeScript package is the
# exception — it ships two grammars under ``language_typescript()`` /
# ``language_tsx()`` and has no bare ``language()``.
_LANG_CAPSULE_ATTR: dict[str, str] = {
    "typescript": "language_typescript",
    "tsx":        "language_tsx",
}


def _language_capsule(mod: Any, lang: str) -> Any:
    """Return the grammar capsule, tolerant of the TypeScript package's API."""
    attr = _LANG_CAPSULE_ATTR.get(lang, "language")
    fn = getattr(mod, attr, None) or getattr(mod, "language", None)
    if fn is None:
        raise ImportError(f"{mod.__name__} exposes no language function for {lang!r}")
    return fn()


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
        language = tree_sitter.Language(_language_capsule(mod, lang))
        parser   = tree_sitter.Parser(language)
        _PARSER_CACHE[lang] = parser

    return _PARSER_CACHE[lang]


# ── Extension → language name ──────────────────────────────────────────────────
_EXT_TO_LANG: dict[str, str] = {
    ".py":  "python",
    ".js":  "javascript",
    ".jsx": "javascript",
    ".ts":  "typescript",
    ".tsx": "tsx",
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


# ── Walker dispatch ────────────────────────────────────────────────────────────

_WALKERS = {
    "python":     _walk_python,
    "javascript": _walk_js_ts,
    "typescript": _walk_js_ts,
    "tsx":        _walk_js_ts,
    "go":         _walk_go,
    "rust":       _walk_rust,
    "c":          _walk_c_cpp,
    "cpp":        _walk_c_cpp,
}


def _walk(root: Any, lines: list[str], lang: str) -> list[dict]:
    walker = _WALKERS.get(lang)
    return walker(root, lines) if walker else []


# ── Call-site extraction (for the call graph) ───────────────────────────────────

# Tree-sitter call-ish node types across the supported grammars.
_CALL_NODE_TYPES = {"call", "call_expression", "macro_invocation", "new_expression"}

# Identifier leaf types whose text is the callee name.
_IDENT_TYPES = {"identifier", "type_identifier", "field_identifier", "property_identifier"}


def _last_identifier(node: Any) -> str | None:
    """Resolve a callee expression to its final name.

    ``foo`` -> foo, ``obj.method`` -> method, ``pkg.Type`` -> Type,
    ``a::b::c`` -> c. Returns None if no identifier can be found.
    """
    if node is None:
        return None
    if node.type in _IDENT_TYPES:
        return _text(node)
    # Prefer the "property/field/name/attribute" side of a member access.
    for field in ("property", "field", "name", "attribute", "constructor"):
        child = node.child_by_field_name(field)
        if child is not None:
            resolved = _last_identifier(child)
            if resolved:
                return resolved
    # Fallback: deepest-right named identifier (handles scoped paths).
    for child in reversed(node.named_children):
        resolved = _last_identifier(child)
        if resolved:
            return resolved
    return None


def _callee_name(call_node: Any) -> str | None:
    fn = (
        call_node.child_by_field_name("function")
        or call_node.child_by_field_name("constructor")
        or call_node.child_by_field_name("macro")
    )
    if fn is None:
        fn = call_node.named_children[0] if call_node.named_children else None
    return _last_identifier(fn)


def _start_row(node: Any) -> int:
    sp = node.start_point
    return (sp.row if hasattr(sp, "row") else sp[0])


def _collect_calls(root: Any) -> list[tuple[str, int]]:
    """Every call site in the tree as (callee_name, 1-indexed line)."""
    calls: list[tuple[str, int]] = []

    def recurse(node: Any) -> None:
        if node.type in _CALL_NODE_TYPES:
            name = _callee_name(node)
            if name:
                calls.append((name, _start_row(node) + 1))
        for child in node.children:
            recurse(child)

    recurse(root)
    return calls


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
        return _walk(tree.root_node, lines, lang)
    except Exception as exc:
        _log.warning("[tree-sitter] extract_functions(%s) error: %s", lang, exc, exc_info=True)
    return []


def extract_call_edges(source: str, lang: str) -> list[dict]:
    """Intra-file caller→callee call sites, resolved to enclosing functions.

    Each entry: {caller, caller_line, callee, line}. ``caller`` is the name of
    the innermost function/class the call sits inside, or ``"<module>"`` for
    top-level calls. ``callee`` is the called identifier's name — *not* yet
    resolved to a definition; cross-file resolution happens in repo_analyzer
    where the whole-repo function index is available.
    """
    try:
        parser = _get_parser(lang)
        tree = parser.parse(source.encode("utf-8", errors="replace"))
        lines = source.splitlines()
        funcs = _walk(tree.root_node, lines, lang)
        calls = _collect_calls(tree.root_node)

        edges: list[dict] = []
        for callee, cline in calls:
            # Innermost enclosing function = smallest span that contains the call.
            enclosing: dict | None = None
            for f in funcs:
                start = f["line"]
                end = f["line"] + f["line_count"] - 1
                if start <= cline <= end and (
                    enclosing is None or f["line_count"] < enclosing["line_count"]
                ):
                    enclosing = f
            edges.append({
                "caller":      enclosing["name"] if enclosing else "<module>",
                "caller_line": enclosing["line"] if enclosing else 0,
                "callee":      callee,
                "line":        cline,
            })
        return edges
    except Exception as exc:
        _log.warning("[tree-sitter] extract_call_edges(%s) error: %s", lang, exc, exc_info=True)
    return []


def extract_call_edges_from_file(file_path: "Path", rel_path: str) -> list[dict]:  # type: ignore[name-defined]
    """Read a file from disk and return its intra-file call sites."""
    lang = lang_from_path(rel_path)
    if lang is None:
        return []
    try:
        from pathlib import Path
        source = Path(file_path).read_text(encoding="utf-8", errors="ignore")
    except Exception as exc:
        _log.warning("[tree-sitter] Cannot read %s: %s", file_path, exc)
        return []
    return extract_call_edges(source, lang)


# ── Import-specifier extraction (JS / TS / TSX) ─────────────────────────────────

def _string_literal_value(node: Any) -> str | None:
    """Inner text of a string / template-string node, minus the quotes."""
    if node is None or node.type not in ("string", "template_string"):
        return None
    for child in node.named_children:
        if child.type in ("string_fragment", "template_string_fragment"):
            return _text(child)
    # Fallback: strip surrounding quotes / backticks.
    txt = _text(node)
    if len(txt) >= 2 and txt[0] in "\"'`" and txt[-1] == txt[0]:
        return txt[1:-1]
    return txt.strip("\"'`") or None


def extract_import_specifiers(source: str, lang: str) -> list[str]:
    """Module specifiers imported by a JS/TS/TSX file, from the AST.

    Covers every real dependency form and — unlike line-based regex — ignores
    specifiers that only *look* like imports inside comments or string
    literals, and correctly handles multi-line import statements:

        import x from './y'            → ./y
        import './y'                   → ./y   (side-effect)
        import type { T } from './y'   → ./y   (TS)
        export { a } from './y'        → ./y   (re-export)
        export * from './y'            → ./y
        const z = require('./y')       → ./y   (CommonJS)
        const m = await import('./y')  → ./y   (dynamic)

    Returns the raw specifier strings; the caller resolves them to repo files.
    """
    if lang not in ("javascript", "typescript", "tsx"):
        return []
    try:
        parser = _get_parser(lang)
        tree = parser.parse(source.encode("utf-8", errors="replace"))
    except Exception as exc:
        _log.warning("[tree-sitter] extract_import_specifiers(%s) error: %s", lang, exc, exc_info=True)
        return []

    specs: list[str] = []

    def _add(node: Any) -> None:
        value = _string_literal_value(node)
        if value:
            specs.append(value)

    def recurse(node: Any) -> None:
        t = node.type
        if t in ("import_statement", "export_statement"):
            _add(node.child_by_field_name("source"))
        elif t == "call_expression":
            fn = node.child_by_field_name("function")
            args = node.child_by_field_name("arguments")
            # require('...') or dynamic import('...')
            if fn is not None and args is not None and (
                fn.type == "import" or _text(fn) in ("require", "import")
            ):
                for arg in args.named_children:
                    if arg.type in ("string", "template_string"):
                        _add(arg)
                        break
        for child in node.children:
            recurse(child)

    recurse(tree.root_node)
    return specs


# ── Include / asset-reference extraction (C/C++, HTML, CSS) ─────────────────────

def _strip_delims(text: str) -> str:
    """Strip surrounding quotes or angle brackets from an attribute/include."""
    text = text.strip()
    if len(text) >= 2 and (
        (text[0] in "\"'" and text[-1] == text[0]) or (text[0] == "<" and text[-1] == ">")
    ):
        return text[1:-1]
    return text


def _first_descendant(node: Any, type_name: str) -> Any:
    """Depth-first search for the first descendant of a given node type."""
    for child in node.named_children:
        if child.type == type_name:
            return child
        found = _first_descendant(child, type_name)
        if found is not None:
            return found
    return None


_HTML_REF_TAGS = {"script", "link", "img", "source", "video", "audio", "iframe"}
_HTML_REF_ATTRS = {"src", "href"}


def extract_static_refs(source: str, lang: str) -> list[str]:
    """Dependency references for non-JS languages, from the AST.

    * ``c`` / ``cpp`` — ``#include "…"`` and ``#include <…>`` paths.
    * ``html``        — ``src`` / ``href`` on script/link/img/source/video/audio/iframe.
    * ``css``         — ``@import`` targets and quoted ``url("…")`` references.

    Like the JS import extractor, this ignores refs inside comments and is
    robust to multi-line tags/rules. Caller resolves refs to repo files.

    Known limitation: the CSS grammar cannot parse *unquoted* ``url(x)`` (it
    produces error nodes), so bare-url asset refs are skipped; ``@import`` and
    quoted ``url("x")`` are captured. Import edges — the meaningful CSS
    dependency — are unaffected.
    """
    if lang not in ("c", "cpp", "html", "css"):
        return []
    try:
        parser = _get_parser(lang)
        tree = parser.parse(source.encode("utf-8", errors="replace"))
    except Exception as exc:
        _log.warning("[tree-sitter] extract_static_refs(%s) error: %s", lang, exc, exc_info=True)
        return []

    refs: list[str] = []

    def _tag_name(open_node: Any) -> str:
        tn = next((c for c in open_node.named_children if c.type == "tag_name"), None)
        return _text(tn).lower() if tn else ""

    def recurse(node: Any) -> None:
        t = node.type
        if lang in ("c", "cpp") and t == "preproc_include":
            for child in node.named_children:
                if child.type == "string_literal":
                    frag = _first_descendant(child, "string_content")
                    refs.append(_text(frag) if frag else _strip_delims(_text(child)))
                elif child.type == "system_lib_string":
                    refs.append(_strip_delims(_text(child)))
        elif lang == "html" and t in ("start_tag", "self_closing_tag"):
            if _tag_name(node) in _HTML_REF_TAGS:
                for child in node.named_children:
                    if child.type != "attribute":
                        continue
                    name = next((c for c in child.named_children if c.type == "attribute_name"), None)
                    val = next((c for c in child.named_children
                                if c.type in ("quoted_attribute_value", "attribute_value")), None)
                    if name and val and _text(name).lower() in _HTML_REF_ATTRS:
                        refs.append(_strip_delims(_text(val)))
        elif lang == "css" and t == "import_statement":
            frag = _first_descendant(node, "string_content")
            if frag:
                refs.append(_text(frag))
        elif lang == "css" and t == "call_expression":
            fn = next((c for c in node.named_children if c.type == "function_name"), None)
            if fn and _text(fn).lower() == "url":
                frag = _first_descendant(node, "string_content")
                if frag:
                    refs.append(_text(frag))
        for child in node.children:
            recurse(child)

    recurse(tree.root_node)
    return refs


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
