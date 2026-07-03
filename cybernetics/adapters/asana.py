"""Asana adapter — projects, tasks, portfolios."""

import httpx
from typing import Dict, Any, List
from cybernetics.adapters.base import MCPAdapter
from cybernetics.config.settings import settings
from cybernetics.circuit.breaker import circuit
from cybernetics.logging.logger import get_logger

logger = get_logger("cybernetics.adapters.asana")


class AsanaAdapter(MCPAdapter):
    name = "asana"
    description = "Asana — projects, tasks, portfolios"

    def __init__(self):
        super().__init__()
        self.base_url = "https://app.asana.com/api/1.0"
        self.headers = {"Authorization": f"Bearer {settings.asana_token}"}
        self.register_tool("asana_list_projects", "List projects in a workspace", {"workspace": {"type": "string"}}, ["workspace"], self._list_projects)
        self.register_tool("asana_get_task", "Get task details", {"task_id": {"type": "string"}}, ["task_id"], self._get_task)
        self.register_tool("asana_create_task", "Create a task", {"project": {"type": "string"}, "name": {"type": "string"}, "notes": {"type": "string", "default": ""}}, ["project", "name"], self._create_task)

    @circuit("asana", failure_threshold=5, recovery_timeout=60)
    async def _list_projects(self, workspace: str) -> List[Dict[str, Any]]:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(f"{self.base_url}/projects", headers=self.headers, params={"workspace": workspace, "opt_fields": "name,gid"})
            resp.raise_for_status()
            return resp.json().get("data", [])

    @circuit("asana", failure_threshold=5, recovery_timeout=60)
    async def _get_task(self, task_id: str) -> Dict[str, Any]:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(f"{self.base_url}/tasks/{task_id}", headers=self.headers)
            resp.raise_for_status()
            return resp.json().get("data", {})

    @circuit("asana", failure_threshold=5, recovery_timeout=60)
    async def _create_task(self, project: str, name: str, notes: str = "") -> Dict[str, Any]:
        payload = {"data": {"projects": [project], "name": name, "notes": notes}}
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(f"{self.base_url}/tasks", headers={**self.headers, "Content-Type": "application/json"}, json=payload)
            resp.raise_for_status()
            return resp.json().get("data", {})

    async def health(self) -> Dict[str, Any]:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(f"{self.base_url}/users/me", headers=self.headers)
                resp.raise_for_status()
            return {"status": "healthy"}
        except Exception as exc:
            return {"status": "unhealthy", "error": str(exc)}
