import ast
import asyncio
import os
import posixpath
import re
import shutil
import subprocess
from pathlib import Path, PurePosixPath
from uuid import uuid4

SUPPORTED_EXTENSIONS = (".py", ".js", ".jsx", ".ts", ".tsx")
JS_TS_EXTENSIONS = (".js", ".jsx", ".ts", ".tsx")
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
    github_url: str, clone_base_dir: str, clone_timeout_seconds: int = 120
) -> dict:
    normalized_url = normalize_github_url(github_url)
    clone_url = f"{normalized_url}.git"

    clone_base_path = Path(clone_base_dir)
    clone_base_path.mkdir(parents=True, exist_ok=True)

    repo_clone_path = clone_base_path / f"repo_{uuid4().hex}"

    try:
        await asyncio.to_thread(
            _clone_repository,
            clone_url,
            repo_clone_path,
            clone_timeout_seconds,
        )

        files = _collect_source_files(repo_clone_path)
        file_set = set(files)
        python_module_index, path_to_module = _build_python_module_index(files)

        edges: set[tuple[str, str]] = set()

        for rel_path in files:
            abs_path = repo_clone_path / Path(rel_path)
            suffix = PurePosixPath(rel_path).suffix.lower()

            if suffix == ".py":
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
            else:
                targets = set()

            for target in targets:
                if target in file_set and target != rel_path:
                    edges.add((rel_path, target))

        return _build_graph_payload(files, edges)
    finally:
        shutil.rmtree(repo_clone_path, ignore_errors=True)


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
    if suffix == ".py":
        return "python"
    if suffix in {".ts", ".tsx"}:
        return "typescript"
    if suffix in {".js", ".jsx"}:
        return "javascript"
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
