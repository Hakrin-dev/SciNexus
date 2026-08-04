"""
论文检索接口测试 —— 覆盖分页、筛选、排序、详情、推荐
"""
from server.data.mock_data import PAPERS


class TestPaperList:
    def test_default_pagination(self, client):
        """默认请求应返回第一页数据及分页元信息"""
        resp = client.get("/api/papers")
        assert resp.status_code == 200
        data = resp.json()
        assert "data" in data
        assert "total" in data
        assert data["page"] == 1
        assert data["total"] == len(PAPERS)
        assert len(data["data"]) <= data["page_size"]

    def test_custom_page_size(self, client):
        """page_size=3 应仅返回 3 条"""
        resp = client.get("/api/papers?page_size=3")
        assert resp.status_code == 200
        assert len(resp.json()["data"]) == 3

    def test_page_size_upper_bound(self, client):
        """page_size 超过 50 应被拒绝（422）"""
        resp = client.get("/api/papers?page_size=100")
        assert resp.status_code == 422

    def test_ccf_filter(self, client):
        """ccf=A 筛选应只返回 CCF-A 论文"""
        resp = client.get("/api/papers?ccf=A")
        data = resp.json()["data"]
        assert len(data) > 0
        assert all(p["ccf"] == "A" for p in data)

    def test_year_filter(self, client):
        """year=2017 筛选应只返回 2017 年论文"""
        resp = client.get("/api/papers?year=2017")
        data = resp.json()["data"]
        assert all(p["year"] == 2017 for p in data)

    def test_keyword_search(self, client):
        """关键词搜索应在标题/摘要/关键词中匹配"""
        resp = client.get("/api/papers?keyword=transformer")
        data = resp.json()["data"]
        assert len(data) > 0
        for p in data:
            kw = "transformer"
            assert (kw in p["title"].lower() or
                    kw in p["abstract"].lower() or
                    any(kw in k for k in p["keywords"]))

    def test_sort_by_citations_desc(self, client):
        """按引用数排序应为降序"""
        resp = client.get("/api/papers?sort_by=citations&page_size=50")
        data = resp.json()["data"]
        nums = [int(p["citations"].replace(",", "").replace("+", "")) for p in data]
        assert nums == sorted(nums, reverse=True)

    def test_sort_by_date_desc(self, client):
        """按日期排序应为年份降序"""
        resp = client.get("/api/papers?sort_by=date&page_size=50")
        data = resp.json()["data"]
        years = [p["year"] for p in data]
        assert years == sorted(years, reverse=True)


class TestPaperDetail:
    def test_get_existing_paper(self, client):
        """已存在的论文 ID 应返回详情"""
        resp = client.get("/api/papers/p1")
        assert resp.status_code == 200
        assert resp.json()["data"]["id"] == "p1"

    def test_get_nonexistent_paper(self, client):
        """不存在的论文 ID 应返回 404"""
        resp = client.get("/api/papers/nonexistent_id")
        assert resp.status_code == 404


class TestRecommended:
    def test_recommended_returns_top_papers(self, client):
        """推荐接口应返回指定数量的论文"""
        resp = client.get("/api/papers/recommended?limit=5")
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert len(data) == 5

    def test_recommended_sorted_by_citations(self, client):
        """推荐列表应按引用量降序"""
        resp = client.get("/api/papers/recommended?limit=5")
        data = resp.json()["data"]
        nums = [int(p["citations"].replace(",", "").replace("+", "")) for p in data]
        assert nums == sorted(nums, reverse=True)

    def test_recommended_limit_bounds(self, client):
        """limit 超过 20 应被拒绝"""
        resp = client.get("/api/papers/recommended?limit=100")
        assert resp.status_code == 422
