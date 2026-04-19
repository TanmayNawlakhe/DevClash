from pathlib import Path

from app.services.repo_analyzer import (
    _collect_source_files,
    _build_go_directory_index,
    _build_python_module_index,
    _build_rust_module_index,
    _extract_c_cpp_targets,
    _extract_css_targets,
    _extract_go_targets,
    _extract_html_targets,
    _extract_js_ts_targets,
    _extract_python_targets,
    _extract_rust_targets,
)


def _fixtures_root() -> Path:
    return Path(__file__).parent / "fixtures"


def test_python_import_extraction() -> None:
    root = _fixtures_root() / "python"
    files = [
        "pkg/__init__.py",
        "pkg/a.py",
        "pkg/b.py",
        "pkg/c.py",
        "pkg/d.py",
    ]
    module_index, path_to_module = _build_python_module_index(files)
    targets = _extract_python_targets(
        file_path=root / "pkg" / "a.py",
        source_rel_path="pkg/a.py",
        module_index=module_index,
        path_to_module=path_to_module,
    )

    assert {"pkg/b.py", "pkg/c.py", "pkg/d.py"}.issubset(targets)


def test_js_ts_import_extraction() -> None:
    root = _fixtures_root() / "js"
    files = {
        "src/main.ts",
        "src/util.ts",
        "src/side.ts",
        "src/reexport.ts",
        "src/lib/helper.ts",
        "src/lazy/mod.ts",
    }
    targets = _extract_js_ts_targets(
        file_path=root / "src" / "main.ts",
        source_rel_path="src/main.ts",
        all_files=files,
    )

    assert targets == {
        "src/util.ts",
        "src/side.ts",
        "src/reexport.ts",
        "src/lib/helper.ts",
        "src/lazy/mod.ts",
    }


def test_c_cpp_include_extraction() -> None:
    root = _fixtures_root() / "cpp"
    files = {
        "src/main.cpp",
        "src/util.h",
        "internal/config.h",
    }
    targets = _extract_c_cpp_targets(
        file_path=root / "src" / "main.cpp",
        source_rel_path="src/main.cpp",
        all_files=files,
    )

    assert targets == {"src/util.h", "internal/config.h"}


def test_go_import_extraction() -> None:
    root = _fixtures_root() / "go"
    files = [
        "cmd/main.go",
        "internal/core/core.go",
        "pkg/util/util.go",
    ]
    by_dir = _build_go_directory_index(files)
    targets = _extract_go_targets(
        file_path=root / "cmd" / "main.go",
        source_rel_path="cmd/main.go",
        go_files_by_dir=by_dir,
        go_module_name="example.com/acme",
    )

    assert targets == {"internal/core/core.go", "pkg/util/util.go"}


def test_rust_use_and_mod_extraction() -> None:
    root = _fixtures_root() / "rust"
    files = [
        "src/main.rs",
        "src/util.rs",
        "src/services/api.rs",
    ]
    rust_index, rust_path_to_module = _build_rust_module_index(files)
    targets = _extract_rust_targets(
        file_path=root / "src" / "main.rs",
        source_rel_path="src/main.rs",
        all_files=set(files),
        rust_module_index=rust_index,
        rust_path_to_module=rust_path_to_module,
    )

    assert targets == {"src/util.rs", "src/services/api.rs"}


def test_html_asset_extraction() -> None:
    root = _fixtures_root() / "html"
    files = {
        "web/index.html",
        "web/app.js",
        "web/styles/site.css",
        "assets/logo.png",
    }
    targets = _extract_html_targets(
        file_path=root / "web" / "index.html",
        source_rel_path="web/index.html",
        all_files=files,
    )

    assert targets == {"web/app.js", "web/styles/site.css", "assets/logo.png"}


def test_css_reference_extraction() -> None:
    root = _fixtures_root() / "css"
    files = {
        "web/styles/site.css",
        "web/styles/base.css",
        "web/assets/bg.png",
    }
    targets = _extract_css_targets(
        file_path=root / "web" / "styles" / "site.css",
        source_rel_path="web/styles/site.css",
        all_files=files,
    )

    assert targets == {"web/styles/base.css", "web/assets/bg.png"}


def test_collect_source_files_includes_config_and_skips_readme(tmp_path: Path) -> None:
    (tmp_path / "src").mkdir(parents=True, exist_ok=True)
    (tmp_path / "src" / "main.ts").write_text("export const ok = true", encoding="utf-8")
    (tmp_path / "package.json").write_text('{"name":"demo"}', encoding="utf-8")
    (tmp_path / "docker-compose.yml").write_text("services: {}", encoding="utf-8")
    (tmp_path / "Dockerfile").write_text("FROM node:20", encoding="utf-8")
    (tmp_path / ".env.example").write_text("API_URL=https://example.com", encoding="utf-8")
    (tmp_path / "README.md").write_text("# ignored", encoding="utf-8")
    (tmp_path / "notes.txt").write_text("ignored", encoding="utf-8")

    files = _collect_source_files(tmp_path)

    assert "src/main.ts" in files
    assert "package.json" in files
    assert "docker-compose.yml" in files
    assert "Dockerfile" in files
    assert ".env.example" in files
    assert "README.md" not in files
    assert "notes.txt" not in files
