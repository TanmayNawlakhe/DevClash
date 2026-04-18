import ast
import asyncio
import os
import posixpath
import re
import shutil
import subprocess
from collections.abc import Awaitable, Callable
from pathlib import Path, PurePosixPath
from uuid import uuid4

PYTHON_EXTENSIONS = (".py",)
JS_TS_EXTENSIONS = (".js", ".jsx", ".ts", ".tsx")
C_CPP_EXTENSIONS = (".c", ".cc", ".cpp", ".cxx", ".h", ".hh", ".hpp", ".hxx")
GO_EXTENSIONS = (".go",)
RUST_EXTENSIONS = (".rs",)
HTML_EXTENSIONS = (".html", ".htm")
CSS_EXTENSIONS = (".css",)
SUPPORTED_EXTENSIONS = (
    *PYTHON_EXTENSIONS,
    *JS_TS_EXTENSIONS,
    *C_CPP_EXTENSIONS,
    *GO_EXTENSIONS,
    *RUST_EXTENSIONS,
    *HTML_EXTENSIONS,
    *CSS_EXTENSIONS,
)
SKIP_DIRS = {
    ".git",
    "node_modules",
    "venv",
    ".venv",
    "__pycache__",
    "dist",
    "build",
    ".next",
    ".idea",
    ".vscode",
    "coverage",
}

IMPORT_FROM_RE = re.compile(r"^\s*import\s+.+?\s+from\s+['\"]([^'\"]+)['\"]")
IMPORT_SIDE_EFFECT_RE = re.compile(r"^\s*import\s+['\"]([^'\"]+)['\"]")
EXPORT_FROM_RE = re.compile(r"^\s*export\s+.+?\s+from\s+['\"]([^'\"]+)['\"]")
REQUIRE_RE = re.compile(r"require\(\s*['\"]([^'\"]+)['\"]\s*\)")
DYNAMIC_IMPORT_RE = re.compile(r"import\(\s*['\"]([^'\"]+)['\"]\s*\)")

C_INCLUDE_RE = re.compile(r"^\s*#\s*include\s*[<\"]([^\">]+)[\">]")

GO_SINGLE_IMPORT_RE = re.compile(
    r"^\s*import\s+(?:[A-Za-z_][A-Za-z0-9_]*\s+|\.\s+|_\s+)?[\"`]([^\"`]+)[\"`]"
)
GO_IMPORT_BLOCK_START_RE = re.compile(r"^\s*import\s*\(\s*$")
GO_IMPORT_BLOCK_ITEM_RE = re.compile(
    r"^\s*(?:[A-Za-z_][A-Za-z0-9_]*\s+|\.\s+|_\s+)?[\"`]([^\"`]+)[\"`]"
)

RUST_MOD_RE = re.compile(r"^\s*(?:pub\s+)?mod\s+([A-Za-z_][A-Za-z0-9_]*)\s*;")
RUST_USE_RE = re.compile(r"^\s*(?:pub\s+)?use\s+([^;]+);")

HTML_SCRIPT_SRC_RE = re.compile(r"<script[^>]+src=[\"']([^\"']+)[\"']", re.IGNORECASE)
HTML_LINK_HREF_RE = re.compile(r"<link[^>]+href=[\"']([^\"']+)[\"']", re.IGNORECASE)
HTML_ASSET_SRC_RE = re.compile(
    r"<(?:img|source|video|audio|iframe)[^>]+src=[\"']([^\"']+)[\"']",
    re.IGNORECASE,
)

CSS_IMPORT_RE = re.compile(r"@import\s+(?:url\()?\s*[\"']?([^\"')\s;]+)", re.IGNORECASE)
CSS_URL_RE = re.compile(r"url\(\s*[\"']?([^\"')]+)[\"']?\s*\)", re.IGNORECASE)

# ── Function / class extraction regexes ──────────────────────────────────────
# JavaScript / TypeScript
JS_FUNC_RE = re.compile(
    r"^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*[\.(<\",]"
)
JS_ARROW_RE = re.compile(
    r"^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*="
    r"\s*(?:async\s+)?(?:\([^)]*\)|[A-Za-z_$][A-Za-z0-9_$]*)\s*=>"
)
JS_CLASS_RE = re.compile(
    r"^\s*(?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][A-Za-z0-9_$]*)"
)
JS_METHOD_RE = re.compile(
    r"^\s+(?:(?:public|private|protected|static|async|get|set|override)\s+)*"
    r"([A-Za-z_$][A-Za-z0-9_$]*)\s*\([^)]*\)\s*(?::\s*\S+)?\s*\{"
)

# Go
GO_FUNC_RE = re.compile(
    r"^func\s+(?:\([^)]+\)\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*[(\<]"
)

# Rust
RUST_FN_RE = re.compile(
    r"^\s*(?:pub(?:\([^)]+\))?\s+)?(?:async\s+)?(?:unsafe\s+)?fn\s+([A-Za-z_][A-Za-z0-9_]*)"
)
RUST_IMPL_RE = re.compile(r"^\s*(?:pub\s+)?(?:unsafe\s+)?impl(?:\s*<[^>]+>)?\s+([A-Za-z_][A-Za-z0-9_]*)")
RUST_STRUCT_RE = re.compile(r"^\s*(?:pub(?:\([^)]+\))?\s+)?struct\s+([A-Za-z_][A-Za-z0-9_]*)")
RUST_ENUM_RE = re.compile(r"^\s*(?:pub(?:\([^)]+\))?\s+)?enum\s+([A-Za-z_][A-Za-z0-9_]*)")
RUST_TRAIT_RE = re.compile(r"^\s*(?:pub(?:\([^)]+\))?\s+)?trait\s+([A-Za-z_][A-Za-z0-9_]*)")

# C / C++ — simple heuristic: return-type + name + '(' on the same line, no semicolon
C_FUNC_RE = re.compile(
    r"^(?!\s*[#/])(?:[\w:*&\s]+\s+)([A-Za-z_][A-Za-z0-9_:]*)\s*\([^;)]*\)\s*(?:const\s*)?(?:\{|$)"
)


def normalize_github_url(url: str) -> str:
    cleaned = url.strip()
    if cleaned.endswith("/"):
        cleaned = cleaned[:-1]
    if cleaned.endswith(".git"):
        cleaned = cleaned[:-4]
    return cleaned


def is_supported_github_url(url: str) -> bool:
    normalized = normalize_github_url(url)
    return normalized.startswith("https://github.com/") or normalized.startswith(
        "http://github.com/"
    )


async def analyze_repository_graph(
    github_url: str,
    clone_base_dir: str,
    clone_timeout_seconds: int = 120,
    progress_callback: Callable[[str, int, str | None], Awaitable[None] | None] | None = None,
) -> tuple[dict, Path]:
    """Clone repo, parse dependencies, build graph.

    Returns (graph_payload, clone_path). The caller is responsible for
    deleting ``clone_path`` after it has finished using the files on disk
    (e.g. after reading content for AI summarisation).

    The clone is automatically deleted if an exception is raised inside this
    function so callers never see a partial clone dir on failure.
    """
    normalized_url = normalize_github_url(github_url)
    clone_url = f"{normalized_url}.git"

    clone_base_path = Path(clone_base_dir)
    clone_base_path.mkdir(parents=True, exist_ok=True)

    repo_clone_path = clone_base_path / f"repo_{uuid4().hex}"

    try:
        await _emit_progress(progress_callback, "cloning", 5)
        await asyncio.to_thread(
            _clone_repository,
            clone_url,
            repo_clone_path,
            clone_timeout_seconds,
        )

        await _emit_progress(progress_callback, "scanning_files", 18)
        files = _collect_source_files(repo_clone_path)
        file_set = set(files)
        python_module_index, path_to_module = _build_python_module_index(files)
        rust_module_index, rust_path_to_module = _build_rust_module_index(files)
        go_module_name = _read_go_module_name(repo_clone_path)
        go_files_by_dir = _build_go_directory_index(files)

        edges: set[tuple[str, str]] = set()
        file_count = len(files)
        progress_step = max(1, file_count // 40) if file_count else 1

        await _emit_progress(progress_callback, "parsing_dependencies", 25)

        for index, rel_path in enumerate(files):
            abs_path = repo_clone_path / Path(rel_path)
            suffix = PurePosixPath(rel_path).suffix.lower()

            if suffix in PYTHON_EXTENSIONS:
                targets = _extract_python_targets(
                    file_path=abs_path,
                    source_rel_path=rel_path,
                    module_index=python_module_index,
                    path_to_module=path_to_module,
                )
            elif suffix in JS_TS_EXTENSIONS:
                targets = _extract_js_ts_targets(
                    file_path=abs_path,
                    source_rel_path=rel_path,
                    all_files=file_set,
                )
            elif suffix in C_CPP_EXTENSIONS:
                targets = _extract_c_cpp_targets(
                    file_path=abs_path,
                    source_rel_path=rel_path,
                    all_files=file_set,
                )
            elif suffix in GO_EXTENSIONS:
                targets = _extract_go_targets(
                    file_path=abs_path,
                    source_rel_path=rel_path,
                    go_files_by_dir=go_files_by_dir,
                    go_module_name=go_module_name,
                )
            elif suffix in RUST_EXTENSIONS:
                targets = _extract_rust_targets(
                    file_path=abs_path,
                    source_rel_path=rel_path,
                    all_files=file_set,
                    rust_module_index=rust_module_index,
                    rust_path_to_module=rust_path_to_module,
                )
            elif suffix in HTML_EXTENSIONS:
                targets = _extract_html_targets(
                    file_path=abs_path,
                    source_rel_path=rel_path,
                    all_files=file_set,
                )
            elif suffix in CSS_EXTENSIONS:
                targets = _extract_css_targets(
                    file_path=abs_path,
                    source_rel_path=rel_path,
                    all_files=file_set,
                )
            else:
                targets = set()

            for target in targets:
                if target in file_set and target != rel_path:
                    edges.add((rel_path, target))

            if index % progress_step == 0 or index == file_count - 1:
                percent = 25 + int(((index + 1) / max(1, file_count)) * 67)
                await _emit_progress(progress_callback, "parsing_dependencies", percent, rel_path)

        await _emit_progress(progress_callback, "extracting_functions", 93)

        # Second pass: extract function/class names while the repo is still on disk.
        # This is a fast read-only scan — no parsing heavy enough to block the loop.
        functions_by_file: dict[str, list[dict]] = {}
        for rel_path in files:
            abs_path = repo_clone_path / Path(rel_path)
            functions_by_file[rel_path] = _extract_functions_from_file(abs_path, rel_path)

        await _emit_progress(progress_callback, "building_graph", 95)

        graph_payload = _build_graph_payload(files, edges, functions_by_file)
        await _emit_progress(progress_callback, "complete", 100)
        # Return the clone path so the caller can read file content for AI
        # summarisation before cleaning up the directory.
        return graph_payload, repo_clone_path
    except Exception:
        # Only clean up on failure; success cleanup is the caller's job.
        shutil.rmtree(repo_clone_path, ignore_errors=True)
        raise


async def _emit_progress(
    progress_callback: Callable[[str, int, str | None], Awaitable[None] | None] | None,
    stage: str,
    percent: int,
    current_file: str | None = None,
) -> None:
    if progress_callback is None:
        return

    maybe_result = progress_callback(stage, percent, current_file)
    if asyncio.iscoroutine(maybe_result):
        await maybe_result


def _clone_repository(url: str, destination: Path, timeout_seconds: int) -> None:
    result = subprocess.run(
        [
            "git",
            "-c", "core.longpaths=true",   # Windows MAX_PATH workaround
            "clone",
            "--depth", "1",
            "--single-branch",
            url,
            str(destination),
        ],
        capture_output=True,
        text=True,
        timeout=timeout_seconds,
        check=False,
    )

    if result.returncode != 0:
        stderr = (result.stderr or "").strip()
        stdout = (result.stdout or "").strip()
        combined = stderr or stdout or "unknown clone error"

        # git exits non-zero when checkout partially fails (e.g. long filenames
        # on Windows) but the bare objects were still fetched.  If the
        # destination directory exists and is a valid git repo we can continue;
        # the source-file scanner only reads files that were actually checked out.
        if "checkout failed" in combined.lower() or "unable to create file" in combined.lower():
            if (destination / ".git").exists():
                return  # partial checkout — carry on, unreadable files will be skipped
        raise RuntimeError(f"git clone failed: {combined}")


def _collect_source_files(base_path: Path) -> list[str]:
    output: list[str] = []

    for root, dirs, files in os.walk(base_path):
        dirs[:] = [
            d
            for d in dirs
            if d not in SKIP_DIRS and not d.startswith(".") and not d.endswith(".egg-info")
        ]

        for filename in files:
            if filename.startswith("."):
                continue

            suffix = Path(filename).suffix.lower()
            if suffix not in SUPPORTED_EXTENSIONS:
                continue

            abs_path = Path(root) / filename
            rel_path = abs_path.relative_to(base_path).as_posix()
            output.append(rel_path)

    output.sort()
    return output


def _build_python_module_index(files: list[str]) -> tuple[dict[str, str], dict[str, str]]:
    module_to_path: dict[str, str] = {}
    path_to_module: dict[str, str] = {}

    for rel_path in files:
        posix_path = PurePosixPath(rel_path)
        if posix_path.suffix.lower() != ".py":
            continue

        if posix_path.name == "__init__.py":
            module_name = ".".join(posix_path.parent.parts)
        else:
            module_name = ".".join(posix_path.with_suffix("").parts)

        path_to_module[rel_path] = module_name

        if module_name:
            module_to_path[module_name] = rel_path

    return module_to_path, path_to_module


def _build_rust_module_index(files: list[str]) -> tuple[dict[str, str], dict[str, str]]:
    module_to_path: dict[str, str] = {}
    path_to_module: dict[str, str] = {}

    for rel_path in files:
        posix_path = PurePosixPath(rel_path)
        if posix_path.suffix.lower() not in RUST_EXTENSIONS:
            continue

        parts = list(posix_path.parts)
        if "src" in parts:
            src_index = parts.index("src")
            module_parts = parts[src_index + 1 :]
        else:
            module_parts = parts

        if not module_parts:
            continue

        stem = Path(module_parts[-1]).stem
        parent_parts = module_parts[:-1]

        if stem in {"main", "lib"} and not parent_parts:
            module_name = "crate"
        elif stem == "mod":
            module_name = "crate"
            if parent_parts:
                module_name = module_name + "::" + "::".join(parent_parts)
        else:
            module_name = "crate"
            full_parts = [*parent_parts, stem]
            if full_parts:
                module_name = module_name + "::" + "::".join(full_parts)

        path_to_module[rel_path] = module_name
        module_to_path[module_name] = rel_path

    return module_to_path, path_to_module


def _read_go_module_name(base_path: Path) -> str | None:
    go_mod_path = base_path / "go.mod"
    if not go_mod_path.exists():
        return None

    try:
        for line in go_mod_path.read_text(encoding="utf-8", errors="ignore").splitlines():
            stripped = line.strip()
            if stripped.startswith("module "):
                module_name = stripped[len("module ") :].strip()
                return module_name or None
    except Exception:
        return None

    return None


def _build_go_directory_index(files: list[str]) -> dict[str, list[str]]:
    by_dir: dict[str, list[str]] = {}
    for rel_path in files:
        if PurePosixPath(rel_path).suffix.lower() not in GO_EXTENSIONS:
            continue

        directory = posixpath.dirname(rel_path)
        by_dir.setdefault(directory, []).append(rel_path)

    return by_dir


def _extract_python_targets(
    file_path: Path,
    source_rel_path: str,
    module_index: dict[str, str],
    path_to_module: dict[str, str],
) -> set[str]:
    try:
        source_code = file_path.read_text(encoding="utf-8", errors="ignore")
        tree = ast.parse(source_code)
    except Exception:
        return set()

    current_module = path_to_module.get(source_rel_path, "")
    targets: set[str] = set()

    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                resolved = _resolve_python_module(alias.name, module_index)
                if resolved:
                    targets.add(resolved)

        if isinstance(node, ast.ImportFrom):
            base_module = node.module or ""

            if node.level and current_module:
                base_module = _resolve_relative_python_module(
                    current_module=current_module,
                    level=node.level,
                    module=node.module,
                )

            if base_module:
                resolved_base = _resolve_python_module(base_module, module_index)
                if resolved_base:
                    targets.add(resolved_base)

            for alias in node.names:
                if alias.name == "*":
                    continue

                if base_module:
                    candidate = f"{base_module}.{alias.name}"
                else:
                    candidate = alias.name

                resolved_candidate = _resolve_python_module(candidate, module_index)
                if resolved_candidate:
                    targets.add(resolved_candidate)

    return targets


def _resolve_relative_python_module(current_module: str, level: int, module: str | None) -> str:
    package_parts = current_module.split(".")[:-1]

    if level > 1:
        package_parts = package_parts[: max(0, len(package_parts) - (level - 1))]

    if module:
        package_parts.extend(module.split("."))

    return ".".join(part for part in package_parts if part)


def _resolve_python_module(module_name: str, module_index: dict[str, str]) -> str | None:
    if not module_name:
        return None

    parts = module_name.split(".")

    while parts:
        candidate = ".".join(parts)
        if candidate in module_index:
            return module_index[candidate]
        parts.pop()

    return None


def _extract_js_ts_targets(
    file_path: Path,
    source_rel_path: str,
    all_files: set[str],
) -> set[str]:
    try:
        lines = file_path.read_text(encoding="utf-8", errors="ignore").splitlines()
    except Exception:
        return set()

    targets: set[str] = set()

    for line in lines:
        candidates: list[str] = []

        match = IMPORT_FROM_RE.search(line)
        if match:
            candidates.append(match.group(1))

        match = IMPORT_SIDE_EFFECT_RE.search(line)
        if match:
            candidates.append(match.group(1))

        match = EXPORT_FROM_RE.search(line)
        if match:
            candidates.append(match.group(1))

        candidates.extend(REQUIRE_RE.findall(line))
        candidates.extend(DYNAMIC_IMPORT_RE.findall(line))

        for import_path in candidates:
            if not import_path.startswith("."):
                continue

            resolved = _resolve_relative_import(source_rel_path, import_path, all_files)
            if resolved:
                targets.add(resolved)

    return targets


def _extract_c_cpp_targets(
    file_path: Path,
    source_rel_path: str,
    all_files: set[str],
) -> set[str]:
    try:
        lines = file_path.read_text(encoding="utf-8", errors="ignore").splitlines()
    except Exception:
        return set()

    targets: set[str] = set()
    for line in lines:
        match = C_INCLUDE_RE.search(line)
        if not match:
            continue

        include_path = match.group(1)
        resolved = _resolve_c_cpp_include(source_rel_path, include_path, all_files)
        if resolved:
            targets.add(resolved)

    return targets


def _resolve_c_cpp_include(
    source_rel_path: str,
    include_path: str,
    all_files: set[str],
) -> str | None:
    source_dir = posixpath.dirname(source_rel_path)
    candidates = {
        posixpath.normpath(posixpath.join(source_dir, include_path)),
        posixpath.normpath(include_path),
    }

    for candidate in candidates:
        if candidate in all_files:
            return candidate

    return None


def _extract_go_targets(
    file_path: Path,
    source_rel_path: str,
    go_files_by_dir: dict[str, list[str]],
    go_module_name: str | None,
) -> set[str]:
    try:
        lines = file_path.read_text(encoding="utf-8", errors="ignore").splitlines()
    except Exception:
        return set()

    import_paths: list[str] = []
    in_import_block = False

    for line in lines:
        if GO_IMPORT_BLOCK_START_RE.search(line):
            in_import_block = True
            continue

        if in_import_block:
            if line.strip() == ")":
                in_import_block = False
                continue

            match = GO_IMPORT_BLOCK_ITEM_RE.search(line)
            if match:
                import_paths.append(match.group(1))
            continue

        match = GO_SINGLE_IMPORT_RE.search(line)
        if match:
            import_paths.append(match.group(1))

    targets: set[str] = set()
    for import_path in import_paths:
        targets.update(
            _resolve_go_import_targets(
                source_rel_path=source_rel_path,
                import_path=import_path,
                go_files_by_dir=go_files_by_dir,
                go_module_name=go_module_name,
            )
        )

    return targets


def _resolve_go_import_targets(
    source_rel_path: str,
    import_path: str,
    go_files_by_dir: dict[str, list[str]],
    go_module_name: str | None,
) -> set[str]:
    source_dir = posixpath.dirname(source_rel_path)
    directory: str | None = None

    if import_path.startswith("./") or import_path.startswith("../"):
        directory = posixpath.normpath(posixpath.join(source_dir, import_path))
    elif go_module_name and (
        import_path == go_module_name or import_path.startswith(go_module_name + "/")
    ):
        suffix = import_path[len(go_module_name) :].lstrip("/")
        directory = posixpath.normpath(suffix) if suffix else ""
    elif import_path.startswith("/"):
        directory = None
    else:
        # Fallback for monorepos where import path mirrors repo-relative directory.
        directory = posixpath.normpath(import_path)

    if directory is None:
        return set()

    if directory.startswith("../") or directory == "..":
        return set()

    return set(go_files_by_dir.get(directory, []))


def _extract_rust_targets(
    file_path: Path,
    source_rel_path: str,
    all_files: set[str],
    rust_module_index: dict[str, str],
    rust_path_to_module: dict[str, str],
) -> set[str]:
    try:
        lines = file_path.read_text(encoding="utf-8", errors="ignore").splitlines()
    except Exception:
        return set()

    targets: set[str] = set()
    current_module = rust_path_to_module.get(source_rel_path, "crate")

    for line in lines:
        mod_match = RUST_MOD_RE.search(line)
        if mod_match:
            mod_name = mod_match.group(1)
            resolved = _resolve_rust_mod_declaration(source_rel_path, mod_name, all_files)
            if resolved:
                targets.add(resolved)

        use_match = RUST_USE_RE.search(line)
        if use_match:
            use_path = use_match.group(1)
            normalized_use = _normalize_rust_use_path(use_path, current_module)
            resolved = _resolve_rust_module(normalized_use, rust_module_index)
            if resolved:
                targets.add(resolved)

    return targets


def _resolve_rust_mod_declaration(
    source_rel_path: str,
    mod_name: str,
    all_files: set[str],
) -> str | None:
    source_dir = posixpath.dirname(source_rel_path)
    candidates = [
        posixpath.normpath(posixpath.join(source_dir, f"{mod_name}.rs")),
        posixpath.normpath(posixpath.join(source_dir, mod_name, "mod.rs")),
    ]

    for candidate in candidates:
        if candidate in all_files:
            return candidate

    return None


def _normalize_rust_use_path(use_path: str, current_module: str) -> str:
    normalized = use_path.split(" as ")[0].strip()
    if "::{" in normalized:
        normalized = normalized.split("::{", 1)[0]

    if normalized.startswith("crate::"):
        return normalized

    if normalized.startswith("self::"):
        prefix = current_module
        remainder = normalized[len("self::") :]
        return f"{prefix}::{remainder}" if remainder else prefix

    if normalized.startswith("super::"):
        parent = current_module
        if "::" in parent:
            parent = "::".join(parent.split("::")[:-1])
        remainder = normalized[len("super::") :]
        return f"{parent}::{remainder}" if remainder else parent

    # Could be an external crate or local crate path. Prefer local resolution first.
    return f"crate::{normalized}"


def _resolve_rust_module(module_name: str, rust_module_index: dict[str, str]) -> str | None:
    if not module_name:
        return None

    parts = module_name.split("::")
    while parts:
        candidate = "::".join(parts)
        if candidate in rust_module_index:
            return rust_module_index[candidate]
        parts.pop()

    return None


def _extract_html_targets(
    file_path: Path,
    source_rel_path: str,
    all_files: set[str],
) -> set[str]:
    try:
        content = file_path.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        return set()

    raw_references: list[str] = []
    raw_references.extend(HTML_SCRIPT_SRC_RE.findall(content))
    raw_references.extend(HTML_LINK_HREF_RE.findall(content))
    raw_references.extend(HTML_ASSET_SRC_RE.findall(content))

    targets: set[str] = set()
    for reference in raw_references:
        resolved = _resolve_asset_reference(source_rel_path, reference, all_files)
        if resolved:
            targets.add(resolved)

    return targets


def _extract_css_targets(
    file_path: Path,
    source_rel_path: str,
    all_files: set[str],
) -> set[str]:
    try:
        content = file_path.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        return set()

    references: list[str] = []
    references.extend(CSS_IMPORT_RE.findall(content))
    references.extend(CSS_URL_RE.findall(content))

    targets: set[str] = set()
    for reference in references:
        resolved = _resolve_asset_reference(source_rel_path, reference, all_files)
        if resolved:
            targets.add(resolved)

    return targets


def _resolve_asset_reference(
    source_rel_path: str,
    reference: str,
    all_files: set[str],
) -> str | None:
    ref = reference.strip()
    if not ref:
        return None

    if ref.startswith(("http://", "https://", "//", "data:", "mailto:", "#", "javascript:")):
        return None

    # Remove URL query params and hash fragments.
    ref = ref.split("#", 1)[0].split("?", 1)[0]
    if not ref:
        return None

    source_dir = posixpath.dirname(source_rel_path)
    if ref.startswith("/"):
        candidate_base = ref.lstrip("/")
    else:
        candidate_base = posixpath.normpath(posixpath.join(source_dir, ref))

    if candidate_base in all_files:
        return candidate_base

    # Sometimes refs omit extension or point to a directory.
    web_exts = [*JS_TS_EXTENSIONS, *HTML_EXTENSIONS, *CSS_EXTENSIONS]
    for ext in web_exts:
        candidate = f"{candidate_base}{ext}"
        if candidate in all_files:
            return candidate

    for ext in web_exts:
        candidate = posixpath.join(candidate_base, f"index{ext}")
        if candidate in all_files:
            return candidate

    return None


def _resolve_relative_import(
    source_rel_path: str,
    import_path: str,
    all_files: set[str],
) -> str | None:
    source_dir = posixpath.dirname(source_rel_path)
    candidate_base = posixpath.normpath(posixpath.join(source_dir, import_path))

    if candidate_base.startswith("../") or candidate_base == "..":
        return None

    candidates: list[str] = [candidate_base]

    for ext in SUPPORTED_EXTENSIONS:
        candidates.append(f"{candidate_base}{ext}")

    for ext in JS_TS_EXTENSIONS:
        candidates.append(posixpath.join(candidate_base, f"index{ext}"))

    for candidate in candidates:
        if candidate in all_files:
            return candidate

    return None


def _count_brace_lines(lines: list[str], start_idx: int) -> int:
    """Count lines from start_idx until the matching closing brace.

    Returns the number of lines (inclusive) used by the construct, or 0 if the
    opening brace is never found / never closed.
    """
    depth = 0
    found_open = False
    for i, line in enumerate(lines[start_idx:]):
        opens = line.count("{")
        closes = line.count("}")
        if opens > 0:
            found_open = True
        depth += opens - closes
        if found_open and depth <= 0:
            return i + 1
    return 0


def _parse_simple_params(raw: str) -> list[str]:
    """Strip types / defaults / decorators from a raw parameter string.

    Works for JS/TS, Go, Rust, C/C++ (not Python — that uses AST).
    Returns a plain list of parameter names.
    """
    if not raw or not raw.strip():
        return []
    params: list[str] = []
    for part in raw.split(","):
        p = part.strip()
        # Remove TypeScript type annotation  `name: Type`
        p = p.split(":")[0].strip()
        # Remove default values  `name = default`
        p = p.split("=")[0].strip()
        # Remove Go-style type suffix  `name Type`  (keep first word)
        p = p.split()[0] if p.split() else p
        # Remove Rust mutability / reference prefixes
        p = p.lstrip("&*mut ")
        # Remove rest/spread  `...name`
        p = p.lstrip(".")
        # Remove JS destructuring openers
        p = p.lstrip("{[")
        # Skip empty after stripping, self/this receivers, underscore blanks
        if p and p not in {"self", "this", "_", ""}:
            params.append(p)
    return params


def _extract_functions_from_file(file_path: Path, rel_path: str) -> list[dict]:
    """Dispatch to the right language extractor; return list of function/class dicts.

    Each dict has keys:
    - ``name``       (str)  — identifier name
    - ``type``       (str)  — function | async_function | class | method |
                              arrow_function | struct | enum | trait | impl
    - ``line``       (int)  — 1-indexed start line
    - ``line_count`` (int)  — number of lines in the body (0 = unknown)
    - ``params``     (list[str]) — parameter names (simplified)
    - ``returns``    (str | None) — return type string if detectable
    """
    suffix = PurePosixPath(rel_path).suffix.lower()
    try:
        if suffix in PYTHON_EXTENSIONS:
            return _extract_python_functions(file_path)
        if suffix in JS_TS_EXTENSIONS:
            return _extract_js_ts_functions(file_path)
        if suffix in GO_EXTENSIONS:
            return _extract_go_functions(file_path)
        if suffix in RUST_EXTENSIONS:
            return _extract_rust_functions(file_path)
        if suffix in C_CPP_EXTENSIONS:
            return _extract_c_cpp_functions(file_path)
    except Exception:
        pass
    return []


def _extract_python_functions(file_path: Path) -> list[dict]:
    """Use Python's AST for accurate function / class extraction."""
    try:
        source = file_path.read_text(encoding="utf-8", errors="ignore")
        tree = ast.parse(source)
    except Exception:
        return []

    results: list[dict] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.ClassDef):
            lc = (node.end_lineno - node.lineno + 1) if hasattr(node, "end_lineno") else 0
            results.append({
                "name": node.name,
                "type": "class",
                "line": node.lineno,
                "line_count": lc,
                "params": [],
                "returns": None,
            })
        elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            args = node.args
            params: list[str] = [
                a.arg for a in (args.posonlyargs + args.args + args.kwonlyargs)
            ]
            if args.vararg:
                params.append(f"*{args.vararg.arg}")
            if args.kwarg:
                params.append(f"**{args.kwarg.arg}")

            returns: str | None = None
            if node.returns:
                try:
                    returns = ast.unparse(node.returns)
                except Exception:
                    pass

            lc = (node.end_lineno - node.lineno + 1) if hasattr(node, "end_lineno") else 0
            kind = "async_function" if isinstance(node, ast.AsyncFunctionDef) else "function"
            results.append({
                "name": node.name,
                "type": kind,
                "line": node.lineno,
                "line_count": lc,
                "params": params,
                "returns": returns,
            })

    results.sort(key=lambda x: x["line"])
    return results


# Regex for capturing parameter strings inside JS/TS function signatures
_JS_PARAMS_RE = re.compile(r"\(([^)]*)\)")
# Regex for TS return type annotation after ): TypeHere {
_JS_RETURN_RE = re.compile(r"\)\s*:\s*([A-Za-z_$][^\{;=]*?)\s*(?:\{|=>|$)")


def _extract_js_ts_functions(file_path: Path) -> list[dict]:
    """Regex-based extraction for JavaScript / TypeScript."""
    try:
        lines = file_path.read_text(encoding="utf-8", errors="ignore").splitlines()
    except Exception:
        return []

    results: list[dict] = []
    for lineno, line in enumerate(lines, start=1):
        m = JS_CLASS_RE.match(line)
        if m:
            lc = _count_brace_lines(lines, lineno - 1)
            results.append({
                "name": m.group(1), "type": "class",
                "line": lineno, "line_count": lc,
                "params": [], "returns": None,
            })
            continue

        m = JS_FUNC_RE.match(line)
        if m:
            kind = "async_function" if "async" in line[:line.find(m.group(1))] else "function"
            pm = _JS_PARAMS_RE.search(line)
            params = _parse_simple_params(pm.group(1)) if pm else []
            rm = _JS_RETURN_RE.search(line)
            returns = rm.group(1).strip() if rm else None
            lc = _count_brace_lines(lines, lineno - 1)
            results.append({
                "name": m.group(1), "type": kind,
                "line": lineno, "line_count": lc,
                "params": params, "returns": returns,
            })
            continue

        m = JS_ARROW_RE.match(line)
        if m:
            pm = _JS_PARAMS_RE.search(line)
            params = _parse_simple_params(pm.group(1)) if pm else []
            lc = _count_brace_lines(lines, lineno - 1)
            results.append({
                "name": m.group(1), "type": "arrow_function",
                "line": lineno, "line_count": lc,
                "params": params, "returns": None,
            })
            continue

        m = JS_METHOD_RE.match(line)
        if m and m.group(1) not in {"if", "for", "while", "switch", "catch"}:
            pm = _JS_PARAMS_RE.search(line)
            params = _parse_simple_params(pm.group(1)) if pm else []
            rm = _JS_RETURN_RE.search(line)
            returns = rm.group(1).strip() if rm else None
            lc = _count_brace_lines(lines, lineno - 1)
            results.append({
                "name": m.group(1), "type": "method",
                "line": lineno, "line_count": lc,
                "params": params, "returns": returns,
            })

    return results


# Extended Go regex: captures name, param-list, and optional return type(s)
_GO_FUNC_FULL_RE = re.compile(
    r"^func\s+(?:\([^)]+\)\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)"
    r"(?:\s*(?:\(([^)]*)\)|([A-Za-z_*\[\]\.][^\s{]*)))?"
)


def _extract_go_functions(file_path: Path) -> list[dict]:
    """Regex-based extraction for Go."""
    try:
        lines = file_path.read_text(encoding="utf-8", errors="ignore").splitlines()
    except Exception:
        return []

    results: list[dict] = []
    for lineno, line in enumerate(lines, start=1):
        m = _GO_FUNC_FULL_RE.match(line)
        if m:
            params = _parse_simple_params(m.group(2) or "")
            # group(3) = tuple returns "(T1, T2)", group(4) = single return "T"
            raw_ret = m.group(3) or m.group(4)
            returns = raw_ret.strip() if raw_ret else None
            lc = _count_brace_lines(lines, lineno - 1)
            results.append({
                "name": m.group(1), "type": "function",
                "line": lineno, "line_count": lc,
                "params": params, "returns": returns,
            })
    return results


# Extended Rust fn regex: captures name, param-list, optional return type
_RUST_FN_FULL_RE = re.compile(
    r"^\s*(?:pub(?:\([^)]+\))?\s+)?(?:async\s+)?(?:unsafe\s+)?fn\s+"
    r"([A-Za-z_][A-Za-z0-9_]*)(?:<[^>]+>)?\(([^)]*)\)"
    r"(?:\s*->\s*([^{;where]+))?"
)


def _extract_rust_functions(file_path: Path) -> list[dict]:
    """Regex-based extraction for Rust fn / struct / enum / trait / impl."""
    try:
        lines = file_path.read_text(encoding="utf-8", errors="ignore").splitlines()
    except Exception:
        return []

    results: list[dict] = []
    for lineno, line in enumerate(lines, start=1):
        m = _RUST_FN_FULL_RE.match(line)
        if m:
            kind = "async_function" if "async" in line[:line.find("fn")] else "function"
            params = _parse_simple_params(m.group(2) or "")
            returns = m.group(3).strip() if m.group(3) else None
            lc = _count_brace_lines(lines, lineno - 1)
            results.append({
                "name": m.group(1), "type": kind,
                "line": lineno, "line_count": lc,
                "params": params, "returns": returns,
            })
            continue
        m = RUST_STRUCT_RE.match(line)
        if m:
            lc = _count_brace_lines(lines, lineno - 1)
            results.append({
                "name": m.group(1), "type": "struct",
                "line": lineno, "line_count": lc,
                "params": [], "returns": None,
            })
            continue
        m = RUST_ENUM_RE.match(line)
        if m:
            lc = _count_brace_lines(lines, lineno - 1)
            results.append({
                "name": m.group(1), "type": "enum",
                "line": lineno, "line_count": lc,
                "params": [], "returns": None,
            })
            continue
        m = RUST_TRAIT_RE.match(line)
        if m:
            lc = _count_brace_lines(lines, lineno - 1)
            results.append({
                "name": m.group(1), "type": "trait",
                "line": lineno, "line_count": lc,
                "params": [], "returns": None,
            })
            continue
        m = RUST_IMPL_RE.match(line)
        if m:
            lc = _count_brace_lines(lines, lineno - 1)
            results.append({
                "name": m.group(1), "type": "impl",
                "line": lineno, "line_count": lc,
                "params": [], "returns": None,
            })
    return results


# C/C++ params between the first ( ) on the definition line
_C_PARAMS_RE = re.compile(r"\(([^)]*)\)")


def _extract_c_cpp_functions(file_path: Path) -> list[dict]:
    """Heuristic regex extraction for C/C++ function definitions."""
    try:
        lines = file_path.read_text(encoding="utf-8", errors="ignore").splitlines()
    except Exception:
        return []

    results: list[dict] = []
    skip_keywords = {
        "if", "for", "while", "switch", "return", "else",
        "do", "catch", "case", "default", "namespace",
    }
    for lineno, line in enumerate(lines, start=1):
        stripped = line.strip()
        if not stripped or stripped.startswith(("//", "/*", "*", "#")):
            continue
        m = C_FUNC_RE.match(line)
        if m and m.group(1) not in skip_keywords:
            pm = _C_PARAMS_RE.search(line)
            params = _parse_simple_params(pm.group(1)) if pm else []
            lc = _count_brace_lines(lines, lineno - 1)
            results.append({
                "name": m.group(1), "type": "function",
                "line": lineno, "line_count": lc,
                "params": params, "returns": None,
            })
    return results


def _build_graph_payload(
    files: list[str],
    edges: set[tuple[str, str]],
    functions_by_file: dict[str, list[dict]] | None = None,
) -> dict:
    in_degree = {path: 0 for path in files}
    out_degree = {path: 0 for path in files}

    for source, target in edges:
        out_degree[source] += 1
        in_degree[target] += 1

    nodes: list[dict] = []

    for index, path in enumerate(files):
        funcs = (functions_by_file or {}).get(path, [])
        node = {
            "id": path,
            "position": {
                "x": (index % 6) * 260,
                "y": (index // 6) * 120,
            },
            "data": {
                "label": PurePosixPath(path).name,
                "path": path,
                "language": _language_from_path(path),
                "isEntry": _is_entrypoint(path),
                "isOrphan": in_degree[path] == 0 and out_degree[path] == 0,
                "inDegree": in_degree[path],
                "outDegree": out_degree[path],
                # List of extracted functions/classes; populated during analysis.
                "functions": funcs,
                "functionCount": len(funcs),
            },
        }
        nodes.append(node)

    edge_list = sorted(edges)
    react_flow_edges = [
        {
            "id": f"e-{idx}",
            "source": source,
            "target": target,
            "data": {"importType": "direct"},
        }
        for idx, (source, target) in enumerate(edge_list)
    ]

    entry_points = [node["id"] for node in nodes if node["data"]["isEntry"]]
    orphan_nodes = [node["id"] for node in nodes if node["data"]["isOrphan"]]

    meta = {
        "nodeCount": len(nodes),
        "edgeCount": len(react_flow_edges),
        "entryPoints": entry_points,
        "orphans": orphan_nodes,
    }

    return {
        "nodes": nodes,
        "edges": react_flow_edges,
        "meta": meta,
    }


def _language_from_path(path: str) -> str:
    suffix = PurePosixPath(path).suffix.lower()
    if suffix in PYTHON_EXTENSIONS:
        return "python"
    if suffix in {".ts", ".tsx"}:
        return "typescript"
    if suffix in {".js", ".jsx"}:
        return "javascript"
    if suffix in C_CPP_EXTENSIONS:
        return "cpp_c"
    if suffix in GO_EXTENSIONS:
        return "go"
    if suffix in RUST_EXTENSIONS:
        return "rust"
    if suffix in HTML_EXTENSIONS:
        return "html"
    if suffix in CSS_EXTENSIONS:
        return "css"
    return "unknown"


def _is_entrypoint(path: str) -> bool:
    filename = PurePosixPath(path).name.lower()
    entry_filenames = {
        "main.py",
        "app.py",
        "index.js",
        "index.jsx",
        "index.ts",
        "index.tsx",
        "main.js",
        "main.jsx",
        "main.ts",
        "main.tsx",
        "server.js",
        "server.ts",
    }
    return filename in entry_filenames
