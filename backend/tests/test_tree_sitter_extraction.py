"""AST extraction tests across languages.

Skipped automatically if a grammar package isn't installed, so the suite still
runs in a minimal environment.
"""
import pytest

from app.services.tree_sitter_extractor import extract_call_edges, extract_functions

# (lang, source, expected function names, expected callee among calls)
CASES = [
    ("python",     "def a():\n    return b()\ndef b():\n    return 1\n",           {"a", "b"}, "b"),
    ("javascript", "function a(){ return b(); }\nfunction b(){ return 1; }\n",     {"a", "b"}, "b"),
    ("typescript", "function a(): number { return b(); }\nfunction b(): number { return 1; }\n", {"a", "b"}, "b"),
    ("tsx",        "const A = () => b();\nfunction b(){ return 1; }\n",            {"A", "b"}, "b"),
    ("go",         "package m\nfunc a() int { return b() }\nfunc b() int { return 1 }\n", {"a", "b"}, "b"),
    ("rust",       "fn a() -> i32 { b() }\nfn b() -> i32 { 1 }\n",                 {"a", "b"}, "b"),
    ("c",          "int b(){ return 1; }\nint a(){ return b(); }\n",              {"a", "b"}, "b"),
    ("cpp",        "int b(){ return 1; }\nint a(){ return b(); }\n",              {"a", "b"}, "b"),
]

_GRAMMAR_PKG = {
    "python": "tree_sitter_python", "javascript": "tree_sitter_javascript",
    "typescript": "tree_sitter_typescript", "tsx": "tree_sitter_typescript",
    "go": "tree_sitter_go", "rust": "tree_sitter_rust",
    "c": "tree_sitter_c", "cpp": "tree_sitter_cpp",
}


@pytest.mark.parametrize("lang,src,expected_funcs,expected_callee", CASES)
def test_extract_functions_and_calls(lang, src, expected_funcs, expected_callee):
    pytest.importorskip(_GRAMMAR_PKG[lang], reason=f"{lang} grammar not installed")

    funcs = extract_functions(src, lang)
    names = {f["name"] for f in funcs}
    assert expected_funcs <= names, f"{lang}: missing functions, got {names}"

    calls = extract_call_edges(src, lang)
    callees = {c["callee"] for c in calls}
    assert expected_callee in callees, f"{lang}: expected call to {expected_callee}, got {callees}"

    # Every call must be attributed to a real enclosing function or <module>.
    for c in calls:
        assert c["caller"] in names or c["caller"] == "<module>"


def test_typescript_grammar_loads():
    """Regression: the TS package uses language_typescript(), not language()."""
    pytest.importorskip("tree_sitter_typescript")
    funcs = extract_functions("function greet(): void { console.log('hi'); }\n", "typescript")
    assert any(f["name"] == "greet" for f in funcs)


def test_import_specifiers_ast_beats_regex():
    """AST import extraction: gets multi-line imports, ignores comments/strings."""
    pytest.importorskip("tree_sitter_typescript")
    from app.services.tree_sitter_extractor import extract_import_specifiers

    src = (
        "// import Fake from './commented-out'\n"
        "import Real from './real';\n"
        "import {\n  A,\n  B,\n} from './multiline';\n"
        "import './side-effect';\n"
        "import type { T } from './types';\n"
        "export { x } from './reexport';\n"
        "export * from './star';\n"
        "const d = await import('./dynamic');\n"
        "const c = require('./cjs');\n"
        "const s = \"import Fake from './in-a-string'\";\n"
    )
    got = set(extract_import_specifiers(src, "typescript"))

    assert {"./real", "./multiline", "./side-effect", "./types",
            "./reexport", "./star", "./dynamic", "./cjs"} <= got
    # No phantom edges from the comment or the string literal.
    assert not any("commented-out" in s or "in-a-string" in s for s in got)


def test_import_specifiers_only_js_ts():
    from app.services.tree_sitter_extractor import extract_import_specifiers
    # Non-JS/TS languages return nothing (their imports are handled elsewhere).
    assert extract_import_specifiers("import os\n", "python") == []


def test_c_includes_ast():
    pytest.importorskip("tree_sitter_c")
    from app.services.tree_sitter_extractor import extract_static_refs
    src = ('// #include "commented.h"\n#include <stdio.h>\n#include "local/foo.h"\n'
           'const char* s = "#include \\"in_string.h\\"";\n')
    refs = set(extract_static_refs(src, "c"))
    assert {"stdio.h", "local/foo.h"} <= refs
    assert not any("commented" in r or "in_string" in r for r in refs)


def test_html_refs_ast_multiline_tag():
    pytest.importorskip("tree_sitter_html")
    from app.services.tree_sitter_extractor import extract_static_refs
    src = ('<!-- <script src="./commented.js"></script> -->\n'
           '<script\n  type="module"\n  src="./app.js"\n></script>\n'
           '<link rel="stylesheet" href="./style.css">\n<img src="./logo.png"/>\n')
    refs = set(extract_static_refs(src, "html"))
    assert {"./app.js", "./style.css", "./logo.png"} <= refs   # incl. multi-line tag
    assert "./commented.js" not in refs


def test_css_refs_ast():
    pytest.importorskip("tree_sitter_css")
    from app.services.tree_sitter_extractor import extract_static_refs
    src = ('/* @import "./commented.css"; */\n@import "./base.css";\n'
           '@import url("./theme.css");\nbody { background: url("./bg.png"); }\n')
    refs = set(extract_static_refs(src, "css"))
    assert {"./base.css", "./theme.css", "./bg.png"} <= refs
    assert "./commented.css" not in refs


def test_static_refs_only_supported_langs():
    from app.services.tree_sitter_extractor import extract_static_refs
    assert extract_static_refs("import os\n", "python") == []
