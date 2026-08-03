from __future__ import annotations

import hashlib
import html
import json
import math
import re
import ssl
import time
from pathlib import Path
from typing import Any
from urllib.parse import parse_qsl, quote, urlencode, urlsplit, urlunsplit

import certifi
import httpx

from academic_agents.papers import Paper

CROSSREF_ENDPOINT = "https://api.crossref.org/v1/works"


def extract_year_range(query: str) -> tuple[int | None, int | None]:
    years = [int(value) for value in re.findall(r"\b(?:19|20)\d{2}\b", query)]
    if not years:
        return None, None
    return min(years), max(years)


def clean_search_query(query: str) -> str:
    """Remove UI instructions and year filters before sending keywords to Crossref."""
    cleaned = re.sub(r"\b(?:19|20)\d{2}\b", " ", query)
    for phrase in (
        "请帮我",
        "帮我",
        "搜索",
        "检索",
        "查找",
        "寻找",
        "分析",
        "比较",
        "对比",
        "概括",
        "总结",
        "介绍",
        "说明",
        "研究趋势",
        "发展趋势",
        "趋势",
        "研究现状",
        "研究空白",
        "现状",
        "主要方法",
        "科研探索",
        "研究探索",
        "生成报告",
        "研究报告",
        "报告",
        "有哪些",
        "是什么",
        "如何",
        "相关的",
        "相关",
        "论文",
        "文献",
        "的",
    ):
        cleaned = cleaned.replace(phrase, " ")
    cleaned = re.sub(r"\s+", " ", cleaned).strip(" ,，。:：;-")
    return cleaned or query.strip()


class MockPaperSource:
    name = "mock"

    def search(
        self,
        query: str,
        *,
        start_year: int | None = None,
        end_year: int | None = None,
        limit: int = 5,
    ) -> list[Paper]:
        papers = [
            Paper(
                paper_id="mock-001",
                title="Large Language Model Based Multi-Agent Collaboration",
                authors=["测试作者 A", "测试作者 B"],
                year=2025,
                venue="Mock AI Conference",
                doi=None,
                url=None,
                abstract=f"用于测试“{query}”检索流程的模拟摘要，不可作为科研证据。",
                citation_count=42,
                source=self.name,
                is_mock=True,
            ),
            Paper(
                paper_id="mock-002",
                title="A Survey of Cooperative AI Agents",
                authors=["测试作者 C"],
                year=2024,
                venue="Mock Journal",
                doi=None,
                url=None,
                abstract="用于测试年份过滤、排序和统一论文结构的模拟数据。",
                citation_count=18,
                source=self.name,
                is_mock=True,
            ),
        ]
        filtered = [
            paper
            for paper in papers
            if (start_year is None or (paper.year or 0) >= start_year)
            and (end_year is None or (paper.year or 9999) <= end_year)
        ]
        return filtered[:limit]


class CrossrefPaperSource:
    name = "crossref"

    def __init__(
        self,
        *,
        contact_email: str = "",
        cache_dir: Path | None = None,
        timeout: float = 20.0,
        max_retries: int = 3,
    ) -> None:
        self.contact_email = contact_email
        self.cache_dir = cache_dir or Path("data/cache/crossref")
        self.timeout = timeout
        self.max_retries = max_retries

    def search(
        self,
        query: str,
        *,
        start_year: int | None = None,
        end_year: int | None = None,
        limit: int = 5,
    ) -> list[Paper]:
        limit = max(1, min(limit, 20))
        search_query = clean_search_query(query)
        params: dict[str, str | int] = {
            "query.title": search_query,
            "rows": min(limit * 5, 50),
            "select": "DOI,title,author,published,container-title,URL,abstract,is-referenced-by-count",
        }
        filters: list[str] = []
        if start_year:
            filters.append(f"from-pub-date:{start_year}-01-01")
        if end_year:
            filters.append(f"until-pub-date:{end_year}-12-31")
        if filters:
            params["filter"] = ",".join(filters)
        if self.contact_email:
            params["mailto"] = self.contact_email

        url = f"{CROSSREF_ENDPOINT}?{urlencode(params)}"
        payload = self._load_or_fetch(url)
        items = payload.get("message", {}).get("items", [])
        papers = [self._normalize(item) for item in items]
        unique_papers: dict[str, Paper] = {}
        for paper in papers:
            identity = (paper.doi or paper.title).strip().lower()
            unique_papers.setdefault(identity, paper)
        papers = list(unique_papers.values())
        query_terms = self._query_terms(search_query)
        ranked = sorted(
            (
                (
                    self._matched_term_count(query_terms, paper),
                    self._relevance_score(search_query, paper),
                    paper,
                )
                for paper in papers
            ),
            key=lambda row: (row[0], row[1], row[2].citation_count or 0),
            reverse=True,
        )
        if query_terms:
            required_matches = min(
                3, max(1, math.ceil(len(query_terms) * 0.5))
            )
            relevant = [
                paper
                for matched_terms, _, paper in ranked
                if matched_terms >= required_matches
            ]
        else:
            # Crossref may still return useful results for a Chinese query.
            # Do not discard every item merely because the local relevance
            # scorer currently extracts Latin search terms.
            relevant = [paper for _, _, paper in ranked]
        return relevant[:limit]

    def _load_or_fetch(self, url: str) -> dict[str, Any]:
        cache_url = self._canonical_cache_url(url)
        cache_file = self.cache_dir / (
            f"{hashlib.sha256(cache_url.encode()).hexdigest()}.json"
        )
        legacy_cache_file = self.cache_dir / (
            f"{hashlib.sha256(url.encode()).hexdigest()}.json"
        )
        if cache_file.exists():
            return json.loads(cache_file.read_text(encoding="utf-8"))
        if legacy_cache_file.exists():
            payload = json.loads(legacy_cache_file.read_text(encoding="utf-8"))
            self.cache_dir.mkdir(parents=True, exist_ok=True)
            cache_file.write_text(
                json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
            )
            return payload

        headers = {
            "Accept": "application/json",
            "User-Agent": (
                "AcademicAgentsStarter/0.1 "
                f"(mailto:{self.contact_email or 'not-provided'})"
            ),
        }
        last_error: Exception | None = None
        connection_modes = ("system", "direct", "tls12")
        mode_errors: list[str] = []
        for attempt in range(self.max_retries):
            connection_mode = connection_modes[min(attempt, len(connection_modes) - 1)]
            try:
                response = self._request(url, headers, connection_mode)
                response.raise_for_status()
                payload = response.json()
                break
            except httpx.HTTPStatusError as exc:
                status_code = exc.response.status_code
                if status_code not in {429, 500, 502, 503, 504}:
                    raise RuntimeError(
                        f"Crossref 请求失败：HTTP {status_code}"
                    ) from exc
                last_error = exc
            except (httpx.TransportError, httpx.TimeoutException) as exc:
                last_error = exc
                mode_errors.append(f"{connection_mode}: {exc}")
            except (ValueError, json.JSONDecodeError) as exc:
                raise RuntimeError("Crossref 返回了无法解析的 JSON 数据") from exc

            if attempt < self.max_retries - 1:
                time.sleep(0.75 * (2**attempt))
        else:
            diagnostics = "；".join(mode_errors) or str(last_error)
            raise RuntimeError(
                f"无法连接 Crossref（已重试 {self.max_retries} 次）：{diagnostics}。"
                "请稍后重试，或临时设置 PAPER_DATA_SOURCE=mock。"
            ) from last_error

        self.cache_dir.mkdir(parents=True, exist_ok=True)
        cache_file.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        return payload

    def _request(
        self, url: str, headers: dict[str, str], connection_mode: str
    ) -> httpx.Response:
        if connection_mode == "system":
            return httpx.get(
                url,
                headers=headers,
                timeout=self.timeout,
                follow_redirects=True,
            )

        verify: bool | ssl.SSLContext = True
        if connection_mode == "tls12":
            context = ssl.create_default_context(cafile=certifi.where())
            context.minimum_version = ssl.TLSVersion.TLSv1_2
            context.maximum_version = ssl.TLSVersion.TLSv1_2
            verify = context

        with httpx.Client(
            verify=verify,
            trust_env=False,
            timeout=self.timeout,
            follow_redirects=True,
            headers={"Connection": "close"},
        ) as client:
            return client.get(url, headers=headers)

    @staticmethod
    def _canonical_cache_url(url: str) -> str:
        parts = urlsplit(url)
        query = sorted(
            (key, value)
            for key, value in parse_qsl(parts.query, keep_blank_values=True)
            if key != "mailto"
        )
        return urlunsplit(
            (parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment)
        )

    @staticmethod
    def _normalize(item: dict[str, Any]) -> Paper:
        title_values = item.get("title") or ["未提供标题"]
        venue_values = item.get("container-title") or []
        date_parts = (item.get("published") or {}).get("date-parts") or []
        year = date_parts[0][0] if date_parts and date_parts[0] else None
        authors = [
            " ".join(
                part
                for part in [author.get("given", ""), author.get("family", "")]
                if part
            )
            for author in item.get("author", [])
        ]
        doi = item.get("DOI")
        paper_url = (
            f"https://doi.org/{quote(doi, safe='/()')}"
            if doi
            else item.get("URL")
        )
        raw_abstract = item.get("abstract")
        abstract = None
        if raw_abstract:
            abstract = html.unescape(re.sub(r"<[^>]+>", "", raw_abstract)).strip() or None
        return Paper(
            paper_id=doi or item.get("URL") or title_values[0],
            title=title_values[0],
            authors=[author for author in authors if author],
            year=year,
            venue=venue_values[0] if venue_values else None,
            doi=doi,
            url=paper_url,
            abstract=abstract,
            citation_count=item.get("is-referenced-by-count"),
            source="crossref",
            is_mock=False,
        )

    @staticmethod
    def _query_terms(query: str) -> set[str]:
        ignored = {
            "paper",
            "papers",
            "search",
            "the",
            "and",
            "for",
            "with",
            "from",
        }
        return {
            term
            for term in re.findall(r"[a-zA-Z]{3,}", query.lower())
            if term not in ignored
        }

    @staticmethod
    def _matched_term_count(terms: set[str], paper: Paper) -> int:
        haystack = f"{paper.title} {paper.abstract or ''}".lower()
        return sum(term in haystack for term in terms)

    @classmethod
    def _relevance_score(cls, query: str, paper: Paper) -> int:
        terms = cls._query_terms(query)
        haystack = f"{paper.title} {paper.abstract or ''}".lower()
        return sum(3 if term in paper.title.lower() else 1 for term in terms if term in haystack)


def search_papers(
    query: str,
    *,
    source: str = "mock",
    start_year: int | None = None,
    end_year: int | None = None,
    limit: int = 5,
    contact_email: str = "",
) -> list[Paper]:
    inferred_start, inferred_end = extract_year_range(query)
    start_year = start_year or inferred_start
    end_year = end_year or inferred_end

    if source == "mock":
        provider = MockPaperSource()
    elif source == "crossref":
        provider = CrossrefPaperSource(contact_email=contact_email)
    else:
        raise ValueError("PAPER_DATA_SOURCE 只能是 mock 或 crossref")
    return provider.search(
        query,
        start_year=start_year,
        end_year=end_year,
        limit=limit,
    )
