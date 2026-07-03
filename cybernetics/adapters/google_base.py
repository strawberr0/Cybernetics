"""Base Google Cloud adapter — shared auth for all Google MCP servers."""

import httpx
from typing import Dict, Any, List
from cybernetics.adapters.base import MCPAdapter
from cybernetics.adapters.google_auth import get_access_token
from cybernetics.circuit.breaker import circuit
from cybernetics.logging.logger import get_logger

logger = get_logger("cybernetics.adapters.google_base")


class GoogleBaseAdapter(MCPAdapter):
    """Generic base for Google Cloud MCP adapters. Override base_url and tools in subclass."""

    _scopes: List[str] = ["https://www.googleapis.com/auth/cloud-platform"]

    def __init__(self):
        super().__init__()
        self.base_url = "https://cloud.googleapis.com"
        self.register_tool("health", "Health check", {}, [], self._health)

    def _headers(self) -> Dict[str, str]:
        token = get_access_token(self._scopes)
        return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"} if token else {}

    @circuit("google", failure_threshold=5, recovery_timeout=60)
    async def _health(self) -> Dict[str, Any]:
        return {"status": "healthy"}

    async def health(self) -> Dict[str, Any]:
        try:
            token = get_access_token(self._scopes)
            if not token:
                return {"status": "unhealthy", "error": "GOOGLE_SERVICE_ACCOUNT_KEY not set"}
            return {"status": "healthy"}
        except Exception as exc:
            return {"status": "unhealthy", "error": str(exc)}
