"""Shopify adapter — products, orders, customers, inventory."""

import httpx
from typing import Dict, Any, List
from cybernetics.adapters.base import MCPAdapter
from cybernetics.config.settings import settings
from cybernetics.circuit.breaker import circuit
from cybernetics.logging.logger import get_logger

logger = get_logger("cybernetics.adapters.shopify")


class ShopifyAdapter(MCPAdapter):
    name = "shopify"
    description = "Shopify — products, orders, customers, inventory"

    def __init__(self):
        super().__init__()
        shop_domain = settings.shopify_shop_domain or ""
        self._shop = shop_domain.rstrip("/")
        self._token = settings.shopify_access_token or ""
        self.base_url = f"https://{self._shop}.myshopify.com/admin/api/2024-10" if self._shop else ""
        self.headers = {
            "X-Shopify-Access-Token": self._token,
            "Content-Type": "application/json",
        }
        self.register_tool("shopify_list_products", "List products", {"limit": {"type": "integer", "default": 10}}, [], self._list_products)
        self.register_tool("shopify_get_order", "Get an order", {"order_id": {"type": "string"}}, ["order_id"], self._get_order)
        self.register_tool("shopify_create_draft", "Create draft order", {"line_items": {"type": "array"}, "email": {"type": "string", "default": ""}}, ["line_items"], self._create_draft)
        self.register_tool("shopify_update_inventory", "Update inventory", {"inventory_item_id": {"type": "string"}, "available": {"type": "integer"}}, ["inventory_item_id", "available"], self._update_inventory)

    @circuit("shopify", failure_threshold=5, recovery_timeout=60)
    async def _list_products(self, limit: int = 10) -> List[Dict[str, Any]]:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(f"{self.base_url}/products.json", headers=self.headers, params={"limit": limit})
            resp.raise_for_status()
            return resp.json().get("products", [])

    @circuit("shopify", failure_threshold=5, recovery_timeout=60)
    async def _get_order(self, order_id: str) -> Dict[str, Any]:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(f"{self.base_url}/orders/{order_id}.json", headers=self.headers)
            resp.raise_for_status()
            return resp.json().get("order", {})

    @circuit("shopify", failure_threshold=5, recovery_timeout=60)
    async def _create_draft(self, line_items: List[Dict[str, Any]], email: str = "") -> Dict[str, Any]:
        payload = {"draft_order": {"line_items": line_items, "email": email}}
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(f"{self.base_url}/draft_orders.json", headers=self.headers, json=payload)
            resp.raise_for_status()
            return resp.json().get("draft_order", {})

    @circuit("shopify", failure_threshold=5, recovery_timeout=60)
    async def _update_inventory(self, inventory_item_id: str, available: int) -> Dict[str, Any]:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(f"{self.base_url}/inventory_levels.json", headers=self.headers, params={"inventory_item_ids": inventory_item_id})
            resp.raise_for_status()
            levels = resp.json().get("inventory_levels", [])
            if not levels:
                return {}
            payload = {"location_id": levels[0]["location_id"], "inventory_item_id": inventory_item_id, "available": available}
            resp2 = await client.post(f"{self.base_url}/inventory_levels/set.json", headers=self.headers, json=payload)
            resp2.raise_for_status()
            return resp2.json().get("inventory_level", {})

    async def health(self) -> Dict[str, Any]:
        if not self._shop:
            return {"status": "unhealthy", "error": "SHOPIFY_SHOP_DOMAIN not set"}
        if not self._token:
            return {"status": "unhealthy", "error": "SHOPIFY_ACCESS_TOKEN not set"}
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(f"{self.base_url}/shop.json", headers=self.headers)
                resp.raise_for_status()
            return {"status": "healthy"}
        except Exception as exc:
            return {"status": "unhealthy", "error": str(exc)}
