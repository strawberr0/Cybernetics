"""
MongoDB Adapter — wraps MongoDB operations as MCP-compatible tools.

Tools:
  mongodb_recall_pattern       — Recall SRE pattern
  mongodb_store_pattern        — Store SRE pattern
  mongodb_log_incident         — Log incident
  mongodb_get_recent_incidents — Query recent incidents
"""

import os
import logging
from typing import Any, Dict, List, Optional
from datetime import datetime

logger = logging.getLogger("cybernetics.adapters.mongodb")

# Safe dynamic import of motor driver to prevent startup crashes
try:
    from motor.motor_asyncio import AsyncIOMotorClient
    HAS_MOTOR = True
except ImportError:
    HAS_MOTOR = False


class MongoDBAdapter:
    def __init__(self, uri: Optional[str] = None):
        self.uri = uri or os.getenv("MONGODB_URI") or os.getenv("MONGODB_API_KEY")
        self.client = None
        self.db = None

        if HAS_MOTOR and self.uri:
            try:
                self.client = AsyncIOMotorClient(self.uri, maxPoolSize=50, minPoolSize=10)
                self.db = self.client.get_database("sentinel")
                logger.info("MongoDB: Client initialized successfully.")
            except Exception as e:
                logger.error(f"Failed to initialize MongoDB Client: {e}")

    def get_tools(self) -> list:
        """Return MongoDB tools schema for the MCP broker."""
        return [
            {
                "name": "mongodb_recall_pattern",
                "description": "Recall a learned SRE remediation pattern from MongoDB memory",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "pattern_signature": {"type": "string", "description": "Remediation pattern signature name (e.g. latency_spike)"},
                    },
                    "required": ["pattern_signature"],
                },
            },
            {
                "name": "mongodb_store_pattern",
                "description": "Store or update a learned SRE remediation pattern in MongoDB memory",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "pattern_signature": {"type": "string", "description": "Pattern signature identifier"},
                        "diagnosis": {"type": "string", "description": "SRE diagnosis of the issue"},
                        "action": {"type": "string", "description": "Remediation action taken"},
                        "outcome": {"type": "string", "description": "Outcome of the remediation"},
                    },
                    "required": ["pattern_signature", "diagnosis", "action", "outcome"],
                },
            },
            {
                "name": "mongodb_log_incident",
                "description": "Log a new system incident into the database for history and analytics",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "service": {"type": "string", "description": "Service name experiencing the issue"},
                        "message": {"type": "string", "description": "Incident details/log snippet"},
                        "severity": {"type": "string", "description": "Severity level (INFO/WARN/ERROR)"},
                    },
                    "required": ["service", "message", "severity"],
                },
            },
            {
                "name": "mongodb_get_recent_incidents",
                "description": "Fetch recent incidents for a service to trace recurring failures",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "service": {"type": "string", "description": "Service name to filter by"},
                        "limit": {"type": "integer", "description": "Max logs to retrieve (default: 10)"},
                    },
                    "required": ["service"],
                },
            },
        ]

    async def resolve(self, tool_name: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """Resolve MongoDB tool call and return response."""
        if not HAS_MOTOR:
            logger.warning("MongoDB: execute failed due to missing motor driver.")
            return {
                "status": "error",
                "message": "motor driver library is not installed. Please add motor and pymongo to requirements.txt."
            }
        if not self.uri:
            logger.warning("MongoDB: execute failed due to missing connection URI.")
            return {
                "status": "error",
                "message": "MONGODB_URI environment variable not configured."
            }

        try:
            if tool_name == "mongodb_recall_pattern":
                result = await self.db["memory"].find_one({"pattern_signature": params["pattern_signature"]})
                if result:
                    result["_id"] = str(result["_id"])  # Make JSON serializable
                    return {"status": "success", "data": result}
                return {"status": "success", "data": None}

            elif tool_name == "mongodb_store_pattern":
                await self.db["memory"].update_one(
                    {"pattern_signature": params["pattern_signature"]},
                    {
                        "$set": {
                            "diagnosis": params["diagnosis"],
                            "action": params["action"],
                            "outcome": params["outcome"],
                            "last_seen": datetime.utcnow().isoformat(),
                        },
                        "$inc": {"occurrence_count": 1},
                    },
                    upsert=True,
                )
                return {"status": "success", "message": "SRE remediation pattern stored successfully in database."}

            elif tool_name == "mongodb_log_incident":
                incident = {
                    "service": params["service"],
                    "message": params["message"],
                    "severity": params["severity"],
                    "created_at": datetime.utcnow().isoformat(),
                }
                result = await self.db["incidents"].insert_one(incident)
                return {"status": "success", "data": {"inserted_id": str(result.inserted_id)}}

            elif tool_name == "mongodb_get_recent_incidents":
                service = params["service"]
                limit = params.get("limit", 10)
                cursor = self.db["incidents"].find({"service": service}).sort("created_at", -1).limit(limit)
                docs = []
                async for doc in cursor:
                    doc["_id"] = str(doc["_id"])
                    docs.append(doc)
                return {"status": "success", "data": docs}

            else:
                return {"status": "error", "message": f"Unknown tool: {tool_name}"}

        except Exception as e:
            logger.error(f"MongoDB execution error: {e}")
            return {"status": "error", "message": str(e)}

    def close(self):
        """Close dynamic connection client."""
        if self.client:
            self.client.close()
