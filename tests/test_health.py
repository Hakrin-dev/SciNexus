"""
健康检查与根路径接口测试
"""
class TestHealth:
    def test_root_returns_service_info(self, client):
        """根路径应返回服务名称与端点列表"""
        resp = client.get("/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["service"] == "研枢 YanShu API"
        assert "endpoints" in data
        assert "papers" in data["endpoints"]

    def test_health_check(self, client):
        """健康检查应返回 healthy 状态"""
        resp = client.get("/api/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "healthy"
        assert "uptime" in data
        assert data["uptime"] >= 0

    def test_detailed_health_returns_counts(self, client):
        """详细健康检查应返回各数据集条目数"""
        resp = client.get("/api/health/detailed")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "healthy"
        assert data["papers_count"] > 0
        assert data["journals_count"] > 0
