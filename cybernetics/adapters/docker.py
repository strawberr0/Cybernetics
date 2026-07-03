"""Docker adapter — containers, images via local REST API."""

import httpx
from typing import Dict, Any, List
from cybernetics.adapters.base import MCPAdapter
from cybernetics.config.settings import settings
from cybernetics.circuit.breaker import circuit
from cybernetics.logging.logger import get_logger

logger = get_logger("cybernetics.adapters.docker")


class DockerAdapter(MCPAdapter):
    name = "docker"
    description = "Docker — containers, images, compose"

    def __init__(self):
        super().__init__()
        self.host = settings.docker_host
        self.base_url = "http://localhost"
        self.register_tool("docker_list_containers", "List running/stopped containers", {"all": {"type": "boolean", "default": True}}, [], self._list_containers)
        self.register_tool("docker_run", "Run a container", {"image": {"type": "string"}, "command": {"type": "array", "default": []}, "ports": {"type": "object", "default": {}}, "env": {"type": "object", "default": {}}}, ["image"], self._run)
        self.register_tool("docker_build", "Build an image", {"path": {"type": "string"}, "tag": {"type": "string"}}, ["path", "tag"], self._build)
        self.register_tool("docker_logs", "Get container logs", {"container_id": {"type": "string"}, "tail": {"type": "integer", "default": 100}}, ["container_id"], self._logs)

    def _client(self):
        if self.host.startswith("unix://"):
            import httpx
            transport = httpx.AsyncHTTPTransport(uds=self.host.replace("unix://", ""))
            return httpx.AsyncClient(transport=transport, timeout=30.0)
        return httpx.AsyncClient(base_url=self.host, timeout=30.0)

    @circuit("docker", failure_threshold=5, recovery_timeout=60)
    async def _list_containers(self, all: bool = True) -> List[Dict[str, Any]]:
        async with self._client() as client:
            resp = await client.get(f"{self.base_url}/v1.24/containers/json", params={"all": str(all).lower()})
            resp.raise_for_status()
            return resp.json()

    @circuit("docker", failure_threshold=5, recovery_timeout=60)
    async def _run(self, image: str, command: List[str] = None, ports: Dict[str, str] = None, env: Dict[str, str] = None) -> Dict[str, Any]:
        payload = {"Image": image, "Cmd": command or [], "HostConfig": {"PortBindings": {k: [{"HostPort": v}] for k, v in (ports or {}).items()}}}
        if env:
            payload["Env"] = [f"{k}={v}" for k, v in env.items()]
        async with self._client() as client:
            create = await client.post(f"{self.base_url}/v1.24/containers/create", json=payload)
            create.raise_for_status()
            cid = create.json()["Id"]
            await client.post(f"{self.base_url}/v1.24/containers/{cid}/start")
            return {"container_id": cid}

    @circuit("docker", failure_threshold=5, recovery_timeout=60)
    async def _build(self, path: str, tag: str) -> Dict[str, Any]:
        async with self._client() as client:
            resp = await client.post(f"{self.base_url}/v1.24/build", params={"t": tag})
            resp.raise_for_status()
            return {"stream": resp.text}

    @circuit("docker", failure_threshold=5, recovery_timeout=60)
    async def _logs(self, container_id: str, tail: int = 100) -> str:
        async with self._client() as client:
            resp = await client.get(f"{self.base_url}/v1.24/containers/{container_id}/logs", params={"stdout": "true", "stderr": "true", "tail": tail})
            resp.raise_for_status()
            return resp.text

    async def health(self) -> Dict[str, Any]:
        try:
            async with self._client() as client:
                resp = await client.get(f"{self.base_url}/v1.24/version")
                resp.raise_for_status()
            return {"status": "healthy"}
        except Exception as exc:
            return {"status": "unhealthy", "error": str(exc)}
