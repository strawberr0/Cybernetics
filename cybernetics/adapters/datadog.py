"""Datadog adapter for metrics, monitors, incidents, and logs."""

import httpx
from typing import Dict, Any
from cybernetics.adapters.base import MCPAdapter
from cybernetics.config.settings import settings
from cybernetics.circuit.breaker import circuit
from cybernetics.logging.logger import get_logger

logger = get_logger("cybernetics.adapters.datadog")


class DatadogAdapter(MCPAdapter):
    name = "datadog"
    description = "Datadog observability — metrics, monitors, incidents, logs"

    def __init__(self):
        super().__init__()
        self._api_key = settings.datadog_api_key
        self._app_key = settings.datadog_app_key
        self._site = settings.datadog_site
        self._client = httpx.AsyncClient(
            base_url=f"https://api.{self._site}",
            headers={
                "DD-API-KEY": self._api_key,
                "DD-APPLICATION-KEY": self._app_key,
                "Content-Type": "application/json",
            },
            timeout=httpx.Timeout(30.0),
        )
        self._setup_tools()

    def _setup_tools(self):
        self.register_tool(
            "datadog_query_metrics",
            "Query time-series metrics via Datadog",
            {
                "query": {"type": "string", "description": "Metrics query string"},
                "from": {"type": "string", "description": "From timestamp (unix or relative)"},
                "to": {"type": "string", "description": "To timestamp", "default": "now"},
            },
            ["query", "from"],
            self._query_metrics,
        )
        self.register_tool(
            "datadog_list_monitors",
            "List active monitors",
            {"tags": {"type": "string", "default": ""}},
            [],
            self._list_monitors,
        )
        self.register_tool(
            "datadog_get_monitor",
            "Get monitor details by ID",
            {"monitor_id": {"type": "integer"}},
            ["monitor_id"],
            self._get_monitor,
        )
        self.register_tool(
            "datadog_mute_monitor",
            "Mute a monitor",
            {
                "monitor_id": {"type": "integer"},
                "scope": {"type": "string", "default": "*"},
                "duration": {"type": "integer", "description": "Minutes to mute", "default": 60},
            },
            ["monitor_id"],
            self._mute_monitor,
        )
        self.register_tool(
            "datadog_list_incidents",
            "List Datadog incidents",
            {"status": {"type": "string", "default": ""}},
            [],
            self._list_incidents,
        )
        self.register_tool(
            "datadog_search_logs",
            "Search logs with Datadog query language",
            {
                "query": {"type": "string"},
                "from": {"type": "string"},
                "to": {"type": "string", "default": "now"},
                "limit": {"type": "integer", "default": 100},
            },
            ["query", "from"],
            self._search_logs,
        )
        self.register_tool(
            "datadog_post_event",
            "Post an event to Datadog event stream",
            {
                "title": {"type": "string"},
                "text": {"type": "string"},
                "tags": {"type": "array", "items": {"type": "string"}, "default": []},
                "alert_type": {"type": "string", "default": "info"},
            },
            ["title", "text"],
            self._post_event,
        )

    @circuit("datadog", failure_threshold=5, recovery_timeout=60)
    async def _query_metrics(self, **kwargs):
        query = kwargs.get("query")
        from_ = kwargs.get("from")
        to = kwargs.get("to", "now")
        r = await self._client.get("/api/v1/query", params={"query": query, "from": from_, "to": to})
        data = r.json()
        return {"series": data.get("series", []), "resolution": data.get("res_type", "")}

    @circuit("datadog", failure_threshold=5, recovery_timeout=60)
    async def _list_monitors(self, tags: str = ""):
        params = {"tags": tags} if tags else {}
        r = await self._client.get("/api/v1/monitor", params=params)
        data = r.json()
        return {"monitors": [{"id": m["id"], "name": m["name"], "status": m.get("overall_state", "")} for m in data]}

    @circuit("datadog", failure_threshold=5, recovery_timeout=60)
    async def _get_monitor(self, monitor_id: int):
        r = await self._client.get(f"/api/v1/monitor/{monitor_id}")
        data = r.json()
        return {"id": data["id"], "name": data["name"], "query": data["query"], "status": data.get("overall_state", "")}

    @circuit("datadog", failure_threshold=5, recovery_timeout=60)
    async def _mute_monitor(self, monitor_id: int, scope: str = "*", duration: int = 60):
        r = await self._client.post(f"/api/v1/monitor/{monitor_id}/mute", json={"scope": scope, "end": duration * 60})
        data = r.json()
        if data.get("errors"):
            raise RuntimeError(data["errors"])
        return {"muted": True, "monitor_id": monitor_id}

    @circuit("datadog", failure_threshold=5, recovery_timeout=60)
    async def _list_incidents(self, status: str = ""):
        params = {"filter[status]": status} if status else {}
        r = await self._client.get("/api/v2/incidents", params=params)
        data = r.json()
        return {"incidents": [{"id": i["id"], "title": i["attributes"]["title"], "status": i["attributes"]["state"]} for i in data.get("data", [])]}

    @circuit("datadog", failure_threshold=5, recovery_timeout=60)
    async def _search_logs(self, **kwargs):
        query = kwargs.get("query")
        from_ = kwargs.get("from")
        to = kwargs.get("to", "now")
        limit = kwargs.get("limit", 100)
        body = {
            "filter": {"query": query, "from": from_, "to": to},
            "page": {"limit": limit},
        }
        r = await self._client.post("/api/v2/logs/events/search", json=body)
        data = r.json()
        return {"logs": [{"message": l["attributes"]["message"], "service": l["attributes"].get("service", ""), "timestamp": l["attributes"]["timestamp"]} for l in data.get("data", [])]}

    @circuit("datadog", failure_threshold=5, recovery_timeout=60)
    async def _post_event(self, title: str, text: str, tags: list = None, alert_type: str = "info"):
        body = {"title": title, "text": text, "tags": tags or [], "alert_type": alert_type}
        r = await self._client.post("/api/v1/events", json=body)
        data = r.json()
        return {"event_url": data.get("url", "")}

    async def health(self) -> Dict[str, Any]:
        if not self._api_key:
            return {"status": "unhealthy", "reason": "DATADOG_API_KEY not set"}
        r = await self._client.get("/api/v1/validate")
        if r.status_code == 200:
            return {"status": "healthy"}
        return {"status": "unhealthy", "error": r.text}

    async def close(self) -> None:
        await self._client.aclose()
