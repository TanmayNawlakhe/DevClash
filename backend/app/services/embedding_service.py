"""Vector embedding generation for repository files.

Three embeddings per file:

1. **CodeBERT** (microsoft/codebert-base → 768-dim)
   Input  : FULL file, chunked at function/class boundaries using tree-sitter.
             Each chunk is a complete function body — never mid-definition.
             Bodies that still exceed 512 tokens are sub-chunked with overlap.
             All chunk embeddings are mean-pooled → one 768-dim vector per file.

2. **all-MiniLM-L6-v2** (384-dim)
   Input  : ``"File: <path>\\n<file_summary>\\nKeywords: <kw1, kw2…>"``

3. **all-MiniLM-L6-v2** (384-dim) — one per function / class
   Input  : ``"<type> <name>(<params>) -> <returns> [N lines]: <summary>"``

The embedding job reads files from the clone that was kept on disk by
``repo_job_processor`` (clone_path stored in the graph document).
The clone is deleted by this service once all embeddings are generated.
"""
from __future__ import annotations

import asyncio
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from bson import ObjectId

from app.config import settings
from app.db.mongodb import get_database
from app.utils.logger import get_logger

logger = get_logger(__name__, level=settings.log_level)

# ── Model cache ────────────────────────────────────────────────────────────────
_codebert_tokenizer: Any = None
_codebert_model: Any = None
_minilm_model: Any = None

_CODEBERT_MAX_TOKENS = 512
_CODEBERT_OVERLAP    = 64    # overlap between sub-chunks of large function bodies


def _load_codebert() -> tuple:
    global _codebert_tokenizer, _codebert_model
    if _codebert_tokenizer is None:
        logger.info("[embed] Loading CodeBERT — first-run download may take a few minutes …")
        try:
            import torch  # noqa: F401
            from transformers import AutoModel, AutoTokenizer  # type: ignore[import]
        except ImportError as exc:
            raise RuntimeError("Install: pip install transformers torch") from exc
        _codebert_tokenizer = AutoTokenizer.from_pretrained("microsoft/codebert-base")
        _codebert_model = AutoModel.from_pretrained("microsoft/codebert-base")
        _codebert_model.eval()
        logger.info("[embed] CodeBERT ready")
    return _codebert_tokenizer, _codebert_model


def _load_minilm() -> Any:
    global _minilm_model
    if _minilm_model is None:
        logger.info("[embed] Loading all-MiniLM-L6-v2 …")
        try:
            from sentence_transformers import SentenceTransformer  # type: ignore[import]
        except ImportError as exc:
            raise RuntimeError("Install: pip install sentence-transformers") from exc
        _minilm_model = SentenceTransformer("all-MiniLM-L6-v2")
        logger.info("[embed] all-MiniLM-L6-v2 ready")
    return _minilm_model


# ── Embedding helpers ──────────────────────────────────────────────────────────

def _mean_pool(emb_list: list[list[float]]) -> list[float]:
    if not emb_list:
        return []
    n = len(emb_list)
    dim = len(emb_list[0])
    return [sum(e[d] for e in emb_list) / n for d in range(dim)]


def _embed_chunk_codebert(token_ids: list[int]) -> list[float]:
    """Single-chunk CodeBERT inference with [CLS]/[SEP] wrapping."""
    import torch
    tok, model = _load_codebert()
    ids = [tok.cls_token_id] + token_ids + [tok.sep_token_id]
    input_ids = torch.tensor([ids])
    attn_mask = torch.ones_like(input_ids)
    with torch.no_grad():
        out = model(input_ids=input_ids, attention_mask=attn_mask)
    token_emb = out.last_hidden_state
    mask_exp  = attn_mask.unsqueeze(-1).expand(token_emb.size()).float()
    pooled    = torch.sum(token_emb * mask_exp, dim=1) / mask_exp.sum(dim=1).clamp(min=1e-9)
    return pooled.squeeze().tolist()


def _embed_text_codebert(text: str) -> list[float]:
    """Embed any-length text with CodeBERT via overlapping sub-chunks, then mean-pool."""
    tok, _ = _load_codebert()
    all_ids: list[int] = tok.encode(text, add_special_tokens=False)
    if not all_ids:
        return []

    stride   = _CODEBERT_MAX_TOKENS - _CODEBERT_OVERLAP - 2   # -2 for CLS/SEP
    window   = _CODEBERT_MAX_TOKENS - 2
    chunks   = []
    i = 0
    while i < len(all_ids):
        chunks.append(all_ids[i:i + window])
        i += stride
        if i >= len(all_ids):
            break

    return _mean_pool([_embed_chunk_codebert(c) for c in chunks if c])


def _embed_text_minilm(text: str) -> list[float]:
    return _load_minilm().encode(text, show_progress_bar=False).tolist()


# ── CPU-bound worker ───────────────────────────────────────────────────────────

def _build_file_embeddings_sync(nodes: list[dict], clone_root: Path) -> list[dict]:
    """Generate all three embeddings for every node.

    Called via ``asyncio.to_thread()`` — never blocks the event loop.
    """
    from app.services.tree_sitter_extractor import chunk_file, lang_from_path

    _load_codebert()
    _load_minilm()

    total = len(nodes)
    file_embeddings: list[dict] = []

    for idx, node in enumerate(nodes, start=1):
        path = str(node.get("id", ""))
        if not path:
            continue
        data      = node.get("data", {})
        summary   = data.get("summary", "") or ""
        keywords  = data.get("keywords", []) or []
        functions = data.get("functions", []) or []

        logger.info("[embed] %d/%d — %s", idx, total, path)

        # ── Read full source ────────────────────────────────────────────────
        abs_path = clone_root / path
        try:
            source = abs_path.read_text(encoding="utf-8", errors="ignore")
        except Exception as e:
            logger.warning("[embed] Cannot read %s: %s", path, e)
            source = ""

        # ── 1. CodeBERT: whole file, chunked at function boundaries ─────────
        lang = lang_from_path(path)
        if source.strip() and lang:
            semantic_chunks = chunk_file(source, lang)
        elif source.strip():
            semantic_chunks = [source]
        else:
            semantic_chunks = []

        chunk_embs = [_embed_text_codebert(ch) for ch in semantic_chunks if ch.strip()]
        codebert_emb = _mean_pool(chunk_embs) if chunk_embs else []

        logger.info(
            "[embed]   CodeBERT: %d chars → %d semantic chunks → %d-dim",
            len(source), len(chunk_embs), len(codebert_emb),
        )

        # ── 2. all-MiniLM: file summary + path + keywords ──────────────────
        summary_parts = [f"File: {path}"]
        if summary.strip():
            summary_parts.append(summary)
        if keywords:
            summary_parts.append(f"Keywords: {', '.join(keywords)}")
        summary_emb = _embed_text_minilm("\n".join(summary_parts))

        # ── 3. all-MiniLM: each function ───────────────────────────────────
        func_embs: list[dict] = []
        for func in functions:
            name = func.get("name", "")
            if not name:
                continue
            type_  = func.get("type", "function")
            params = func.get("params", []) or []
            returns = func.get("returns")
            fsummary = func.get("summary", "") or ""
            lc = func.get("line_count", 0) or 0

            sig = f"{type_} {name}({', '.join(params)})"
            if returns:
                sig += f" -> {returns}"
            if lc:
                sig += f" [{lc} lines]"
            if fsummary.strip():
                sig += f": {fsummary}"

            func_embs.append({"name": name, "embedding": _embed_text_minilm(sig)})

        file_embeddings.append({
            "path": path,
            "codebert_embedding":   codebert_emb,   # 768-dim
            "summary_embedding":    summary_emb,     # 384-dim
            "function_embeddings":  func_embs,       # [{name, embedding: 384-dim}]
        })

    return file_embeddings


# ── Main async entry point ─────────────────────────────────────────────────────

async def run_embedding_job(repo_object_id: ObjectId) -> None:
    """Embed all files for a repository.

    Reads the clone that was kept on disk by repo_job_processor (path stored
    in graph_doc.clone_path).  Deletes the clone when finished.
    """
    db         = get_database()
    emb_col    = db["embeddings"]
    graphs_col = db["graphs"]

    started_at = datetime.now(timezone.utc)

    await emb_col.replace_one(
        {"repo_id": repo_object_id},
        {
            "repo_id": repo_object_id,
            "status": "processing",
            "started_at": started_at,
            "completed_at": None,
            "error_msg": None,
            "file_count": 0,
            "file_embeddings": [],
        },
        upsert=True,
    )

    clone_path: Path | None = None
    try:
        graph_doc = await graphs_col.find_one({"repo_id": repo_object_id})
        if not graph_doc:
            raise RuntimeError("Graph document not found — run analysis first")

        raw_clone = graph_doc.get("clone_path")
        if not raw_clone:
            raise RuntimeError(
                "clone_path is missing from graph document — "
                "the repo clone may have already been deleted"
            )

        clone_path = Path(str(raw_clone))
        if not clone_path.exists():
            raise RuntimeError(
                f"Clone directory {clone_path} no longer exists on disk. "
                "Re-run analysis to regenerate it."
            )

        nodes: list[dict] = graph_doc.get("nodes", [])
        logger.info("[embed] Starting — %d nodes, clone: %s", len(nodes), clone_path)

        # CPU-bound inference in thread pool
        file_embeddings = await asyncio.to_thread(
            _build_file_embeddings_sync, nodes, clone_path
        )

        completed_at = datetime.now(timezone.utc)
        elapsed = (completed_at - started_at).total_seconds()

        await emb_col.replace_one(
            {"repo_id": repo_object_id},
            {
                "repo_id": repo_object_id,
                "status": "complete",
                "started_at": started_at,
                "completed_at": completed_at,
                "error_msg": None,
                "file_count": len(file_embeddings),
                "file_embeddings": file_embeddings,
            },
            upsert=True,
        )
        logger.info(
            "[embed] Complete — %d files in %.1fs",
            len(file_embeddings), elapsed,
        )

        # Only delete the clone after SUCCESSFUL embedding.
        # On failure/interrupt the clone is kept so the job can be retried
        # without needing to re-analyze the repository.
        if clone_path and clone_path.exists():
            try:
                shutil.rmtree(clone_path, ignore_errors=True)
                # Remove clone_path from graph doc now that it's gone
                await graphs_col.update_one(
                    {"repo_id": repo_object_id},
                    {"$unset": {"clone_path": ""}},
                )
                logger.info("[embed] Clone deleted: %s", clone_path)
            except Exception:
                pass

    except Exception as exc:
        logger.exception("[embed] Job failed: %s", exc)
        await emb_col.update_one(
            {"repo_id": repo_object_id},
            {"$set": {
                "status": "failed",
                "completed_at": datetime.now(timezone.utc),
                "error_msg": str(exc),
            }},
        )
        # Clone is intentionally NOT deleted on failure — retry without re-analysis.
        logger.info("[embed] Clone preserved for retry: %s", clone_path)
