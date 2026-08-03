import json

import academic_agents.tools.document_store as store_module
from academic_agents.tools.document_store import DocumentStore
from academic_agents.tools.hybrid_retriever import hybrid_retrieve
from academic_agents.tools.paper_reader import PaperChunk


def test_document_store_caches_pdf_and_chunks(tmp_path, monkeypatch):
    chunks = [
        PaperChunk(page=1, chunk_id="p1-c1", text="论文摘要与研究问题"),
        PaperChunk(page=2, chunk_id="p2-c1", text="实验方法和主要结果"),
    ]
    monkeypatch.setattr(
        store_module, "extract_pdf_chunks", lambda _: (chunks, 2)
    )
    store = DocumentStore(root=tmp_path / "papers")
    pdf_bytes = b"%PDF-local-test"

    first, first_cache_hit = store.ingest_pdf(
        pdf_bytes, filename="example.pdf"
    )
    second, second_cache_hit = store.ingest_pdf(
        pdf_bytes, filename="renamed.pdf"
    )

    assert first_cache_hit is False
    assert second_cache_hit is True
    assert first["paper_id"] == second["paper_id"]
    assert first["filename"] == "example.pdf"
    assert len(store.load_chunks(first["paper_id"])) == 2
    assert (
        store.paper_dir(first["paper_id"]) / "structured_summary.json"
    ).exists()
    assert json.loads(
        (store.paper_dir(first["paper_id"]) / "metadata.json").read_text(
            encoding="utf-8"
        )
    )["page_count"] == 2


def test_hybrid_retriever_returns_scores_and_relevant_page():
    chunks = [
        PaperChunk(page=1, chunk_id="p1-c1", text="论文介绍研究背景。"),
        PaperChunk(
            page=4,
            chunk_id="p4-c1",
            text="实验采用多头注意力方法，并与单头注意力进行比较。",
        ),
    ]
    result = hybrid_retrieve(chunks, "为什么采用多头注意力？", limit=1)
    assert result[0]["page"] == 4
    assert "keyword_score" in result[0]
    assert "vector_score" in result[0]
    assert "rrf_score" in result[0]


def test_document_store_rejects_corrupted_cache(tmp_path):
    store = DocumentStore(root=tmp_path / "papers")
    pdf_bytes = b"%PDF-corrupted-cache"
    paper_id = store.paper_id(pdf_bytes)
    directory = store.paper_dir(paper_id)
    directory.mkdir(parents=True)
    (directory / "metadata.json").write_text("{broken", encoding="utf-8")
    (directory / "chunks.json").write_text("[]", encoding="utf-8")
    assert store.exists(paper_id) is False
