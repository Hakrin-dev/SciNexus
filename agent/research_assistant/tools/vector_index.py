"""向量索引：语义检索。

优先使用 Ollama 本地 embedding 模型（nomic-embed-text）做余弦相似度；
若 Ollama 不可用/模型缺失，自动降级为词法 TF 打分，保证可用性。

向量持久化到 data/embeddings.json（按模型名缓存），避免每次启动重复计算。

注：环境无法快速安装 chromadb（依赖过重），故用轻量内存向量索引实现，
接口与 ChromaDB 对齐，后续可平滑替换。
"""
from __future__ import annotations

import json
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

import numpy as np

from research_assistant.config import settings
from research_assistant.tools.data_source import DATA_DIR


class VectorIndex:
    def __init__(self, papers: list[dict], model: str = "nomic-embed-text",
                 base_url: str | None = None) -> None:
        self.papers = papers
        self.model = model
        self.base_url = (base_url or settings.ollama_base_url).rstrip("/")
        self.base_dir = str(DATA_DIR)
        self._vecs: dict[str, np.ndarray] = {}
        self._mode: str = "lexical"  # semantic | lexical
        self._build()

    # ------------------------------------------------------------------ #
    # embedding
    # ------------------------------------------------------------------ #
    def _embed(self, text: str) -> np.ndarray | None:
        body = json.dumps({"model": self.model, "prompt": text}).encode("utf-8")
        req = urllib.request.Request(
            f"{self.base_url}/api/embeddings",
            data=body,
            headers={"Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                raw = json.loads(resp.read().decode("utf-8"))
            return np.asarray(raw.get("embedding", []), dtype=np.float32)
        except (urllib.error.URLError, urllib.error.HTTPError, ValueError, KeyError):
            return None

    def _build(self) -> None:
        """为每篇论文的 title+abstract+keywords 建立向量；失败则用词法模式。

        向量持久化到 data/embeddings.json，避免每次启动重复计算。
        允许部分论文 embedding 失败（用零向量占位），只要成功率足够高即启用语义模式。
        """
        cache = self._load_cache()
        missing = [p for p in self.papers if p["paper_id"] not in cache]
        for p in missing:
            v = self._embed(self._paper_text(p))
            if v is not None:
                cache[p["paper_id"]] = v.tolist()
        self._save_cache(cache)

        ok = sum(1 for pid in (p["paper_id"] for p in self.papers) if pid in cache)
        if cache and ok >= max(3, int(len(self.papers) * 0.5)):
            dim = len(next(iter(cache.values())))
            self._vecs = {
                p["paper_id"]: np.asarray(cache.get(p["paper_id"], [0.0] * dim), dtype=np.float32)
                for p in self.papers
            }
            self._mode = "semantic"
        else:
            self._mode = "lexical"

    # ------------------------------------------------------------------ #
    # 向量缓存
    # ------------------------------------------------------------------ #
    @property
    def _cache_path(self) -> Path:
        return Path(self.base_dir) / "embeddings.json"

    def _load_cache(self) -> dict[str, list[float]]:
        try:
            data = json.loads(self._cache_path.read_text(encoding="utf-8"))
            if data.get("model") == self.model:
                return data.get("vectors") or {}
        except (OSError, ValueError):
            pass
        return {}

    def _save_cache(self, cache: dict[str, list[float]]) -> None:
        try:
            self._cache_path.parent.mkdir(parents=True, exist_ok=True)
            self._cache_path.write_text(
                json.dumps({"model": self.model, "vectors": cache}, ensure_ascii=False), encoding="utf-8"
            )
        except OSError:
            pass

    @staticmethod
    def _paper_text(p: dict) -> str:
        return " ".join(filter(None, [p.get("title", ""), p.get("abstract", ""),
                                      " ".join(p.get("keywords", []))]))

    # ------------------------------------------------------------------ #
    # 查询
    # ------------------------------------------------------------------ #
    def search(self, query: str, top_k: int = 10) -> list[dict[str, Any]]:
        if self._mode == "semantic":
            qv = self._embed(query)
            if qv is not None:
                scores = {pid: float(np.dot(v, qv) / (np.linalg.norm(v) * np.linalg.norm(qv) + 1e-9))
                          for pid, v in self._vecs.items()}
                ranked = sorted(scores.items(), key=lambda kv: -kv[1])
                return [{"paper_id": pid, "score": sc} for pid, sc in ranked[:top_k]]
        # 词法降级
        return self._lexical_search(query, top_k)

    def _lexical_search(self, query: str, top_k: int) -> list[dict[str, Any]]:
        tokens = [t for t in query.lower().replace("，", " ").replace("和", " ").split() if t]
        if not tokens:
            return []
        scored = []
        for p in self.papers:
            blob = self._paper_text(p).lower()
            score = sum(blob.count(t) for t in tokens)
            if score > 0:
                scored.append({"paper_id": p["paper_id"], "score": float(score)})
        scored.sort(key=lambda d: -d["score"])
        return scored[:top_k]

    @property
    def mode(self) -> str:
        return self._mode
