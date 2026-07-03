"""Snowflake adapter — queries, warehouses, shares via Snowflake Connector."""

import asyncio
from typing import Dict, Any, List
from cybernetics.adapters.base import MCPAdapter
from cybernetics.config.settings import settings
from cybernetics.circuit.breaker import circuit
from cybernetics.logging.logger import get_logger

logger = get_logger("cybernetics.adapters.snowflake")


class SnowflakeAdapter(MCPAdapter):
    name = "snowflake"
    description = "Snowflake — queries, warehouses, shares"

    def __init__(self):
        super().__init__()
        self._account = settings.snowflake_account
        self._user = settings.snowflake_user
        self._password = settings.snowflake_password
        self.register_tool("snowflake_query", "Execute SQL", {"query": {"type": "string"}, "warehouse": {"type": "string", "default": ""}}, ["query"], self._query)
        self.register_tool("snowflake_list_warehouses", "List warehouses", {}, [], self._list_warehouses)
        self.register_tool("snowflake_share", "Create a share", {"share_name": {"type": "string"}, "database": {"type": "string"}}, ["share_name", "database"], self._share)

    def _conn(self):
        import snowflake.connector
        return snowflake.connector.connect(
            account=self._account,
            user=self._user,
            password=self._password,
        )

    def _run_sync(self, fn, *args, **kwargs):
        loop = asyncio.get_event_loop()
        return loop.run_in_executor(None, fn, *args, **kwargs)

    @circuit("snowflake", failure_threshold=5, recovery_timeout=60)
    async def _query(self, query: str, warehouse: str = "") -> List[Dict[str, Any]]:
        def _exec():
            conn = self._conn()
            if warehouse:
                conn.cursor().execute(f"USE WAREHOUSE {warehouse}")
            cur = conn.cursor()
            cur.execute(query)
            cols = [desc[0] for desc in cur.description] if cur.description else []
            rows = [dict(zip(cols, row)) for row in cur.fetchall()]
            conn.close()
            return rows
        return await self._run_sync(_exec)

    @circuit("snowflake", failure_threshold=5, recovery_timeout=60)
    async def _list_warehouses(self) -> List[Dict[str, Any]]:
        def _exec():
            conn = self._conn()
            cur = conn.cursor()
            cur.execute("SHOW WAREHOUSES")
            rows = cur.fetchall()
            conn.close()
            return [{"name": r[0], "state": r[2], "size": r[3]} for r in rows]
        return await self._run_sync(_exec)

    @circuit("snowflake", failure_threshold=5, recovery_timeout=60)
    async def _share(self, share_name: str, database: str) -> Dict[str, Any]:
        def _exec():
            conn = self._conn()
            cur = conn.cursor()
            cur.execute(f"CREATE SHARE {share_name}")
            cur.execute(f"GRANT USAGE ON DATABASE {database} TO SHARE {share_name}")
            conn.close()
            return {"share": share_name, "database": database}
        return await self._run_sync(_exec)

    async def health(self) -> Dict[str, Any]:
        if not self._account:
            return {"status": "unhealthy", "error": "SNOWFLAKE_ACCOUNT not set"}
        if not self._user:
            return {"status": "unhealthy", "error": "SNOWFLAKE_USER not set"}
        if not self._password:
            return {"status": "unhealthy", "error": "SNOWFLAKE_PASSWORD not set"}
        try:
            await self._query("SELECT 1")
            return {"status": "healthy"}
        except Exception as exc:
            return {"status": "unhealthy", "error": str(exc)}
