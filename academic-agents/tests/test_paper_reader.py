import httpx
import pytest

import academic_agents.tools.paper_reader as paper_reader_module
from academic_agents.tools.paper_reader import (
    _request_with_fallback,
    _validate_public_url,
    extract_url_and_question,
)


def test_extract_url_and_question():
    url, question = extract_url_and_question(
        "https://example.org/paper.pdf 这篇论文的方法有什么创新？"
    )
    assert url == "https://example.org/paper.pdf"
    assert question == "这篇论文的方法有什么创新？"


def test_pdf_url_rejects_private_dns_resolution(monkeypatch):
    monkeypatch.setattr(
        paper_reader_module.socket,
        "getaddrinfo",
        lambda *args, **kwargs: [
            (2, 1, 6, "", ("127.0.0.1", 443))
        ],
    )
    with pytest.raises(ValueError, match="内网"):
        _validate_public_url("https://papers.example/paper.pdf")


def test_pdf_download_retries_with_tls12(monkeypatch):
    attempts = []
    request = httpx.Request("GET", "https://example.org/paper.pdf")
    expected = httpx.Response(
        200,
        request=request,
        headers={"content-type": "application/pdf"},
        content=b"%PDF-test",
    )

    def fake_request(url, headers, timeout, connection_mode):
        attempts.append(connection_mode)
        if connection_mode != "tls12":
            raise httpx.ConnectError("SSL EOF", request=request)
        return expected

    monkeypatch.setattr(paper_reader_module, "_request_once", fake_request)
    monkeypatch.setattr(
        paper_reader_module,
        "_validate_public_url",
        lambda _: None,
    )
    response = _request_with_fallback(
        "https://example.org/paper.pdf", {}, 1
    )
    assert response.content == b"%PDF-test"
    assert attempts == ["system", "direct", "tls12"]


def test_pdf_download_reports_all_connection_modes(monkeypatch):
    request = httpx.Request("GET", "https://example.org/paper.pdf")

    def always_fail(url, headers, timeout, connection_mode):
        raise httpx.ConnectError("SSL EOF", request=request)

    monkeypatch.setattr(paper_reader_module, "_request_once", always_fail)
    monkeypatch.setattr(
        paper_reader_module,
        "_validate_public_url",
        lambda _: None,
    )
    with pytest.raises(RuntimeError, match="system.*direct.*tls12"):
        _request_with_fallback("https://example.org/paper.pdf", {}, 1)
