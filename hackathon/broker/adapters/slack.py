"""
Slack Adapter — wraps Slack Web API operations as MCP-compatible tools.

Tools:
  slack_post_message        — Post a message
  slack_get_channel_history — Retrieve channel history
  slack_list_channels       — List accessible channels
  slack_search_messages     — Search workspace messages
"""

import os
import aiohttp
import logging
from typing import Any, Dict, Optional

logger = logging.getLogger("cybernetics.adapters.slack")


class SlackAdapter:
    def __init__(self, token: Optional[str] = None):
        self.token = token or os.getenv("SLACK_BOT_TOKEN")
        self.base_url = "https://slack.com/api"
        self.headers = {
            "Authorization": f"Bearer {self.token}" if self.token else "",
            "Content-Type": "application/json; charset=utf-8",
        }

    async def _post(self, path: str, json_data: Dict) -> Dict[str, Any]:
        url = f"{self.base_url}{path}"
        async with aiohttp.ClientSession() as session:
            async with session.post(url, headers=self.headers, json=json_data, timeout=30) as resp:
                resp.raise_for_status()
                data = await resp.json()
                if not data.get("ok"):
                    raise RuntimeError(data.get("error", "Unknown Slack API error"))
                return data

    async def _get(self, path: str, params: Optional[Dict] = None) -> Dict[str, Any]:
        url = f"{self.base_url}{path}"
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=self.headers, params=params, timeout=30) as resp:
                resp.raise_for_status()
                data = await resp.json()
                if not data.get("ok"):
                    raise RuntimeError(data.get("error", "Unknown Slack API error"))
                return data

    async def post_message(self, channel: str, text: str, thread_ts: str = "") -> Dict[str, Any]:
        """Post a message to a channel."""
        data = {"channel": channel, "text": text}
        if thread_ts:
            data["thread_ts"] = thread_ts
        return await self._post("/chat.postMessage", json_data=data)

    async def get_channel_history(self, channel: str, limit: int = 20) -> Dict[str, Any]:
        """Retrieve recent conversations in a channel."""
        return await self._get("/conversations.history", params={"channel": channel, "limit": limit})

    async def list_channels(self, limit: int = 100) -> Dict[str, Any]:
        """List channels in the workspace."""
        return await self._get("/conversations.list", params={"limit": limit, "types": "public_channel,private_channel"})

    async def search_messages(self, query: str, count: int = 20) -> Dict[str, Any]:
        """Search across the workspace for specific texts."""
        return await self._get("/search.messages", params={"query": query, "count": count})

    def get_tools(self) -> list:
        """Return Slack tools schema for the MCP broker."""
        return [
            {
                "name": "slack_post_message",
                "description": "Post a message or alert to a Slack channel",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "channel": {"type": "string", "description": "Slack channel ID or name (e.g., C1234567890)"},
                        "text": {"type": "string", "description": "Alert or message text (supports basic markdown)"},
                        "thread_ts": {"type": "string", "description": "Optional thread timestamp to reply in thread", "default": ""},
                    },
                    "required": ["channel", "text"],
                },
            },
            {
                "name": "slack_get_channel_history",
                "description": "Retrieve recent messages from a channel for auditing or status verification",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "channel": {"type": "string", "description": "Slack channel ID"},
                        "limit": {"type": "integer", "description": "Maximum number of messages to fetch (default: 20)"},
                    },
                    "required": ["channel"],
                },
            },
            {
                "name": "slack_list_channels",
                "description": "List all accessible channels in the Slack workspace",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "limit": {"type": "integer", "description": "Maximum channels to list (default: 100)"},
                    },
                },
            },
            {
                "name": "slack_search_messages",
                "description": "Search workspace history for specific alerts, tracebacks, or keywords",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "query": {"type": "string", "description": "Search query keyword"},
                        "count": {"type": "integer", "description": "Max results to return (default: 20)"},
                    },
                    "required": ["query"],
                },
            },
        ]

    async def resolve(self, tool_name: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """Resolve Slack tool call and return response."""
        if not self.token:
            logger.warning("Slack: execute failed due to missing SLACK_BOT_TOKEN.")
            return {"status": "error", "message": "SLACK_BOT_TOKEN environment variable not set."}

        try:
            if tool_name == "slack_post_message":
                result = await self.post_message(params["channel"], params["text"], params.get("thread_ts", ""))
                return {
                    "status": "success",
                    "data": {
                        "ts": result.get("message", {}).get("ts"),
                        "channel": result.get("channel"),
                        "message": result.get("message", {}).get("text"),
                    }
                }
            elif tool_name == "slack_get_channel_history":
                result = await self.get_channel_history(params["channel"], params.get("limit", 20))
                return {
                    "status": "success",
                    "data": {
                        "messages": [
                            {"text": m.get("text"), "user": m.get("user"), "ts": m.get("ts")}
                            for m in result.get("messages", [])
                        ]
                    }
                }
            elif tool_name == "slack_list_channels":
                result = await self.list_channels(params.get("limit", 100))
                return {
                    "status": "success",
                    "data": {
                        "channels": [
                            {"id": c.get("id"), "name": c.get("name"), "is_channel": c.get("is_channel")}
                            for c in result.get("channels", [])
                        ]
                    }
                }
            elif tool_name == "slack_search_messages":
                result = await self.search_messages(params["query"], params.get("count", 20))
                matches = result.get("messages", {}).get("matches", [])
                return {
                    "status": "success",
                    "data": {
                        "matches": [
                            {"text": m.get("text"), "username": m.get("username"), "ts": m.get("ts"), "channel": m.get("channel", {}).get("name")}
                            for m in matches
                        ]
                    }
                }
            else:
                return {"status": "error", "message": f"Unknown tool: {tool_name}"}

        except Exception as e:
            logger.error(f"Slack execution error: {e}")
            return {"status": "error", "message": str(e)}
