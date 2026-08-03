from __future__ import annotations

import math
import re
from collections import Counter
from typing import Any

from .paper_reader import PaperChunk


def _tokens(text: str) -> list[str]:
    lowered = text.lower()
    words = re.findall(r"[a-z0-9][a-z0-9_-]+", lowered)
    chinese_runs = re.findall(r"[\u4e00-\u9fff]+", lowered)
    chinese_tokens: list[str] = []
    for run in chinese_runs:
        chinese_tokens.extend(run[index : index + 2] for index in range(len(run) - 1))
        chinese_tokens.extend(run[index : index + 3] for index in range(len(run) - 2))
    return words + chinese_tokens


def _char_ngrams(text: str, minimum: int = 2, maximum: int = 4) -> Counter[str]:
    normalized = re.sub(r"\s+", " ", text.lower()).strip()
    grams: Counter[str] = Counter()
    for size in range(minimum, maximum + 1):
        grams.update(
            normalized[index : index + size]
            for index in range(max(0, len(normalized) - size + 1))
        )
    return grams


def _bm25_scores(chunks: list[PaperChunk], question: str) -> list[float]:
    documents = [_tokens(chunk.text) for chunk in chunks]
    query_terms = _tokens(question)
    if not query_terms:
        return [0.0] * len(chunks)
    average_length = sum(len(document) for document in documents) / max(1, len(documents))
    document_frequency = Counter(
        term for document in documents for term in set(document)
    )
    scores: list[float] = []
    for document in documents:
        frequencies = Counter(document)
        score = 0.0
        for term in query_terms:
            frequency = frequencies[term]
            if not frequency:
                continue
            inverse_frequency = math.log(
                1 + (len(documents) - document_frequency[term] + 0.5)
                / (document_frequency[term] + 0.5)
            )
            denominator = frequency + 1.5 * (
                1 - 0.75 + 0.75 * len(document) / max(1, average_length)
            )
            score += inverse_frequency * frequency * 2.5 / denominator
        scores.append(score)
    return scores


def _tfidf_scores(chunks: list[PaperChunk], question: str) -> list[float]:
    document_vectors = [_char_ngrams(chunk.text) for chunk in chunks]
    query_vector = _char_ngrams(question)
    if not query_vector:
        return [0.0] * len(chunks)
    document_frequency = Counter(
        gram for vector in document_vectors for gram in vector
    )
    idf = {
        gram: math.log((1 + len(chunks)) / (1 + frequency)) + 1
        for gram, frequency in document_frequency.items()
    }

    def weighted(vector: Counter[str]) -> dict[str, float]:
        return {
            gram: frequency * idf.get(gram, 1.0)
            for gram, frequency in vector.items()
        }

    query_weights = weighted(query_vector)
    query_norm = math.sqrt(sum(value * value for value in query_weights.values()))
    scores: list[float] = []
    for vector in document_vectors:
        document_weights = weighted(vector)
        document_norm = math.sqrt(
            sum(value * value for value in document_weights.values())
        )
        dot_product = sum(
            value * document_weights.get(gram, 0.0)
            for gram, value in query_weights.items()
        )
        scores.append(
            dot_product / (query_norm * document_norm)
            if query_norm and document_norm
            else 0.0
        )
    return scores


def hybrid_retrieve(
    chunks: list[PaperChunk], question: str, limit: int = 6
) -> list[dict[str, Any]]:
    if not chunks:
        return []
    keyword_scores = _bm25_scores(chunks, question)
    vector_scores = _tfidf_scores(chunks, question)
    keyword_order = sorted(
        range(len(chunks)), key=lambda index: keyword_scores[index], reverse=True
    )
    vector_order = sorted(
        range(len(chunks)), key=lambda index: vector_scores[index], reverse=True
    )
    keyword_rank = {index: rank + 1 for rank, index in enumerate(keyword_order)}
    vector_rank = {index: rank + 1 for rank, index in enumerate(vector_order)}

    ranked = sorted(
        range(len(chunks)),
        key=lambda index: (
            1 / (60 + keyword_rank[index]) + 1 / (60 + vector_rank[index]),
            keyword_scores[index] + vector_scores[index],
        ),
        reverse=True,
    )
    results = []
    for index in ranked[: max(1, limit)]:
        chunk = chunks[index]
        results.append(
            {
                "page": chunk.page,
                "chunk_id": chunk.chunk_id,
                "text": chunk.text,
                "keyword_score": round(keyword_scores[index], 6),
                "vector_score": round(vector_scores[index], 6),
                "rrf_score": round(
                    1 / (60 + keyword_rank[index])
                    + 1 / (60 + vector_rank[index]),
                    6,
                ),
            }
        )
    return results


def build_structured_analysis(chunks: list[PaperChunk]) -> dict[str, Any]:
    sections = {
        "summary": "abstract introduction research problem contribution 摘要 研究问题 贡献",
        "methodology": "method methodology approach architecture algorithm 方法 模型 算法",
        "experiments": "experiment dataset baseline metric result table 实验 数据集 指标 结果",
        "limitations": "limitation discussion future work weakness 局限 不足 未来工作",
    }
    analysis: dict[str, Any] = {}
    for section_name, query in sections.items():
        evidence = hybrid_retrieve(chunks, query, limit=2)
        analysis[section_name] = {
            "content": " ".join(item["text"][:500] for item in evidence),
            "evidence": [
                {
                    "page": item["page"],
                    "chunk_id": item["chunk_id"],
                    "quote": item["text"][:500],
                }
                for item in evidence
            ],
        }
    analysis["note"] = (
        "这是基于章节关键词和本地 TF-IDF/BM25 检索得到的结构化证据摘录；"
        "正式结论应结合原始 PDF 和真实模型复核。"
    )
    return analysis
