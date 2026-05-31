"""Elastic adapter — async Elasticsearch client."""

from elasticsearch import AsyncElasticsearch
from typing import Dict, Any, List
from cybernetics.adapters.base import MCPAdapter
from cybernetics.config.settings import settings
from cybernetics.circuit.breaker import circuit
from cybernetics.logging.logger import get_logger

logger = get_logger("cybernetics.adapters.elastic")


class ElasticAdapter(MCPAdapter):
    name = "elastic"
    description = "Elastic search — incidents, runbooks, insights"

    def __init__(self):
        super().__init__()
        self._cloud_id = settings.elastic_cloud_id
        self._api_key = settings.elastic_api_key
        self._client: AsyncElasticsearch | None = None
        self.register_tool(
            "elastic_search_incidents",
            "Search incident history",
            {"query": {"type": "string"}, "index": {"type": "string"}, "size": {"type": "integer"}},
            ["query"],
            self._search_incidents,
        )
        self.register_tool(
            "elastic_search_runbooks",
            "Find runbooks by symptom",
            {"symptom": {"type": "string"}, "index": {"type": "string"}, "size": {"type": "integer"}},
            ["symptom"],
            self._search_runbooks,
        )
        self.register_tool(
            "elastic_write_insight",
            "Write enriched insight to an incident",
            {"incident_id": {"type": "string"}, "insight": {"type": "string"}, "index": {"type": "string"}},
            ["incident_id", "insight"],
            self._write_insight,
        )

    def _get_client(self):
        if self._client is None:
            self._client = AsyncElasticsearch(
                cloud_id=self._cloud_id,
                api_key=self._api_key,
            )
        return self._client

    @circuit("elastic", failure_threshold=5, recovery_timeout=60)
    async def _search_incidents(self, query: str, index: str = "sentinel-incidents", size: int = 10) -> List[Dict[str, Any]]:
        body = {
            "query": {
                "multi_match": {
                    "query": query,
                    "fields": ["title^3", "description", "resolution", "tags"],
                    "type": "best_fields",
                }
            },
            "size": size,
        }
        resp = await self._get_client().search(index=index, body=body)
        return [hit["_source"] for hit in resp["hits"]["hits"]]

    @circuit("elastic", failure_threshold=5, recovery_timeout=60)
    async def _search_runbooks(self, symptom: str, index: str = "sentinel-runbooks", size: int = 5) -> List[Dict[str, Any]]:
        body = {"query": {"match": {"symptoms": symptom}}, "size": size}
        resp = await self._get_client().search(index=index, body=body)
        return [hit["_source"] for hit in resp["hits"]["hits"]]

    @circuit("elastic", failure_threshold=5, recovery_timeout=60)
    async def _write_insight(self, incident_id: str, insight: str, index: str = "sentinel-incidents") -> None:
        await self._get_client().update(
            index=index, id=incident_id, body={"doc": {"agent_insight": insight, "enriched": True}}
        )

    async def health(self) -> Dict[str, Any]:
        if not self._cloud_id or not self._api_key:
            return {"status": "unhealthy", "error": "ELASTIC_CLOUD_ID or ELASTIC_API_KEY not set"}
        try:
            ok = await self._get_client().ping()
            return {"status": "healthy" if ok else "degraded"}
        except Exception as exc:
            return {"status": "unhealthy", "error": str(exc)}

    async def close(self) -> None:
        if self._client:
            await self._client.close()
