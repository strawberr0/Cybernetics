"""Smoke tests for the cybernetics agent system."""

import pytest
from unittest.mock import patch, MagicMock
from cybernetics.config.settings import Settings
from cybernetics.adapters.base import MCPAdapter, ToolResult
from cybernetics.sentinels.pipeline import SentinelPipeline, Auditor, Guard, CostEstimator


class DummyAdapter(MCPAdapter):
    name = "dummy"
    def __init__(self):
        super().__init__()
        self.register_tool("echo", "Echo", {"msg": {"type": "string"}}, ["msg"], self._echo)
    async def _echo(self, msg: str):
        return {"echo": msg}
    async def health(self):
        return {"status": "healthy"}


@pytest.mark.asyncio
async def test_adapter_execute_success():
    a = DummyAdapter()
    r = await a.execute("echo", {"msg": "hello"})
    assert r.success is True
    assert r.data == {"echo": "hello"}


@pytest.mark.asyncio
async def test_adapter_execute_unknown_tool():
    a = DummyAdapter()
    r = await a.execute("nope", {})
    assert r.success is False
    assert "not found" in r.error


@pytest.mark.asyncio
async def test_sentinel_pipeline_guard_blocks_sensitive_keys():
    a = DummyAdapter()
    # The Guard sentinel checks argument keys for blocked words
    r = await a.execute("echo", {"msg": "hi", "api_token": "leak"})
    assert r.success is False
    assert "Guard blocked sensitive key" in r.error


@pytest.mark.asyncio
async def test_sentinel_pipeline_auditor_logs():
    a = DummyAdapter()
    r = await a.execute("echo", {"msg": "test"})
    assert r.success is True


def test_settings_loads_defaults():
    """Settings should load with defaults even without env vars."""
    s = Settings()
    assert s.environment in ("development", "production", "staging")
    assert isinstance(s.sentinels_enabled, list)


def test_adapter_list_tools():
    a = DummyAdapter()
    tools = a.list_tools()
    assert len(tools) == 1
    assert tools[0].name == "echo"
