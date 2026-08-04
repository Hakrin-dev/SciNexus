"""
期刊/会议与投稿趋势接口测试
"""
from server.data.mock_data import JOURNALS


class TestJournals:
    def test_list_journals(self, client):
        """期刊列表应返回全部期刊数据"""
        resp = client.get("/api/journals")
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert len(data) == len(JOURNALS)
        assert all("name" in j for j in data)
        assert all("ccf" in j for j in data)


class TestTrends:
    def test_trends_returns_data(self, client):
        """趋势接口应返回数据结构"""
        resp = client.get("/api/trends")
        assert resp.status_code == 200
        data = resp.json()
        assert "data" in data
