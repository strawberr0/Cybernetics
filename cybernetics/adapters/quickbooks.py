"""QuickBooks Online MCP adapter — accounting, invoices, customers, payments."""

from typing import Dict, Any
import httpx
from cybernetics.adapters.base import MCPAdapter
from cybernetics.config.settings import settings
from cybernetics.circuit.breaker import circuit
from cybernetics.logging.logger import get_logger

logger = get_logger("cybernetics.adapters.quickbooks")


class QuickBooksAdapter(MCPAdapter):
    name = "quickbooks"
    description = "QuickBooks Online — invoices, customers, payments, reports"

    def __init__(self):
        super().__init__()
        self.base_url = "https://sandbox-quickbooks.api.intuit.com" if settings.quickbooks_sandbox else "https://quickbooks.api.intuit.com"
        self.company_id = settings.quickbooks_company_id
        self._setup_tools()

    def _headers(self) -> Dict[str, str]:
        token = settings.quickbooks_access_token
        return {
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
            "Content-Type": "application/json",
        } if token else {}

    def _setup_tools(self):
        self.register_tool(
            "qb_list_customers",
            "List QuickBooks customers",
            {"limit": {"type": "integer", "default": 10}, "query": {"type": "string", "default": ""}},
            [],
            self._list_customers,
        )
        self.register_tool(
            "qb_get_customer",
            "Get a customer by ID",
            {"id": {"type": "string"}},
            ["id"],
            self._get_customer,
        )
        self.register_tool(
            "qb_create_invoice",
            "Create a QuickBooks invoice",
            {
                "customer_id": {"type": "string"},
                "line_items": {"type": "array", "items": {"type": "object"}},
                "due_date": {"type": "string", "default": ""},
            },
            ["customer_id", "line_items"],
            self._create_invoice,
        )
        self.register_tool(
            "qb_list_invoices",
            "List QuickBooks invoices",
            {"limit": {"type": "integer", "default": 10}, "customer_id": {"type": "string", "default": ""}},
            [],
            self._list_invoices,
        )
        self.register_tool(
            "qb_get_report",
            "Run a QuickBooks report (e.g. ProfitAndLoss, BalanceSheet)",
            {"report_type": {"type": "string"}, "start_date": {"type": "string"}, "end_date": {"type": "string"}},
            ["report_type", "start_date", "end_date"],
            self._get_report,
        )

    @circuit("quickbooks", failure_threshold=5, recovery_timeout=60)
    async def _list_customers(self, limit: int = 10, query: str = "") -> Dict[str, Any]:
        url = f"{self.base_url}/v3/company/{self.company_id}/query"
        sql = f"SELECT * FROM Customer MAXRESULTS {limit}"
        if query:
            sql = f"SELECT * FROM Customer WHERE DisplayName LIKE '%{query}%' MAXRESULTS {limit}"
        async with httpx.AsyncClient() as client:
            r = await client.get(url, headers=self._headers(), params={"query": sql}, timeout=30)
            r.raise_for_status()
            return r.json()

    @circuit("quickbooks", failure_threshold=5, recovery_timeout=60)
    async def _get_customer(self, id: str) -> Dict[str, Any]:
        url = f"{self.base_url}/v3/company/{self.company_id}/customer/{id}"
        async with httpx.AsyncClient() as client:
            r = await client.get(url, headers=self._headers(), timeout=30)
            r.raise_for_status()
            return r.json()

    @circuit("quickbooks", failure_threshold=5, recovery_timeout=60)
    async def _create_invoice(self, customer_id: str, line_items: list, due_date: str = "") -> Dict[str, Any]:
        url = f"{self.base_url}/v3/company/{self.company_id}/invoice"
        payload = {
            "Line": line_items,
            "CustomerRef": {"value": customer_id},
        }
        if due_date:
            payload["DueDate"] = due_date
        async with httpx.AsyncClient() as client:
            r = await client.post(url, headers=self._headers(), json=payload, timeout=30)
            r.raise_for_status()
            return r.json()

    @circuit("quickbooks", failure_threshold=5, recovery_timeout=60)
    async def _list_invoices(self, limit: int = 10, customer_id: str = "") -> Dict[str, Any]:
        url = f"{self.base_url}/v3/company/{self.company_id}/query"
        sql = f"SELECT * FROM Invoice MAXRESULTS {limit}"
        if customer_id:
            sql = f"SELECT * FROM Invoice WHERE CustomerRef = '{customer_id}' MAXRESULTS {limit}"
        async with httpx.AsyncClient() as client:
            r = await client.get(url, headers=self._headers(), params={"query": sql}, timeout=30)
            r.raise_for_status()
            return r.json()

    @circuit("quickbooks", failure_threshold=5, recovery_timeout=60)
    async def _get_report(self, report_type: str, start_date: str, end_date: str) -> Dict[str, Any]:
        url = f"{self.base_url}/v3/company/{self.company_id}/reports/{report_type}"
        async with httpx.AsyncClient() as client:
            r = await client.get(url, headers=self._headers(), params={"start_date": start_date, "end_date": end_date}, timeout=30)
            r.raise_for_status()
            return r.json()

    async def health(self) -> Dict[str, Any]:
        if not settings.quickbooks_access_token:
            return {"status": "unhealthy", "error": "QUICKBOOKS_ACCESS_TOKEN not set"}
        if not self.company_id:
            return {"status": "unhealthy", "error": "QUICKBOOKS_COMPANY_ID not set"}
        try:
            await self._list_customers(limit=1)
            return {"status": "healthy"}
        except Exception as exc:
            return {"status": "unhealthy", "error": str(exc)}

    async def close(self) -> None:
        pass
