"""PagerDuty adapter — incidents, on-call, alerts."""

import httpx
from typing import Dict, Any, List
from cybernetics.adapters.base import MCPAdapter
from cybernetics.config.settings import settings
from cybernetics.circuit.breaker import circuit
from cybernetics.logging.logger import get_logger

logger = get_logger("cybernetics.adapters.pagerduty")


class PagerDutyAdapter(MCPAdapter):
    name = "pagerduty"
    description = "PagerDuty — incidents, on-call, alerts"

    def __init__(self):
        super().__init__()
        self.base_url = "https://api.pagerduty.com"
        self.headers = {"Authorization": f"Token token={settings.pagerduty_api_key}", "Content-Type": "application/json"}
        self.register_tool("pagerduty_list_incidents", "List incidents", {"statuses": {"type": "array", "default": ["triggered", "acknowledged"]}, "limit": {"type": "integer", "default": 10}}, [], self._list_incidents)
        self.register_tool("pagerduty_acknowledge", "Acknowledge an incident", {"incident_id": {"type": "string"}}, ["incident_id"], self._acknowledge)
        self.register_tool("pagerduty_get_oncall", "Get current on-call", {"schedule_id": {"type": "string"}}, ["schedule_id"], self._get_oncall)

    @circuit("pagerduty", failure_threshold=5, recovery_timeout=60)
    async def _list_incidents(self, statuses: List[str] = None, limit: int = 10) -> List[Dict[str, Any]]:
        params = {"limit": limit}
        if statuses:
            params["statuses[]"] = statuses
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(f"{self.base_url}/incidents", headers=self.headers, params=params)
            resp.raise_for_status()
            return resp.json().get("incidents", [])

    @circuit("pagerduty", failure_threshold=5, recovery_timeout=60)
    async def _acknowledge(self, incident_id: str) -> Dict[str, Any]:
        payload = {"incident": {"type": "incident_reference", "status": "acknowledged"}}
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.put(f"{self.base_url}/incidents/{incident_id}", headers=self.headers, json=payload)
            resp.raise_for_status()
            return resp.json().get("incident", {})

    @circuit("pagerduty", failure_threshold=5, recovery_timeout=60)
    async def _get_oncall(self, schedule_id: str) -> List[Dict[str, Any]]:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(f"{self.base_url}/oncalls", headers=self.headers, params={"schedule_ids[]": schedule_id})
            resp.raise_for_status()
            return resp.json().get("oncalls", [])

    async def health(self) -> Dict[str, Any]:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(f"{self.base_url}/abilities", headers=self.headers)
                resp.raise_for_status()
            return {"status": "healthy"}
        except Exception as exc:
            return {"status": "unhealthy", "error": str(exc)}
