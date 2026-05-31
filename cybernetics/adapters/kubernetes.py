"""Kubernetes adapter for cluster operations via kubectl / in-cluster API."""

from typing import Dict, Any, List
from cybernetics.adapters.base import MCPAdapter
from cybernetics.config.settings import settings
from cybernetics.circuit.breaker import circuit
from cybernetics.logging.logger import get_logger

logger = get_logger("cybernetics.adapters.kubernetes")


class KubernetesAdapter(MCPAdapter):
    name = "kubernetes"
    description = "Kubernetes cluster operations via official client or subprocess kubectl"

    def __init__(self):
        super().__init__()
        self._context = settings.kubeconfig_context
        self._namespace = settings.kubernetes_namespace
        self._setup_tools()

    def _setup_tools(self):
        self.register_tool(
            "k8s_list_pods",
            "List pods in a namespace",
            {
                "namespace": {"type": "string", "default": self._namespace},
                "label_selector": {"type": "string", "default": ""},
            },
            [],
            self._list_pods,
        )
        self.register_tool(
            "k8s_get_pod_logs",
            "Get logs from a pod",
            {
                "name": {"type": "string"},
                "namespace": {"type": "string", "default": self._namespace},
                "container": {"type": "string", "default": ""},
                "tail": {"type": "integer", "default": 100},
            },
            ["name"],
            self._get_pod_logs,
        )
        self.register_tool(
            "k8s_describe_pod",
            "Describe pod details (events, status, conditions)",
            {"name": {"type": "string"}, "namespace": {"type": "string", "default": self._namespace}},
            ["name"],
            self._describe_pod,
        )
        self.register_tool(
            "k8s_scale_deployment",
            "Scale a deployment replicas",
            {
                "name": {"type": "string"},
                "namespace": {"type": "string", "default": self._namespace},
                "replicas": {"type": "integer"},
            },
            ["name", "replicas"],
            self._scale_deployment,
        )
        self.register_tool(
            "k8s_restart_deployment",
            "Restart a deployment (rolling restart)",
            {"name": {"type": "string"}, "namespace": {"type": "string", "default": self._namespace}},
            ["name"],
            self._restart_deployment,
        )
        self.register_tool(
            "k8s_list_deployments",
            "List deployments",
            {"namespace": {"type": "string", "default": self._namespace}},
            [],
            self._list_deployments,
        )
        self.register_tool(
            "k8s_list_services",
            "List services and their endpoints",
            {"namespace": {"type": "string", "default": self._namespace}},
            [],
            self._list_services,
        )
        self.register_tool(
            "k8s_exec_command",
            "Execute a command inside a pod",
            {
                "name": {"type": "string"},
                "namespace": {"type": "string", "default": self._namespace},
                "command": {"type": "array", "items": {"type": "string"}, "description": "Command args list"},
            },
            ["name", "command"],
            self._exec_command,
        )

    def _k8s_client(self):
        try:
            from kubernetes import client, config
            if settings.kubernetes_service_host:
                config.load_incluster_config()
            else:
                config.load_kube_config(context=self._context or None)
            return client.CoreV1Api(), client.AppsV1Api()
        except ImportError:
            return None, None

    @circuit("kubernetes", failure_threshold=5, recovery_timeout=60)
    async def _list_pods(self, namespace: str = "", label_selector: str = ""):
        core, _ = self._k8s_client()
        if not core:
            return {"note": "kubernetes client not installed; use subprocess fallback"}
        ns = namespace or self._namespace
        pods = core.list_namespaced_pod(namespace=ns, label_selector=label_selector or None)
        return {"pods": [{"name": p.metadata.name, "status": p.status.phase, "ip": p.status.pod_ip} for p in pods.items]}

    @circuit("kubernetes", failure_threshold=5, recovery_timeout=60)
    async def _get_pod_logs(self, name: str, namespace: str = "", container: str = "", tail: int = 100):
        core, _ = self._k8s_client()
        if not core:
            return {"note": "kubernetes client not installed"}
        ns = namespace or self._namespace
        kwargs = {"namespace": ns, "name": name, "tail_lines": tail}
        if container:
            kwargs["container"] = container
        logs = core.read_namespaced_pod_log(**kwargs)
        return {"pod": name, "logs": logs}

    @circuit("kubernetes", failure_threshold=5, recovery_timeout=60)
    async def _describe_pod(self, name: str, namespace: str = ""):
        core, _ = self._k8s_client()
        if not core:
            return {"note": "kubernetes client not installed"}
        ns = namespace or self._namespace
        pod = core.read_namespaced_pod(name=name, namespace=ns)
        events = core.list_namespaced_event(namespace=ns, field_selector=f"involvedObject.name={name}")
        return {
            "name": pod.metadata.name,
            "phase": pod.status.phase,
            "conditions": [{"type": c.type, "status": c.status} for c in (pod.status.conditions or [])],
            "events": [{"reason": e.reason, "message": e.message, "type": e.type} for e in events.items],
        }

    @circuit("kubernetes", failure_threshold=5, recovery_timeout=60)
    async def _scale_deployment(self, name: str, replicas: int, namespace: str = ""):
        _, apps = self._k8s_client()
        if not apps:
            return {"note": "kubernetes client not installed"}
        ns = namespace or self._namespace
        patch = {"spec": {"replicas": replicas}}
        apps.patch_namespaced_deployment_scale(name=name, namespace=ns, body=patch)
        return {"deployment": name, "replicas": replicas}

    @circuit("kubernetes", failure_threshold=5, recovery_timeout=60)
    async def _restart_deployment(self, name: str, namespace: str = ""):
        _, apps = self._k8s_client()
        if not apps:
            return {"note": "kubernetes client not installed"}
        ns = namespace or self._namespace
        from kubernetes import client
        now = client.V1Time()
        patch = {
            "spec": {
                "template": {
                    "metadata": {
                        "annotations": {"kubectl.kubernetes.io/restartedAt": now.to_str() if hasattr(now, "to_str") else str(now)}
                    }
                }
            }
        }
        apps.patch_namespaced_deployment(name=name, namespace=ns, body=patch)
        return {"deployment": name, "restarted": True}

    @circuit("kubernetes", failure_threshold=5, recovery_timeout=60)
    async def _list_deployments(self, namespace: str = ""):
        _, apps = self._k8s_client()
        if not apps:
            return {"note": "kubernetes client not installed"}
        ns = namespace or self._namespace
        deps = apps.list_namespaced_deployment(namespace=ns)
        return {"deployments": [{"name": d.metadata.name, "replicas": d.spec.replicas, "available": d.status.available_replicas} for d in deps.items]}

    @circuit("kubernetes", failure_threshold=5, recovery_timeout=60)
    async def _list_services(self, namespace: str = ""):
        core, _ = self._k8s_client()
        if not core:
            return {"note": "kubernetes client not installed"}
        ns = namespace or self._namespace
        svcs = core.list_namespaced_service(namespace=ns)
        return {"services": [{"name": s.metadata.name, "cluster_ip": s.spec.cluster_ip, "ports": [{"port": p.port, "protocol": p.protocol} for p in (s.spec.ports or [])]} for s in svcs.items]}

    @circuit("kubernetes", failure_threshold=5, recovery_timeout=60)
    async def _exec_command(self, name: str, command: List[str], namespace: str = ""):
        core, _ = self._k8s_client()
        if not core:
            return {"note": "kubernetes client not installed"}
        ns = namespace or self._namespace
        from kubernetes import client
        exec_command = client.V1PodExecOptions(command=command, stderr=True, stdout=True, tty=False)
        resp = core.connect_get_namespaced_pod_exec(name=name, namespace=ns, command=command, stderr=True, stdout=True)
        return {"pod": name, "output": resp}

    async def health(self) -> Dict[str, Any]:
        core, _ = self._k8s_client()
        if not core:
            return {"status": "degraded", "reason": "kubernetes python client not installed"}
        try:
            core.list_namespace()
            return {"status": "healthy"}
        except Exception as exc:
            return {"status": "unhealthy", "error": str(exc)}

    async def close(self) -> None:
        pass
