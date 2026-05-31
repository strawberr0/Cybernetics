"""MongoDB adapter — async via motor."""

from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from motor.motor_asyncio import AsyncIOMotorClient
from cybernetics.adapters.base import MCPAdapter
from cybernetics.config.settings import settings
from cybernetics.circuit.breaker import circuit
from cybernetics.logging.logger import get_logger

logger = get_logger("cybernetics.adapters.mongodb")


class MongoDBAdapter(MCPAdapter):
    name = "mongodb"
    description = "MongoDB memory — incident patterns, agent state"

    def __init__(self):
        super().__init__()
        self.client = AsyncIOMotorClient(settings.mongodb_uri, maxPoolSize=50, minPoolSize=10)
        self.db = self.client.get_database("sentinel")
        self.register_tool(
            "mongodb_recall_pattern",
            "Recall a learned remediation pattern",
            {"pattern_signature": {"type": "string"}},
            ["pattern_signature"],
            self._recall_pattern,
        )
        self.register_tool(
            "mongodb_store_pattern",
            "Store or update a learned pattern",
            {"pattern_signature": {"type": "string"}, "diagnosis": {"type": "string"}, "action": {"type": "string"}, "outcome": {"type": "string"}},
            ["pattern_signature", "diagnosis", "action", "outcome"],
            self._store_pattern,
        )
        self.register_tool(
            "mongodb_log_incident",
            "Log a new incident",
            {"incident": {"type": "object"}},
            ["incident"],
            self._log_incident,
        )
        self.register_tool(
            "mongodb_get_recent_incidents",
            "Fetch recent incidents for a service",
            {"service": {"type": "string"}, "limit": {"type": "integer"}},
            ["service"],
            self._get_recent_incidents,
        )

    @circuit("mongodb", failure_threshold=5, recovery_timeout=60)
    async def _recall_pattern(self, pattern_signature: str) -> Optional[Dict[str, Any]]:
        return await self.db["memory"].find_one({"pattern_signature": pattern_signature})

    @circuit("mongodb", failure_threshold=5, recovery_timeout=60)
    async def _store_pattern(self, pattern_signature: str, diagnosis: str, action: str, outcome: str) -> None:
        await self.db["memory"].update_one(
            {"pattern_signature": pattern_signature},
            {
                "$set": {
                    "diagnosis": diagnosis,
                    "action": action,
                    "outcome": outcome,
                    "last_seen": datetime.now(timezone.utc),
                },
                "$inc": {"occurrence_count": 1},
            },
            upsert=True,
        )

    @circuit("mongodb", failure_threshold=5, recovery_timeout=60)
    async def _log_incident(self, incident: Dict[str, Any]) -> str:
        incident["created_at"] = datetime.now(timezone.utc)
        result = await self.db["incidents"].insert_one(incident)
        return str(result.inserted_id)

    @circuit("mongodb", failure_threshold=5, recovery_timeout=60)
    async def _get_recent_incidents(self, service: str, limit: int = 10) -> List[Dict[str, Any]]:
        cursor = self.db["incidents"].find({"service": service}).sort("created_at", -1).limit(limit)
        return await cursor.to_list(length=limit)

    async def health(self) -> Dict[str, Any]:
        try:
            await self.client.admin.command("ping")
            return {"status": "healthy"}
        except Exception as exc:
            return {"status": "unhealthy", "error": str(exc)}

    async def close(self) -> None:
        self.client.close()
