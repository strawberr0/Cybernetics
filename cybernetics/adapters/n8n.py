"""n8n adapter — workflows, triggers, executions."""

import httpx
from typing import Dict, Any, List
from cybernetics.adapters.base import MCPAdapter
from cybernetics.config.settings import settings
from cybernetics.circuit.breaker import circuit
from cybernetics.logging.logger import get_logger

logger = get_logger("cybernetics.adapters.n8n")


class N8nAdapter(MCPAdapter):
    name = "n8n"
    description = "n8n — workflows, triggers, executions"

    def __init__(self):
        super().__init__()
        self.base_url = settings.n8n_url.rstrip("/")
        self.headers = {"X-N8N-API-KEY": settings.n8n_api_key}
        self.register_tool("n8n_list_workflows", "List workflows", {}, [], self._list_workflows)
        self.register_tool("n8n_trigger", "Trigger a workflow", {"workflow_id": {"type": "string"}, "data": {"type": "object", "default": {}}}, ["workflow_id"], self._trigger)
        self.register_tool("n8n_get_execution", "Get execution status", {"execution_id": {"type": "string"}}, ["execution_id"], self._get_execution)

    @circuit("n8n", failure_threshold=5, recovery_timeout=60)
    async def _list_workflows(self) -> List[Dict[str, Any]]:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(f"{self.base_url}/api/v1/workflows", headers=self.headers)
            resp.raise_for_status()
            return resp.json().get("data", [])

    @circuit("n8n", failure_threshold=5, recovery_timeout=60)
    async def _trigger(self, workflow_id: str, data: Dict[str, Any] = None) -> Dict[str, Any]:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(f"{self.base_url}/webhook/{workflow_id}", json=data or {})
            resp.raise_for_status()
            return resp.json()

    @circuit("n8n", failure_threshold=5, recovery_timeout=60)
    async def _get_execution(self, execution_id: str) -> Dict[str, Any]:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(f"{self.base_url}/api/v1/executions/{execution_id}", headers=self.headers)
            resp.raise_for_status()
            return resp.json()

    async def health(self) -> Dict[str, Any]:
        if not self.base_url:
            return {"status": "unhealthy", "error": "N8N_URL not set"}
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(f"{self.base_url}/healthz")
                return {"status": "healthy" if resp.status_code == 200 else "degraded"}
        except Exception as exc:
            return {"status": "unhealthy", "error": str(exc)}
