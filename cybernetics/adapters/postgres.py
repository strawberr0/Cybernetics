"""Postgres adapter — async via asyncpg + SQLAlchemy."""

from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
import asyncpg
from sqlalchemy import MetaData, Table, Column, String, Integer, DateTime, JSON, ForeignKey, Index, text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncEngine
from sqlalchemy.dialects.postgresql import JSONB
from cybernetics.adapters.base import MCPAdapter
from cybernetics.config.settings import settings
from cybernetics.circuit.breaker import circuit
from cybernetics.logging.logger import get_logger

logger = get_logger("cybernetics.adapters.postgres")


class PostgresAdapter(MCPAdapter):
    name = "postgres"
    description = "Postgres — structured incident memory, patterns, and agent state"

    def __init__(self):
        super().__init__()
        self.dsn = settings.postgres_dsn
        self.engine: Optional[AsyncEngine] = None
        self._init_schema()
        self.register_tool("postgres_recall_pattern", "Recall a learned pattern", {"pattern_signature": {"type": "string"}}, ["pattern_signature"], self._recall_pattern)
        self.register_tool("postgres_store_pattern", "Store/update a pattern", {"pattern_signature": {"type": "string"}, "diagnosis": {"type": "string"}, "action": {"type": "string"}, "outcome": {"type": "string"}}, ["pattern_signature", "diagnosis", "action", "outcome"], self._store_pattern)
        self.register_tool("postgres_log_incident", "Log an incident", {"incident": {"type": "object"}}, ["incident"], self._log_incident)
        self.register_tool("postgres_get_recent_incidents", "Fetch recent incidents", {"service": {"type": "string"}, "limit": {"type": "integer"}}, ["service"], self._get_recent_incidents)

    def _init_schema(self):
        self.engine = create_async_engine(self.dsn, pool_size=20, max_overflow=10, echo=False)
        self.metadata = MetaData()
        self.patterns = Table(
            "patterns", self.metadata,
            Column("id", Integer, primary_key=True, autoincrement=True),
            Column("signature", String(512), nullable=False, unique=True),
            Column("diagnosis", String(2048)),
            Column("action", String(2048)),
            Column("outcome", String(64)),
            Column("occurrence_count", Integer, default=1),
            Column("last_seen", DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)),
            Column("metadata", JSONB, default=dict),
            Index("idx_patterns_signature", "signature"),
            Index("idx_patterns_last_seen", "last_seen"),
        )
        self.incidents = Table(
            "incidents", self.metadata,
            Column("id", Integer, primary_key=True, autoincrement=True),
            Column("service", String(256), nullable=False),
            Column("problem_title", String(512)),
            Column("diagnosis", String(2048)),
            Column("action", String(2048)),
            Column("outcome", String(64)),
            Column("issue_iid", String(64)),
            Column("judge_score", String(32)),
            Column("session_id", String(128)),
            Column("created_at", DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)),
            Column("payload", JSONB, default=dict),
            Index("idx_incidents_service_created", "service", "created_at"),
            Index("idx_incidents_session", "session_id"),
        )

    @circuit("postgres", failure_threshold=5, recovery_timeout=60)
    async def _recall_pattern(self, pattern_signature: str) -> Optional[Dict[str, Any]]:
        async with self.engine.begin() as conn:
            row = await conn.execute(
                self.patterns.select().where(self.patterns.c.signature == pattern_signature)
            )
            r = row.fetchone()
            if not r:
                return None
            return dict(r._mapping)

    @circuit("postgres", failure_threshold=5, recovery_timeout=60)
    async def _store_pattern(self, pattern_signature: str, diagnosis: str, action: str, outcome: str) -> None:
        async with self.engine.begin() as conn:
            await conn.execute(
                text("""
                    INSERT INTO patterns (signature, diagnosis, action, outcome, occurrence_count, last_seen)
                    VALUES (:sig, :diag, :act, :out, 1, now())
                    ON CONFLICT (signature) DO UPDATE SET
                        diagnosis = EXCLUDED.diagnosis,
                        action = EXCLUDED.action,
                        outcome = EXCLUDED.outcome,
                        occurrence_count = patterns.occurrence_count + 1,
                        last_seen = now()
                """),
                {"sig": pattern_signature, "diag": diagnosis, "act": action, "out": outcome},
            )

    @circuit("postgres", failure_threshold=5, recovery_timeout=60)
    async def _log_incident(self, incident: Dict[str, Any]) -> str:
        async with self.engine.begin() as conn:
            result = await conn.execute(
                self.incidents.insert().values(
                    service=incident.get("service", ""),
                    problem_title=incident.get("problem_title", ""),
                    diagnosis=incident.get("diagnosis", ""),
                    action=incident.get("action", ""),
                    outcome=incident.get("outcome", ""),
                    issue_iid=str(incident.get("issue_iid", "")),
                    judge_score=str(incident.get("judge_score", "")),
                    session_id=incident.get("session_id", ""),
                    created_at=datetime.now(timezone.utc),
                    payload=incident,
                ).returning(self.incidents.c.id)
            )
            row = result.fetchone()
            return str(row[0])

    @circuit("postgres", failure_threshold=5, recovery_timeout=60)
    async def _get_recent_incidents(self, service: str, limit: int = 10) -> List[Dict[str, Any]]:
        async with self.engine.begin() as conn:
            rows = await conn.execute(
                self.incidents.select()
                .where(self.incidents.c.service == service)
                .order_by(self.incidents.c.created_at.desc())
                .limit(limit)
            )
            return [dict(r._mapping) for r in rows.fetchall()]

    async def health(self) -> Dict[str, Any]:
        try:
            async with self.engine.begin() as conn:
                r = await conn.execute(text("SELECT 1"))
                await r.fetchone()
            return {"status": "healthy"}
        except Exception as exc:
            return {"status": "unhealthy", "error": str(exc)}

    async def close(self) -> None:
        if self.engine:
            await self.engine.dispose()
