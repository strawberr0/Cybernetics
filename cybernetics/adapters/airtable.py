"""Airtable adapter — bases, records, views."""

import httpx
from typing import Dict, Any, List
from cybernetics.adapters.base import MCPAdapter
from cybernetics.config.settings import settings
from cybernetics.circuit.breaker import circuit
from cybernetics.logging.logger import get_logger

logger = get_logger("cybernetics.adapters.airtable")


class AirtableAdapter(MCPAdapter):
    name = "airtable"
    description = "Airtable — bases, records, views"

    def __init__(self):
        super().__init__()
        self.base_url = "https://api.airtable.com/v0"
        self.headers = {"Authorization": f"Bearer {settings.airtable_api_key}"}
        self.register_tool("airtable_list_bases", "List accessible bases", {}, [], self._list_bases)
        self.register_tool("airtable_get_base", "Get base schema", {"base_id": {"type": "string"}}, ["base_id"], self._get_base)
        self.register_tool("airtable_create_record", "Create a record", {"base_id": {"type": "string"}, "table_id": {"type": "string"}, "fields": {"type": "object"}}, ["base_id", "table_id", "fields"], self._create_record)

    @circuit("airtable", failure_threshold=5, recovery_timeout=60)
    async def _list_bases(self) -> List[Dict[str, Any]]:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(f"{self.base_url}/meta/bases", headers=self.headers)
            resp.raise_for_status()
            return resp.json().get("bases", [])

    @circuit("airtable", failure_threshold=5, recovery_timeout=60)
    async def _get_base(self, base_id: str) -> Dict[str, Any]:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(f"{self.base_url}/meta/bases/{base_id}/tables", headers=self.headers)
            resp.raise_for_status()
            return resp.json()

    @circuit("airtable", failure_threshold=5, recovery_timeout=60)
    async def _create_record(self, base_id: str, table_id: str, fields: Dict[str, Any]) -> Dict[str, Any]:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(f"{self.base_url}/{base_id}/{table_id}", headers={**self.headers, "Content-Type": "application/json"}, json={"fields": fields})
            resp.raise_for_status()
            return resp.json()

    async def health(self) -> Dict[str, Any]:
        try:
            bases = await self._list_bases()
            return {"status": "healthy", "bases_count": len(bases)}
        except Exception as exc:
            return {"status": "unhealthy", "error": str(exc)}
