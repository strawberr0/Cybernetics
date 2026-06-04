"""Dynamic MCP server registry."""

import importlib
import inspect
import os
from typing import Dict, Any, List, Type
from cybernetics.adapters.base import MCPAdapter
from cybernetics.logging.logger import get_logger

logger = get_logger("cybernetics.registry")

ADAPTER_MAP: Dict[str, Type[MCPAdapter]] = {}


def register_adapter(name: str, cls: Type[MCPAdapter]) -> None:
    ADAPTER_MAP[name] = cls
    logger.info("adapter_registered", name=name)


def auto_discover() -> List[str]:
    """Scan cybernetics/adapters/ and auto-register all concrete MCPAdapter subclasses."""
    registered: List[str] = []
    adapters_dir = os.path.join(os.path.dirname(__file__), "..", "adapters")
    adapters_dir = os.path.abspath(adapters_dir)

    for filename in sorted(os.listdir(adapters_dir)):
        if not filename.endswith(".py") or filename.startswith("_"):
            continue
        module_name = f"cybernetics.adapters.{filename[:-3]}"
        try:
            module = importlib.import_module(module_name)
        except Exception as exc:
            logger.warning("adapter_discovery_failed", module=module_name, error=str(exc))
            continue

        for _attr_name, obj in inspect.getmembers(module, inspect.isclass):
            if not issubclass(obj, MCPAdapter):
                continue
            if obj is MCPAdapter:
                continue
            # Skip private/internal base classes
            if obj.__name__.startswith("_"):
                continue
            # Skip abstract classes
            if inspect.isabstract(obj):
                continue
            # Must have a concrete name
            adapter_name = getattr(obj, "name", "")
            if not adapter_name or adapter_name == "google-base":
                continue
            if adapter_name in ADAPTER_MAP:
                continue
            register_adapter(adapter_name, obj)
            registered.append(adapter_name)

    logger.info("auto_discovery_complete", count=len(registered), adapters=registered)
    return registered


class Registry:
    """Manages live MCP server adapters."""

    def __init__(self):
        self._adapters: Dict[str, MCPAdapter] = {}

    def load(self, names: List[str]) -> None:
        for name in names:
            if name not in ADAPTER_MAP:
                logger.warning("unknown_adapter", name=name)
                continue
            try:
                adapter = ADAPTER_MAP[name]()
                self._adapters[name] = adapter
                logger.info("adapter_loaded", name=name)
            except Exception as exc:
                logger.error("adapter_load_failed", name=name, error=str(exc))

    def get(self, name: str) -> MCPAdapter:
        return self._adapters[name]

    def list(self) -> List[str]:
        return list(self._adapters.keys())

    def all_tools(self) -> List[Dict[str, Any]]:
        tools = []
        for name, adapter in self._adapters.items():
            for td in adapter.list_tools():
                tools.append({
                    "name": td.name,
                    "description": td.description,
                    "parameters": td.parameters,
                    "required": td.required,
                    "adapter": name,
                })
        return tools

    async def execute(self, adapter_name: str, tool_name: str, arguments: Dict[str, Any]) -> Any:
        adapter = self._adapters.get(adapter_name)
        if not adapter:
            raise ValueError(f"Adapter '{adapter_name}' not loaded")
        return await adapter.execute(tool_name, arguments)

    async def health(self) -> Dict[str, Any]:
        checks = {}
        for name, adapter in self._adapters.items():
            checks[name] = await adapter.health()
        return checks

    async def close_all(self) -> None:
        for adapter in self._adapters.values():
            await adapter.close()
