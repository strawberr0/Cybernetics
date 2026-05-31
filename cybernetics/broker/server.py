"""FastAPI MCP Broker — SSE endpoint, tool routing, auth."""

from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, HTTPException, Depends
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.security import HTTPBearer
import json
import asyncio

from cybernetics.config.settings import settings
from cybernetics.logging.logger import configure_logging, get_logger
from cybernetics.auth.middleware import APIKeyAuth, require_api_key
from cybernetics.registry.manager import Registry, auto_discover
from cybernetics.health.checks import registry as health_registry, HealthCheck, HealthStatus
from cybernetics.circuit.breaker import get_breaker, _breakers

# Auto-discover and register all adapters from cybernetics/adapters/
auto_discover()

logger = get_logger("cybernetics.broker")
bearer = HTTPBearer()

# Global registry
mcp_registry = Registry()


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging(settings.log_level)
    logger.info("broker_startup", environment=settings.environment)
    # Load adapters based on config or all by default
    mcp_registry.load(list(ADAPTER_MAP.keys()))
    # Register health probes
    health_registry.register(lambda: _adapter_health_probe())
    yield
    logger.info("broker_shutdown")
    await mcp_registry.close_all()


app = FastAPI(title="Cybernetics MCP Broker", version="2026.5.2", lifespan=lifespan)
app.add_middleware(APIKeyAuth)


async def _adapter_health_probe() -> HealthCheck:
    checks = await mcp_registry.health()
    healthy = sum(1 for v in checks.values() if v.get("status") == "healthy")
    total = len(checks)
    status = HealthStatus.HEALTHY if healthy == total else (HealthStatus.DEGRADED if healthy > 0 else HealthStatus.UNHEALTHY)
    return HealthCheck(name="adapters", status=status, detail=f"{healthy}/{total} adapters healthy")


@app.get("/health")
async def health():
    return await health_registry.run_all()


@app.get("/mcp/tools")
async def list_tools(_: str = Depends(require_api_key)):
    return {"tools": mcp_registry.all_tools()}


@app.post("/mcp/invoke")
async def invoke_tool(request: Request, _: str = Depends(require_api_key)):
    body = await request.json()
    adapter_name = body.get("adapter")
    tool_name = body.get("tool")
    arguments = body.get("arguments", {})
    if not adapter_name or not tool_name:
        raise HTTPException(status_code=400, detail="adapter and tool required")
    result = await mcp_registry.execute(adapter_name, tool_name, arguments)
    return {"result": result}


@app.get("/mcp/sse")
async def mcp_sse(_: str = Depends(require_api_key)):
    """Server-Sent Events endpoint for real-time MCP streams."""
    async def event_stream():
        while True:
            health = await health_registry.run_all()
            yield f"data: {json.dumps({'type': 'health', 'payload': health})}\n\n"
            await asyncio.sleep(30)
    return StreamingResponse(event_stream(), media_type="text/event-stream")


@app.get("/mcp/circuits")
async def list_circuits(_: str = Depends(require_api_key)):
    return {"circuits": {name: get_breaker(name).state() for name in list(_breakers.keys())}}
