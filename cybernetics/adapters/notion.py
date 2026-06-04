"""Notion adapter for pages, databases, and workspace operations."""

import httpx
from typing import Dict, Any
from cybernetics.adapters.base import MCPAdapter
from cybernetics.config.settings import settings
from cybernetics.circuit.breaker import circuit
from cybernetics.logging.logger import get_logger

logger = get_logger("cybernetics.adapters.notion")


class NotionAdapter(MCPAdapter):
    name = "notion"
    description = "Notion workspace integration via official API"

    def __init__(self):
        super().__init__()
        self._token = settings.notion_token
        self._client = httpx.AsyncClient(
            base_url="https://api.notion.com/v1",
            headers={
                "Authorization": f"Bearer {self._token}",
                "Notion-Version": "2022-06-28",
                "Content-Type": "application/json",
            },
            timeout=httpx.Timeout(30.0),
        )
        self._setup_tools()


    def _setup_tools(self):
        self.register_tool(
            "notion_search",
            "Search pages and databases",
            {"query": {"type": "string", "default": ""}, "filter": {"type": "string", "default": ""}},
            [],
            self._search,
        )
        self.register_tool(
            "notion_get_page",
            "Retrieve a page by ID",
            {"page_id": {"type": "string"}},
            ["page_id"],
            self._get_page,
        )
        self.register_tool(
            "notion_create_page",
            "Create a new page (optionally as child of another page)",
            {
                "parent_id": {"type": "string"},
                "title": {"type": "string"},
                "content": {"type": "string", "description": "Markdown-like plain text", "default": ""},
            },
            ["parent_id", "title"],
            self._create_page,
        )
        self.register_tool(
            "notion_query_database",
            "Query a Notion database",
            {
                "database_id": {"type": "string"},
                "filter": {"type": "object", "default": {}},
                "limit": {"type": "integer", "default": 100},
            },
            ["database_id"],
            self._query_database,
        )
        self.register_tool(
            "notion_update_page",
            "Update page properties",
            {"page_id": {"type": "string"}, "properties": {"type": "object"}},
            ["page_id", "properties"],
            self._update_page,
        )
        self.register_tool(
            "notion_get_database",
            "Get database schema",
            {"database_id": {"type": "string"}},
            ["database_id"],
            self._get_database,
        )

    @circuit("notion", failure_threshold=5, recovery_timeout=60)
    async def _search(self, query: str = "", filter_: str = ""):
        body = {"query": query}
        if filter_:
            body["filter"] = {"value": filter_, "property": "object"}
        r = await self._client.post("/search", json=body)
        data = r.json()
        return {"results": [{"id": r["id"], "title": self._extract_title(r), "type": r["object"]} for r in data.get("results", [])]}

    def _extract_title(self, obj: dict) -> str:
        if obj["object"] == "page":
            title = obj.get("properties", {}).get("title", {}).get("title", [])
            return "".join([t["plain_text"] for t in title]) if title else "Untitled"
        if obj["object"] == "database":
            return obj.get("title", [{}])[0].get("plain_text", "Untitled")
        return ""

    @circuit("notion", failure_threshold=5, recovery_timeout=60)
    async def _get_page(self, page_id: str):
        r = await self._client.get(f"/pages/{page_id}")
        return r.json()

    @circuit("notion", failure_threshold=5, recovery_timeout=60)
    async def _create_page(self, parent_id: str, title: str, content: str = ""):
        body = {
            "parent": {"page_id": parent_id},
            "properties": {"title": {"title": [{"text": {"content": title}}]}},
        }
        if content:
            body["children"] = [{"object": "block", "type": "paragraph", "paragraph": {"rich_text": [{"type": "text", "text": {"content": content}}]}}]
        r = await self._client.post("/pages", json=body)
        return r.json()

    @circuit("notion", failure_threshold=5, recovery_timeout=60)
    async def _query_database(self, database_id: str, filter_: dict = None, limit: int = 100):
        body = {"page_size": limit}
        if filter_:
            body["filter"] = filter_
        r = await self._client.post(f"/databases/{database_id}/query", json=body)
        data = r.json()
        return {"results": data.get("results", [])}

    @circuit("notion", failure_threshold=5, recovery_timeout=60)
    async def _update_page(self, page_id: str, properties: dict):
        r = await self._client.patch(f"/pages/{page_id}", json={"properties": properties})
        return r.json()

    @circuit("notion", failure_threshold=5, recovery_timeout=60)
    async def _get_database(self, database_id: str):
        r = await self._client.get(f"/databases/{database_id}")
        return r.json()

    async def health(self) -> Dict[str, Any]:
        if not self._token:
            return {"status": "unhealthy", "reason": "NOTION_TOKEN not set"}
        r = await self._client.post("/search", json={"page_size": 1})
        if r.status_code == 200:
            return {"status": "healthy"}
        return {"status": "unhealthy", "error": r.text}

    async def close(self) -> None:
        await self._client.aclose()
