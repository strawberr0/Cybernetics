"""Confluence adapter — pages, spaces, search."""

import httpx
from typing import Dict, Any, List
from cybernetics.adapters.base import MCPAdapter
from cybernetics.config.settings import settings
from cybernetics.circuit.breaker import circuit
from cybernetics.logging.logger import get_logger

logger = get_logger("cybernetics.adapters.confluence")


class ConfluenceAdapter(MCPAdapter):
    name = "confluence"
    description = "Confluence — pages, spaces, search"

    def __init__(self):
        super().__init__()
        self.base_url = settings.confluence_url.rstrip("/")
        self.headers = {"Authorization": f"Bearer {settings.confluence_api_token}", "Content-Type": "application/json"}
        self.register_tool("confluence_search_pages", "Search pages by query", {"query": {"type": "string"}, "limit": {"type": "integer", "default": 10}}, ["query"], self._search_pages)
        self.register_tool("confluence_get_page", "Get page by ID", {"page_id": {"type": "string"}}, ["page_id"], self._get_page)
        self.register_tool("confluence_create_page", "Create a page", {"space_key": {"type": "string"}, "title": {"type": "string"}, "body": {"type": "string"}}, ["space_key", "title", "body"], self._create_page)

    @circuit("confluence", failure_threshold=5, recovery_timeout=60)
    async def _search_pages(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(f"{self.base_url}/rest/api/content/search", headers=self.headers, params={"cql": f"text ~ \"{query}\"", "limit": limit})
            resp.raise_for_status()
            return resp.json().get("results", [])

    @circuit("confluence", failure_threshold=5, recovery_timeout=60)
    async def _get_page(self, page_id: str) -> Dict[str, Any]:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(f"{self.base_url}/rest/api/content/{page_id}?expand=body.storage,space", headers=self.headers)
            resp.raise_for_status()
            return resp.json()

    @circuit("confluence", failure_threshold=5, recovery_timeout=60)
    async def _create_page(self, space_key: str, title: str, body: str) -> Dict[str, Any]:
        payload = {"type": "page", "title": title, "space": {"key": space_key}, "body": {"storage": {"value": body, "representation": "storage"}}}
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(f"{self.base_url}/rest/api/content", headers=self.headers, json=payload)
            resp.raise_for_status()
            return resp.json()

    async def health(self) -> Dict[str, Any]:
        if not self.base_url:
            return {"status": "unhealthy", "error": "CONFLUENCE_URL not set"}
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(f"{self.base_url}/rest/api/space", headers=self.headers, params={"limit": 1})
                resp.raise_for_status()
            return {"status": "healthy"}
        except Exception as exc:
            return {"status": "unhealthy", "error": str(exc)}
