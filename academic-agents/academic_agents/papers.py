from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any


@dataclass(frozen=True)
class Paper:
    paper_id: str
    title: str
    authors: list[str]
    year: int | None
    venue: str | None
    doi: str | None
    url: str | None
    abstract: str | None
    citation_count: int | None
    source: str
    is_mock: bool

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

