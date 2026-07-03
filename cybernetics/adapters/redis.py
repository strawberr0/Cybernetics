"""Redis adapter — keys, streams, pub/sub via aioredis."""

from typing import Dict, Any, List, Optional
from cybernetics.adapters.base import MCPAdapter
from cybernetics.config.settings import settings
from cybernetics.circuit.breaker import circuit
from cybernetics.logging.logger import get_logger

logger = get_logger("cybernetics.adapters.redis")


class RedisAdapter(MCPAdapter):
    name = "redis"
    description = "Redis — keys, streams, pub/sub"

    def __init__(self):
        super().__init__()
        self._url = settings.redis_url
        self._redis = None
        self.register_tool("redis_get", "Get a key", {"key": {"type": "string"}}, ["key"], self._get)
        self.register_tool("redis_set", "Set a key", {"key": {"type": "string"}, "value": {"type": "string"}, "ttl": {"type": "integer", "default": 0}}, ["key", "value"], self._set)
        self.register_tool("redis_publish", "Publish to a channel", {"channel": {"type": "string"}, "message": {"type": "string"}}, ["channel", "message"], self._publish)
        self.register_tool("redis_stream_read", "Read from a stream", {"stream": {"type": "string"}, "count": {"type": "integer", "default": 10}}, ["stream"], self._stream_read)

    async def _get_client(self):
        if self._redis is None:
            import aioredis
            self._redis = aioredis.from_url(self._url)
        return self._redis

    @circuit("redis", failure_threshold=5, recovery_timeout=60)
    async def _get(self, key: str) -> Optional[str]:
        client = await self._get_client()
        return await client.get(key)

    @circuit("redis", failure_threshold=5, recovery_timeout=60)
    async def _set(self, key: str, value: str, ttl: int = 0) -> bool:
        client = await self._get_client()
        if ttl:
            await client.setex(key, ttl, value)
        else:
            await client.set(key, value)
        return True

    @circuit("redis", failure_threshold=5, recovery_timeout=60)
    async def _publish(self, channel: str, message: str) -> int:
        client = await self._get_client()
        return await client.publish(channel, message)

    @circuit("redis", failure_threshold=5, recovery_timeout=60)
    async def _stream_read(self, stream: str, count: int = 10) -> List[Dict[str, Any]]:
        client = await self._get_client()
        msgs = await client.xread({stream: "0"}, count=count)
        results = []
        for stream_entry in msgs:
            # stream_entry: [stream_name, [(entry_id, fields), ...]]
            for msg_id, fields in stream_entry[1]:
                _id = msg_id.decode() if isinstance(msg_id, bytes) else msg_id
                _fields = {k.decode() if isinstance(k, bytes) else k: v.decode() if isinstance(v, bytes) else v for k, v in fields.items()}
                results.append({"id": _id, "fields": _fields})
        return results

    async def health(self) -> Dict[str, Any]:
        try:
            client = await self._get_client()
            await client.ping()
            return {"status": "healthy"}
        except Exception as exc:
            return {"status": "unhealthy", "error": str(exc)}

    async def close(self) -> None:
        if self._redis:
            await self._redis.close()
