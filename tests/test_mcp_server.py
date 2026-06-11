"""End-to-end tests for the Cybernetics MCP stdio server.

Spawns ``python -m cybernetics.mcp.server`` as a subprocess and exchanges
JSON-RPC 2.0 frames per the MCP 2024-11-05 spec to validate the contract.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import time
from pathlib import Path
from typing import Any, Dict, Optional

import pytest

REPO_ROOT = Path(__file__).resolve().parents[1]


def _spawn() -> subprocess.Popen:
    env = os.environ.copy()
    env["PYTHONPATH"] = str(REPO_ROOT)
    return subprocess.Popen(
        [sys.executable, "-m", "cybernetics.mcp.server"],
        cwd=str(REPO_ROOT),
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        env=env,
        text=True,
        bufsize=1,
    )


def _send(proc: subprocess.Popen, msg: Dict[str, Any]) -> None:
    assert proc.stdin is not None
    proc.stdin.write(json.dumps(msg) + "\n")
    proc.stdin.flush()


def _recv(proc: subprocess.Popen, timeout: float = 5.0) -> Dict[str, Any]:
    assert proc.stdout is not None
    deadline = time.time() + timeout
    while time.time() < deadline:
        line = proc.stdout.readline()
        if line:
            return json.loads(line)
        if proc.poll() is not None:
            err = proc.stderr.read() if proc.stderr else ""
            raise RuntimeError(f"server exited prematurely: {err}")
        time.sleep(0.02)
    raise TimeoutError("no response from MCP server")


@pytest.fixture
def initialized_server():
    """Yield a started + initialized MCP server subprocess."""
    proc = _spawn()
    try:
        _send(proc, {"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {}})
        reply = _recv(proc)
        assert "result" in reply, reply
        yield proc
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=2)
        except subprocess.TimeoutExpired:
            proc.kill()


def test_initialize_handshake():
    proc = _spawn()
    try:
        _send(proc, {"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {}})
        reply = _recv(proc)
        result = reply.get("result", {})
        assert result.get("protocolVersion") == "2024-11-05"
        assert result.get("serverInfo", {}).get("name") == "cybernetics"
        assert "tools" in result.get("capabilities", {})
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=2)
        except subprocess.TimeoutExpired:
            proc.kill()


def test_tools_list_returns_tools_with_valid_schema(initialized_server):
    _send(initialized_server, {"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}})
    reply = _recv(initialized_server)
    tools = reply.get("result", {}).get("tools", [])
    assert isinstance(tools, list)
    assert len(tools) > 0, "expected at least one tool to be registered"
    sample = tools[0]
    assert "_" in sample["name"], "tool name must follow adapter_tool format"
    assert sample["inputSchema"]["type"] == "object"


def test_tools_list_includes_gitlab_adapter(initialized_server):
    _send(initialized_server, {"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}})
    reply = _recv(initialized_server)
    tools = reply.get("result", {}).get("tools", [])
    adapters = {t["name"].split("_", 1)[0] for t in tools}
    assert "gitlab" in adapters, f"gitlab adapter missing; loaded: {sorted(adapters)}"


def test_tools_call_unknown_adapter_returns_isError(initialized_server):
    _send(initialized_server, {
        "jsonrpc": "2.0", "id": 3, "method": "tools/call",
        "params": {"name": "nonexistent_foo", "arguments": {}},
    })
    reply = _recv(initialized_server)
    assert reply.get("result", {}).get("isError") is True


def test_tools_call_malformed_name_returns_invalid_params(initialized_server):
    _send(initialized_server, {
        "jsonrpc": "2.0", "id": 4, "method": "tools/call",
        "params": {"name": "noseparator", "arguments": {}},
    })
    reply = _recv(initialized_server)
    assert reply.get("error", {}).get("code") == -32602


def test_unknown_method_returns_method_not_found(initialized_server):
    _send(initialized_server, {"jsonrpc": "2.0", "id": 5, "method": "frobnicate"})
    reply = _recv(initialized_server)
    assert reply.get("error", {}).get("code") == -32601


def test_garbage_input_returns_parse_error(initialized_server):
    assert initialized_server.stdin is not None
    initialized_server.stdin.write("not-json{{{\n")
    initialized_server.stdin.flush()
    reply = _recv(initialized_server)
    assert reply.get("error", {}).get("code") == -32700


def test_calls_before_initialize_are_rejected():
    proc = _spawn()
    try:
        _send(proc, {"jsonrpc": "2.0", "id": 1, "method": "tools/list"})
        reply = _recv(proc)
        assert reply.get("error", {}).get("code") == -32000
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=2)
        except subprocess.TimeoutExpired:
            proc.kill()


def test_tools_call_real_tool_serializes_dataclass_result(initialized_server):
    """Regression: ToolResult dataclass must be JSON-serialisable."""
    _send(initialized_server, {"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}})
    tools = _recv(initialized_server).get("result", {}).get("tools", [])
    target: Optional[Dict[str, Any]] = next(
        (t for t in tools if t["name"].startswith("gitlab_")), None
    )
    assert target is not None, "expected at least one gitlab_* tool"

    _send(initialized_server, {
        "jsonrpc": "2.0", "id": 99, "method": "tools/call",
        "params": {"name": target["name"], "arguments": {}},
    })
    reply = _recv(initialized_server, timeout=10.0)
    result = reply.get("result", {})
    assert "content" in result
    text = result["content"][0]["text"]
    # Must be valid JSON, not a Python repr or "not serializable" message.
    payload = json.loads(text)
    assert "success" in payload, payload


def test_stdout_contains_only_jsonrpc_frames():
    """Regression: structlog must not corrupt stdio with log lines."""
    proc = _spawn()
    try:
        _send(proc, {"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {}})
        _send(proc, {"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}})
        for _ in range(2):
            line = _recv(proc)
            assert line.get("jsonrpc") == "2.0"
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=2)
        except subprocess.TimeoutExpired:
            proc.kill()


# ---------------------------------------------------------------------------
# JSON-RPC 2.0 spec compliance regression tests
# ---------------------------------------------------------------------------

def _drain(proc: subprocess.Popen, settle: float = 0.1) -> None:
    """Drain any queued response frames before the next assertion."""
    import select  # local import; only needed for the spec tests
    end = time.time() + settle
    while time.time() < end:
        ready, _, _ = select.select([proc.stdout], [], [], 0.02)
        if not ready:
            break
        if not proc.stdout.readline():
            break


def test_notification_receives_no_response(initialized_server):
    """JSON-RPC 2.0 §4.1: a request without `id` is a notification and MUST NOT
    receive a response, even on error."""
    import select
    _send(initialized_server, {"jsonrpc": "2.0", "method": "tools/list"})  # no id
    ready, _, _ = select.select([initialized_server.stdout], [], [], 0.4)
    assert not ready, "server replied to a notification"


def test_missing_method_returns_invalid_request(initialized_server):
    _send(initialized_server, {"jsonrpc": "2.0", "id": 100})
    reply = _recv(initialized_server)
    assert reply.get("error", {}).get("code") == -32600


def test_wrong_jsonrpc_version_returns_invalid_request(initialized_server):
    _send(initialized_server, {"jsonrpc": "1.0", "id": 101, "method": "tools/list"})
    reply = _recv(initialized_server)
    assert reply.get("error", {}).get("code") == -32600


def test_batch_request_does_not_crash_server(initialized_server):
    """JSON-RPC 2.0 §6: server must handle batch arrays without crashing."""
    _send(initialized_server, [
        {"jsonrpc": "2.0", "id": "b1", "method": "tools/list"},
        {"jsonrpc": "2.0", "id": "b2", "method": "tools/list"},
    ])
    received_ids = []
    deadline = time.time() + 2.0
    while len(received_ids) < 2 and time.time() < deadline:
        try:
            r = _recv(initialized_server, timeout=0.5)
        except TimeoutError:
            break
        if isinstance(r, list):
            received_ids.extend(item.get("id") for item in r)
        else:
            received_ids.append(r.get("id"))
    assert sorted(received_ids, key=str) == ["b1", "b2"]
    assert initialized_server.poll() is None


def test_string_id_round_trips(initialized_server):
    _drain(initialized_server)
    _send(initialized_server, {"jsonrpc": "2.0", "id": "abc-string-id", "method": "tools/list"})
    reply = _recv(initialized_server)
    assert reply.get("id") == "abc-string-id"


def test_initialized_notification_is_silent(initialized_server):
    import select
    _drain(initialized_server)
    _send(initialized_server, {"jsonrpc": "2.0", "method": "initialized"})
    ready, _, _ = select.select([initialized_server.stdout], [], [], 0.3)
    assert not ready, "server replied to the 'initialized' notification"


def test_500kb_unicode_argument_does_not_crash(initialized_server):
    """Stress: 500 KB UTF-8 argument with emoji must round-trip safely."""
    big = ("héllo 🚀 αβγ 中文 — " * 5000)[:500_000]
    _send(initialized_server, {
        "jsonrpc": "2.0", "id": "big", "method": "tools/call",
        "params": {"name": "gitlab_gitlab_get_file",
                   "arguments": {"file_path": big, "ref": "master"}},
    })
    reply = _recv(initialized_server, timeout=15.0)
    assert "result" in reply
    assert initialized_server.poll() is None


def test_100_sequential_requests_preserve_ordering(initialized_server):
    for i in range(100):
        _send(initialized_server, {"jsonrpc": "2.0", "id": i, "method": "tools/list"})
    received = [_recv(initialized_server, timeout=10.0).get("id") for _ in range(100)]
    assert received == list(range(100))


def test_closing_stdin_terminates_server_cleanly():
    proc = _spawn()
    try:
        _send(proc, {"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {}})
        _recv(proc)
        proc.stdin.close()
        deadline = time.time() + 3.0
        while time.time() < deadline and proc.poll() is None:
            time.sleep(0.05)
        assert proc.poll() is not None, "server did not exit on EOF"
        assert proc.returncode == 0
    finally:
        if proc.poll() is None:
            proc.kill()
