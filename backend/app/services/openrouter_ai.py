from __future__ import annotations

import asyncio
import json
from collections import defaultdict
from pathlib import Path
from typing import Any

import httpx

from app.config import settings
from app.utils.logger import get_logger

logger = get_logger(__name__, level=settings.log_level)

FILE_CLASSIFICATIONS: tuple[str, ...] = (
	"config",
	"business_logic",
	"api",
	"data_access",
	"middleware",
	"ui",
	"test",
	"utility",
	"entry_point",
	"integration",
	"background_jobs",
)
FILE_CLASSIFICATIONS_SET = set(FILE_CLASSIFICATIONS)
DEFAULT_FILE_CLASSIFICATION = "utility"


class OpenRouterError(RuntimeError):
	pass


def _normalize_classification(raw_value: Any) -> str:
	value = str(raw_value or "").strip().lower().replace("-", "_").replace(" ", "_")
	if value in FILE_CLASSIFICATIONS_SET:
		return value
	return DEFAULT_FILE_CLASSIFICATION


def _extract_json_payload(text: str) -> dict[str, Any]:
	cleaned = text.strip()
	if not cleaned:
		logger.error("AI provider returned an empty response")
		raise OpenRouterError("AI provider returned an empty response")

	try:
		return json.loads(cleaned)
	except json.JSONDecodeError as exc:
		logger.error("Failed to decode JSON from AI provider response: %s", cleaned)
		start = cleaned.find("{")
		end = cleaned.rfind("}")
		if start != -1 and end != -1 and end > start:
			try:
				return json.loads(cleaned[start : end + 1])
			except json.JSONDecodeError as fallback_exc:
				logger.error("Fallback JSON decode failed: %s", fallback_exc)
				raise OpenRouterError(f"AI response JSON decode fallback failed: {fallback_exc}") from fallback_exc
		raise OpenRouterError(f"AI response JSON decode failed: {exc}") from exc


def _coerce_content_to_text(content: Any) -> str:
	if isinstance(content, str):
		return content

	if isinstance(content, list):
		parts: list[str] = []
		for item in content:
			if isinstance(item, dict) and item.get("type") == "text":
				parts.append(str(item.get("text", "")))
			elif isinstance(item, str):
				parts.append(item)
		return "\n".join(part for part in parts if part)

	return str(content)


def _resolve_model_for_task(task: str) -> str:
	if settings.llm_provider == "groq":
		if task == "file_summary":
			return settings.groq_model_file_reasons
		return settings.groq_model_summaries
	return settings.openrouter_model


async def _call_openrouter(messages: list[dict[str, str]], max_tokens: int, model: str) -> dict[str, Any]:
	if not settings.openrouter_api_key:
		raise OpenRouterError("OPENROUTER_API_KEY is missing")

	headers = {
		"Authorization": f"Bearer {settings.openrouter_api_key}",
		"Content-Type": "application/json",
	}

	if settings.openrouter_site_url:
		headers["HTTP-Referer"] = settings.openrouter_site_url
	if settings.openrouter_app_name:
		headers["X-Title"] = settings.openrouter_app_name

	payload = {
		"model": model,
		"messages": messages,
		"temperature": 0.2,
		"max_tokens": max_tokens,
	}

	timeout = httpx.Timeout(settings.openrouter_timeout_seconds)
	logger.info("Calling OpenRouter with model %s for max_tokens %d", model, max_tokens)
	async with httpx.AsyncClient(timeout=timeout) as client:
		response = await client.post(settings.openrouter_api_url, headers=headers, json=payload)

	if response.status_code >= 400:
		detail = response.text.strip()
		logger.error("OpenRouter request failed with status %d: %s", response.status_code, detail)
		raise OpenRouterError(f"OpenRouter request failed ({response.status_code}): {detail}")

	response_data = response.json()
	choices = response_data.get("choices", [])
	if not choices:
		logger.error("OpenRouter response did not include choices")
		raise OpenRouterError("OpenRouter response did not include choices")

	message = choices[0].get("message", {})
	content = _coerce_content_to_text(message.get("content", ""))
	
	logger.info("OpenRouter response received successfully")
	return _extract_json_payload(content)


async def _call_groq(messages: list[dict[str, str]], max_tokens: int, model: str) -> dict[str, Any]:
	if not settings.groq_api_key:
		raise OpenRouterError("GROQ_API_KEY is missing")

	headers = {
		"Authorization": f"Bearer {settings.groq_api_key}",
		"Content-Type": "application/json",
	}

	payload = {
		"model": model,
		"messages": messages,
		"temperature": 0.2,
		"max_tokens": max_tokens,
	}

	timeout = httpx.Timeout(settings.groq_timeout_seconds)
	logger.info("Calling Groq with model %s for max_tokens %d", model, max_tokens)
	async with httpx.AsyncClient(timeout=timeout) as client:
		response = await client.post(settings.groq_api_url, headers=headers, json=payload)

	if response.status_code >= 400:
		detail = response.text.strip()
		logger.error("Groq request failed with status %d: %s", response.status_code, detail)
		raise OpenRouterError(f"Groq request failed ({response.status_code}): {detail}")

	response_data = response.json()
	choices = response_data.get("choices", [])
	if not choices:
		logger.error("Groq response did not include choices")
		raise OpenRouterError("Groq response did not include choices")

	message = choices[0].get("message", {})
	content = _coerce_content_to_text(message.get("content", ""))
	
	logger.info("Groq response received successfully")
	return _extract_json_payload(content)


async def _call_ai_provider(
	messages: list[dict[str, str]],
	max_tokens: int,
	task: str,
) -> dict[str, Any]:
	model = _resolve_model_for_task(task)
	provider = settings.llm_provider

	if provider == "groq":
		return await _call_groq(messages=messages, max_tokens=max_tokens, model=model)

	return await _call_openrouter(messages=messages, max_tokens=max_tokens, model=model)


def build_file_summary_contexts(
	nodes: list[dict[str, Any]],
	edges: list[dict[str, Any]],
	target_paths: set[str] | None = None,
) -> list[dict[str, Any]]:
	out_map: dict[str, list[str]] = defaultdict(list)
	in_map: dict[str, list[str]] = defaultdict(list)

	for edge in edges:
		source = str(edge.get("source", ""))
		target = str(edge.get("target", ""))
		if source and target:
			out_map[source].append(target)
			in_map[target].append(source)

	contexts: list[dict[str, Any]] = []
	for node in nodes:
		path = str(node.get("id", ""))
		if not path:
			continue
		if target_paths and path not in target_paths:
			continue

		data = node.get("data", {})
		imports = sorted(out_map.get(path, []))[:8]
		dependents = sorted(in_map.get(path, []))[:8]

		contexts.append(
			{
				"path": path,
				"filename": str(data.get("label", path.rsplit("/", 1)[-1])),
				"language": str(data.get("language", "unknown")),
				"is_entry": bool(data.get("isEntry", False)),
				"is_orphan": bool(data.get("isOrphan", False)),
				"in_degree": int(data.get("inDegree", 0)),
				"out_degree": int(data.get("outDegree", 0)),
				"imports": imports,
				"dependents": dependents,
			}
		)

	contexts.sort(
		key=lambda item: (
			0 if item["is_entry"] else 1,
			-(item["in_degree"] + item["out_degree"]),
			item["path"],
		)
	)
	return contexts


async def generate_file_summaries_for_contexts(
	repo_url: str,
	file_contexts: list[dict[str, Any]],
	chunk_size: int = 6,
) -> dict[str, str]:
	if not file_contexts:
		logger.info("generate_file_summaries_for_contexts: no file contexts — skipping AI calls")
		return {}

	summaries_by_path: dict[str, str] = {}
	total_files = len(file_contexts)
	total_batches = (total_files + chunk_size - 1) // chunk_size

	logger.info(
		"[file-summaries] Starting — %d files, %d batches of up to %d files each (model: %s)",
		total_files,
		total_batches,
		chunk_size,
		_resolve_model_for_task("file_summary"),
	)

	for batch_num, idx in enumerate(range(0, total_files, chunk_size), start=1):
		chunk = file_contexts[idx : idx + chunk_size]
		allowed_paths = [item["path"] for item in chunk]

		logger.info(
			"[file-summaries] Batch %d/%d — sending %d file(s): %s",
			batch_num,
			total_batches,
			len(chunk),
			", ".join(allowed_paths),
		)

		user_payload = {
			"repo_url": repo_url,
			"task": "Generate detailed architecture summaries for the listed files.",
			"rules": [
				"Use only the provided metadata and dependency links.",
				"If uncertain, say appears/likely instead of asserting.",
				"Each summary must be exactly 5-6 short lines.",
				"Use newline characters between lines inside the summary string.",
				"Keep each line focused on one concrete aspect such as purpose, role, dependencies, entry-point behavior, risks, or how the file fits into the repository.",
				"Do not use markdown bullets, numbering, or headings inside the summary.",
				"Return JSON only.",
			],
			"files": chunk,
			"response_format": {
				"summaries": [
					{
						"path": "file path from allowed_paths",
						"summary": "5-6 plain-English lines separated by \\n",
					}
				]
			},
			"allowed_paths": allowed_paths,
		}

		messages = [
			{
				"role": "system",
				"content": (
					"You are a senior software architect. Produce precise, cautious multi-line summaries for files "
					"using only the supplied metadata. Each summary must contain 5-6 short lines separated by newline "
					"characters inside the JSON string. Return strict JSON with key 'summaries'."
				),
			},
			{"role": "user", "content": json.dumps(user_payload, ensure_ascii=True)},
		]

		parsed = await _call_ai_provider(messages=messages, max_tokens=2200, task="file_summary")

		items = parsed.get("summaries", [])
		if not isinstance(items, list):
			logger.error(
				"[file-summaries] Batch %d/%d — AI response missing 'summaries' array",
				batch_num,
				total_batches,
			)
			raise OpenRouterError("AI response JSON missing 'summaries' array")

		batch_results: list[str] = []
		allowed_set = set(allowed_paths)
		for item in items:
			if not isinstance(item, dict):
				continue

			path = str(item.get("path", "")).strip()
			summary = str(item.get("summary", "")).strip()
			if not path or not summary:
				continue
			if path not in allowed_set:
				logger.warning(
					"[file-summaries] Batch %d/%d — AI returned unexpected path %r; ignoring",
					batch_num,
					total_batches,
					path,
				)
				continue

			summaries_by_path[path] = summary
			batch_results.append(path)

		logger.info(
			"[file-summaries] Batch %d/%d complete — got summaries for %d/%d file(s): %s",
			batch_num,
			total_batches,
			len(batch_results),
			len(chunk),
			", ".join(batch_results) if batch_results else "(none)",
		)

	logger.info(
		"[file-summaries] All done — summarized %d/%d files total",
		len(summaries_by_path),
		total_files,
	)
	return summaries_by_path


async def generate_file_summaries_from_disk(
	repo_url: str,
	nodes: list[dict[str, Any]],
	edges: list[dict[str, Any]],
	clone_path: Path,
	chunk_size: int = 6,
	# Groq free-tier: ~6 000 tokens/min, 30 req/min.
	# Budget: 6 files × 600 chars ≈ 150 tok/file = 900 content tok
	# + prompt overhead ≈ 1 200 tok/batch → 5 batches/min → 12 s delay.
	max_content_chars: int = 600,
	batch_delay_seconds: int = 12,
) -> dict[str, dict[str, Any]]:
	"""Read actual source-file content from disk and generate AI summaries.

	Files are sent to the AI **sequentially** in batches of ``chunk_size``
	(default 6).  A ``batch_delay_seconds`` pause is inserted between every
	two consecutive batches to avoid hitting Groq's tokens-per-minute rate
	limit.  Each file is summarised individually; the combined result is a
	``{path: {summary, classification, keywords, function_summaries}}`` mapping.

	``clone_path`` must still exist on disk when this function is called.
	``max_content_chars`` limits how much of each file is forwarded to the AI
	to keep prompt size manageable (default: first 600 characters).
	"""
	if not nodes:
		logger.info("[file-summaries-disk] No nodes — skipping AI calls")
		return {}

	# Build import / dependent maps from edges
	out_map: dict[str, list[str]] = defaultdict(list)
	in_map: dict[str, list[str]] = defaultdict(list)
	for edge in edges:
		src = str(edge.get("source", ""))
		tgt = str(edge.get("target", ""))
		if src and tgt:
			out_map[src].append(tgt)
			in_map[tgt].append(src)

	# Build a flat ordered list of file info dicts (with actual content)
	file_items: list[dict[str, Any]] = []
	for node in nodes:
		path = str(node.get("id", ""))
		if not path:
			continue
		data = node.get("data", {})

		# Read actual file content from disk
		abs_path = clone_path / path
		try:
			content = abs_path.read_text(encoding="utf-8", errors="ignore")
			content = content[:max_content_chars]
		except Exception as read_err:
			logger.warning(
				"[file-summaries-disk] Could not read %s: %s",
				path,
				read_err,
			)
			content = ""

		file_items.append(
			{
				"path": path,
				"filename": str(data.get("label", path.rsplit("/", 1)[-1])),
				"language": str(data.get("language", "unknown")),
				"is_entry": bool(data.get("isEntry", False)),
				"is_orphan": bool(data.get("isOrphan", False)),
				"in_degree": int(data.get("inDegree", 0)),
				"out_degree": int(data.get("outDegree", 0)),
				"imports": sorted(out_map.get(path, []))[:8],
				"dependents": sorted(in_map.get(path, []))[:8],
				"content": content,
			}
		)

	# Sort: entry points first, then by connectivity, then alphabetically
	file_items.sort(
		key=lambda x: (
			0 if x["is_entry"] else 1,
			-(x["in_degree"] + x["out_degree"]),
			x["path"],
		)
	)

	total_files = len(file_items)
	total_batches = (total_files + chunk_size - 1) // chunk_size
	model = _resolve_model_for_task("file_summary")

	# Rough token budget log so the operator can validate settings
	estimated_tokens_per_batch = chunk_size * (max_content_chars // 4) + 300  # ~4 chars/token
	logger.info(
		"[file-summaries-disk] Starting — %d files | %d batches of %d | "
		"model=%s | max_chars/file=%d | ~%d tok/batch | delay=%ds between batches",
		total_files,
		total_batches,
		chunk_size,
		model,
		max_content_chars,
		estimated_tokens_per_batch,
		batch_delay_seconds,
	)

	summaries_by_path: dict[str, dict[str, Any]] = {}

	for batch_num, batch_start in enumerate(range(0, total_files, chunk_size), start=1):
		chunk = file_items[batch_start : batch_start + chunk_size]
		allowed_paths = [item["path"] for item in chunk]

		# Wait between batches to avoid Groq tokens-per-minute rate limit.
		# Skip the delay before the very first batch.
		if batch_num > 1:
			delay = batch_delay_seconds
			logger.info(
				"[file-summaries-disk] Waiting %ds before batch %d/%d (rate-limit guard) …",
				delay,
				batch_num,
				total_batches,
			)
			await asyncio.sleep(delay)

		logger.info(
			"[file-summaries-disk] Batch %d/%d — reading & sending %d file(s): %s",
			batch_num,
			total_batches,
			len(chunk),
			", ".join(allowed_paths),
		)

		user_payload = {
			"repo_url": repo_url,
			"task": (
				"For each file: (1) write a file-level summary, "
				"(2) assign one classification label, "
				"(3) extract technical keywords, "
				"(4) write a brief summary for every function/class listed in 'functions_to_summarize'."
			),
			"rules": [
				"Read the 'content' field for each file to understand what it actually does.",
				"Each file summary must be exactly 5-6 short lines separated by \\n.",
				f"classification must be exactly one value from: {', '.join(FILE_CLASSIFICATIONS)}.",
				"classification must be a single string, not an array and not null.",
				"Each function summary must be 2-3 sentences (max 30 words).",
				"Keywords: extract 3-8 technical terms — frameworks, libraries, patterns, "
				"protocols, or domain concepts (e.g. JWT, Redis, REST, pagination, middleware).",
				"Keywords must be plain strings in a JSON array — no duplicates, no generic words like 'file' or 'code'.",
				"Return strict JSON only — no markdown fences, no prose.",
			],
			"files": [],
			"response_format": {
				"summaries": [
					{
						"path": "<exact path from allowed_paths>",
						"file_summary": "<5-6 lines separated by \\n>",
						"classification": "<one allowed classification label>",
						"keywords": ["<keyword1>", "<keyword2>"],
						"function_summaries": [
							{"name": "<function name>", "summary": "<2-3 sentences>"}
						],
					}
				]
			},
			"allowed_paths": allowed_paths,
		}

		# Rebuild file list cleanly
		clean_files = []
		for item in chunk:
			node_data = next(
				(n.get("data", {}) for n in nodes if str(n.get("id", "")) == item["path"]),
				{}
			)
			raw_funcs = node_data.get("functions", [])
			funcs_to_send = [
				{
					"name": f["name"],
					"type": f.get("type", "function"),
					"params": f.get("params", []),
					"returns": f.get("returns"),
				}
				for f in raw_funcs
				if f.get("name")
			][:15]
			clean_files.append({**item, "functions_to_summarize": funcs_to_send})
		user_payload["files"] = clean_files

		messages = [
			{
				"role": "system",
				"content": (
					"You are a senior software architect. For each file, produce: "
					"(1) a file-level summary, "
					"(2) exactly one classification label from the allowed list, "
					"(3) a 'keywords' array of 3-8 technical terms from the file, "
					"(4) a brief summary for every function/class in 'functions_to_summarize'. "
					"Return strict JSON with key 'summaries' — no prose, no markdown fences."
				),
			},
			{"role": "user", "content": json.dumps(user_payload, ensure_ascii=True)},
		]

		try:
			parsed = await _call_ai_provider(
				messages=messages, max_tokens=2600, task="file_summary"
			)
		except OpenRouterError as ai_err:
			logger.error(
				"[file-summaries-disk] Batch %d/%d — AI call failed: %s",
				batch_num,
				total_batches,
				ai_err,
			)
			continue  # skip this batch but keep going

		items = parsed.get("summaries", [])
		if not isinstance(items, list):
			logger.error(
				"[file-summaries-disk] Batch %d/%d — response missing 'summaries' list",
				batch_num,
				total_batches,
			)
			continue

		allowed_set = set(allowed_paths)
		batch_ok: list[str] = []
		for item in items:
			if not isinstance(item, dict):
				continue
			path = str(item.get("path", "")).strip()
			# Accept either "file_summary" (new) or "summary" (old fallback)
			file_summary = str(item.get("file_summary") or item.get("summary", "")).strip()
			classification = _normalize_classification(item.get("classification"))
			if not path or not file_summary:
				continue
			if path not in allowed_set:
				logger.warning(
					"[file-summaries-disk] Batch %d/%d — AI returned unknown path %r; ignoring",
					batch_num,
					total_batches,
					path,
				)
				continue

			# Parse keywords
			raw_keywords = item.get("keywords", [])
			keywords: list[str] = [
				str(k).strip()
				for k in (raw_keywords if isinstance(raw_keywords, list) else [])
				if k and str(k).strip()
			]

			# Parse per-function summaries
			raw_func_sums = item.get("function_summaries", [])
			func_summaries: list[dict] = []
			if isinstance(raw_func_sums, list):
				for fs in raw_func_sums:
					if isinstance(fs, dict) and fs.get("name") and fs.get("summary"):
						func_summaries.append({
							"name": str(fs["name"]).strip(),
							"summary": str(fs["summary"]).strip(),
						})

			summaries_by_path[path] = {
				"summary": file_summary,
				"classification": classification,
				"keywords": keywords,
				"function_summaries": func_summaries,
			}
			batch_ok.append(path)

		logger.info(
			"[file-summaries-disk] Batch %d/%d done — %d/%d summarised: %s",
			batch_num,
			total_batches,
			len(batch_ok),
			len(chunk),
			", ".join(batch_ok) if batch_ok else "(none)",
		)

	logger.info(
		"[file-summaries-disk] All batches complete — %d/%d files summarised",
		len(summaries_by_path),
		total_files,
	)
	return summaries_by_path
