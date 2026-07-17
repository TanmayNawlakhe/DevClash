# Retrieval eval — vector-only vs. graph-RAG

This harness measures whether hybrid **graph-RAG** retrieval actually beats plain
dense-vector retrieval, and turns the result into a quantified before/after
number (recall@k, MRR, hit@1) you can put on a resume.

It reads MongoDB directly (embeddings + dependency graph) and **never calls the
LLM**, so it is fast and free to run while tuning hyper-parameters.

## What it compares

| Mode | Retrieval |
|---|---|
| `vector_only` | dense cosine top-k (the original behaviour) |
| `hybrid_graph` | dense seeds expanded along the import graph via spreading activation (`app/services/graph_rag.py`) |

## Steps

1. **Analyse a repo** through the running app and wait for embeddings to finish.
   Grab its id: `GET /api/repos` (the `_id` / `id` field).

2. **Label a query set.** Copy the example and edit it:

   ```bash
   cp eval/dataset.example.json eval/dataset.json
   ```

   Each entry is a natural-language query plus the file paths you'd expect a
   correct answer to include. Paths match leniently (a suffix is enough —
   `middleware.py` matches `app/api/middleware.py`). Aim for **10–20 queries**
   for a stable average; pick queries where the right answer file *doesn't*
   share vocabulary with the question — that's where graph-RAG wins.

3. **Run it** (from `backend/`):

   ```bash
   python -m eval.run_eval --k 10
   ```

## Output

Per-query metrics for both modes, then an aggregate table:

```
metric         vector-only   hybrid-graph       delta
recall@10            0.610          0.840      +0.230
precision@10         0.190          0.240      +0.050
MRR                  0.550          0.680      +0.130
hit@1                0.500          0.600      +0.100
```

…and a copy-paste resume line built from the real numbers. **Verify the number
before you use it** — it's only as honest as your labels.

## Tuning

Retrieval hyper-parameters live in `app/services/graph_rag.py`
(`DEFAULT_SEED_COUNT`, `DEFAULT_MAX_HOPS`, `DEFAULT_DECAY`, `DEFAULT_ALPHA`) and
are also plumbed through `search_service.retrieve(...)`. The eval's vector-only
baseline is the dedicated `retrieve(use_graph=False)` path (cosine top-k), so
the A/B is clean regardless of how you tune the graph parameters.
