"""Slack adapter for sending messages, channel ops, and bot interactions."""

import httpx
from typing import Dict, Any
from cybernetics.adapters.base import MCPAdapter, ToolResult
from cybernetics.config.settings import settings
from cybernetics.circuit.breaker import circuit
from cybernetics.logging.logger import get_logger

logger = get_logger("cybernetics.adapters.slack")


class SlackAdapter(MCPAdapter):
    name = "slack"
    description = "Slack workspace integration via Web API"

    def __init__(self):
        super().__init__()
        self._token = settings.slack_bot_token
        self._client = httpx.AsyncClient(
            base_url="https://slack.com/api",
            headers={"Authorization": f"Bearer {self._token}"},
            timeout=httpx.Timeout(30.0),
        )
        self._setup_tools()

    def _setup_tools(self):
        self.register_tool(
            "slack_post_message",
            "Post a message to a Slack channel",
            {
                "channel": {"type": "string", "description": "Channel ID or name"},
                "text": {"type": "string", "description": "Message text"},
                "thread_ts": {"type": "string", "description": "Thread timestamp to reply in thread", "default": ""},
            },
            ["channel", "text"],
            self._post_message,
        )
        self.register_tool(
            "slack_get_channel_history",
            "Retrieve recent messages from a channel",
            {
                "channel": {"type": "string"},
                "limit": {"type": "integer", "default": 20},
            },
            ["channel"],
            self._get_channel_history,
        )
        self.register_tool(
            "slack_list_channels",
            "List accessible channels",
            {"limit": {"type": "integer", "default": 100}},
            [],
            self._list_channels,
        )
        self.register_tool(
            "slack_search_messages",
            "Search messages across workspace",
            {
                "query": {"type": "string", "description": "Search query"},
                "count": {"type": "integer", "default": 20},
            },
            ["query"],
            self._search_messages,
        )
        self.register_tool(
            "slack_upload_file",
            "Upload a file to a channel",
            {
                "channel": {"type": "string"},
                "content": {"type": "string", "description": "File content (base64 or text)"},
                "filename": {"type": "string"},
                "title": {"type": "string", "default": ""},
            },
            ["channel", "content", "filename"],
            self._upload_file,
        )
        self.register_tool(
            "slack_get_user_info",
            "Get user info by ID or email",
            {"user": {"type": "string", "description": "User ID or email"}},
            ["user"],
            self._get_user_info,
        )

    @circuit("slack", failure_threshold=5, recovery_timeout=60)
    async def _post_message(self, channel: str, text: str, thread_ts: str = ""):
        payload = {"channel": channel, "text": text}
        if thread_ts:
            payload["thread_ts"] = thread_ts
        r = await self._client.post("/chat.postMessage", data=payload)
        data = r.json()
        if not data.get("ok"):
            raise RuntimeError(data.get("error", "Slack API error"))
        return {"ts": data["message"]["ts"], "channel": data["channel"]}

    @circuit("slack", failure_threshold=5, recovery_timeout=60)
    async def _get_channel_history(self, channel: str, limit: int = 20):
        r = await self._client.get("/conversations.history", params={"channel": channel, "limit": limit})
        data = r.json()
        if not data.get("ok"):
            raise RuntimeError(data.get("error"))
        return {"messages": data.get("messages", [])}

    @circuit("slack", failure_threshold=5, recovery_timeout=60)
    async def _list_channels(self, limit: int = 100):
        r = await self._client.get("/conversations.list", params={"limit": limit, "types": "public_channel,private_channel"})
        data = r.json()
        if not data.get("ok"):
            raise RuntimeError(data.get("error"))
        return {"channels": [{"id": c["id"], "name": c["name"]} for c in data.get("channels", [])]}

    @circuit("slack", failure_threshold=5, recovery_timeout=60)
    async def _search_messages(self, query: str, count: int = 20):
        r = await self._client.get("/search.messages", params={"query": query, "count": count})
        data = r.json()
        if not data.get("ok"):
            raise RuntimeError(data.get("error"))
        matches = data.get("messages", {}).get("matches", [])
        return {"matches": [{"text": m["text"], "channel": m["channel"]["name"], "ts": m["ts"]} for m in matches]}

    @circuit("slack", failure_threshold=5, recovery_timeout=60)
    async def _upload_file(self, channel: str, content: str, filename: str, title: str = ""):
        r = await self._client.post(
            "/files.upload",
            data={"channels": channel, "filename": filename, "title": title or filename},
            files={"file": (filename, content.encode())},
        )
        data = r.json()
        if not data.get("ok"):
            raise RuntimeError(data.get("error"))
        return {"file_id": data["file"]["id"], "url": data["file"].get("url_private", "")}

    @circuit("slack", failure_threshold=5, recovery_timeout=60)
    async def _get_user_info(self, user: str):
        if "@" in user:
            r = await self._client.get("/users.lookupByEmail", params={"email": user})
        else:
            r = await self._client.get("/users.info", params={"user": user})
        data = r.json()
        if not data.get("ok"):
            raise RuntimeError(data.get("error"))
        u = data.get("user", {})
        return {"id": u.get("id"), "name": u.get("name"), "real_name": u.get("real_name", "")}

    async def health(self) -> Dict[str, Any]:
        if not self._token:
            return {"status": "unhealthy", "reason": "SLACK_BOT_TOKEN not set"}
        r = await self._client.get("/auth.test")
        data = r.json()
        if data.get("ok"):
            return {"status": "healthy", "team": data.get("team", "")}
        return {"status": "unhealthy", "error": data.get("error")}

    async def close(self) -> None:
        await self._client.aclose()
