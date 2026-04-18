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
) -> dict:
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

        await _emit_progress(progress_callback, "building_graph", 95)

        graph_payload = _build_graph_payload(files, edges)
        await _emit_progress(progress_callback, "complete", 100)
        return graph_payload
    finally:
        shutil.rmtree(repo_clone_path, ignore_errors=True)


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
        ["git", "clone", "--depth", "1", "--single-branch", url, str(destination)],
        capture_output=True,
        text=True,
        timeout=timeout_seconds,
        check=False,
    )

    if result.returncode != 0:
        stderr = (result.stderr or "").strip()
        stdout = (result.stdout or "").strip()
        details = stderr or stdout or "unknown clone error"
        raise RuntimeError(f"git clone failed: {details}")


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


def _build_graph_payload(files: list[str], edges: set[tuple[str, str]]) -> dict:
    in_degree = {path: 0 for path in files}
    out_degree = {path: 0 for path in files}

    for source, target in edges:
        out_degree[source] += 1
        in_degree[target] += 1

    nodes: list[dict] = []

    for index, path in enumerate(files):
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
