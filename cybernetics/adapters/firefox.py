"""Firefox adapter via Playwright (Gecko engine)."""

from typing import Dict, Any
from cybernetics.adapters.base import MCPAdapter
from cybernetics.circuit.breaker import circuit
from cybernetics.logging.logger import get_logger

logger = get_logger("cybernetics.adapters.firefox")


class FirefoxAdapter(MCPAdapter):
    name = "firefox"
    description = "Firefox browser automation via Playwright Gecko engine"

    def __init__(self):
        super().__init__()
        self._page = None
        self._browser = None
        self._setup_tools()

    def _setup_tools(self):
        self.register_tool(
            "firefox_navigate",
            "Navigate Firefox to a URL",
            {"url": {"type": "string"}},
            ["url"],
            self._navigate,
        )
        self.register_tool(
            "firefox_evaluate",
            "Evaluate JS in Firefox page context",
            {"expression": {"type": "string"}},
            ["expression"],
            self._evaluate,
        )
        self.register_tool(
            "firefox_screenshot",
            "Capture screenshot",
            {"full_page": {"type": "boolean", "default": False}},
            [],
            self._screenshot,
        )
        self.register_tool(
            "firefox_get_console",
            "Retrieve Firefox console logs",
            {},
            [],
            self._get_console,
        )
        self.register_tool(
            "firefox_click",
            "Click element by selector",
            {"selector": {"type": "string"}},
            ["selector"],
            self._click,
        )
        self.register_tool(
            "firefox_type",
            "Type into input",
            {"selector": {"type": "string"}, "text": {"type": "string"}},
            ["selector", "text"],
            self._type,
        )
        self.register_tool(
            "firefox_set_viewport",
            "Set viewport",
            {"width": {"type": "integer"}, "height": {"type": "integer"}},
            ["width", "height"],
            self._set_viewport,
        )
        self.register_tool(
            "firefox_pdf",
            "Generate PDF",
            {"path": {"type": "string"}},
            ["path"],
            self._pdf,
        )

    @circuit("firefox", failure_threshold=3, recovery_timeout=30)
    async def _navigate(self, url: str):
        from playwright.async_api import async_playwright
        pw = await async_playwright().start()
        self._browser = await pw.firefox.launch(headless=True)
        self._page = await self._browser.new_page()
        await self._page.goto(url, wait_until="networkidle")
        return {"url": url, "title": await self._page.title()}

    @circuit("firefox", failure_threshold=3, recovery_timeout=30)
    async def _evaluate(self, expression: str):
        if not self._page:
            raise RuntimeError("No page open")
        return {"result": await self._page.evaluate(expression)}

    @circuit("firefox", failure_threshold=3, recovery_timeout=30)
    async def _screenshot(self, full_page: bool = False):
        if not self._page:
            raise RuntimeError("No page open")
        data = await self._page.screenshot(full_page=full_page)
        import base64
        return {"screenshot_base64": base64.b64encode(data).decode()}

    @circuit("firefox", failure_threshold=3, recovery_timeout=30)
    async def _get_console(self):
        return {"logs": [], "note": "Console logs require listener setup"}

    @circuit("firefox", failure_threshold=3, recovery_timeout=30)
    async def _click(self, selector: str):
        if not self._page:
            raise RuntimeError("No page open")
        await self._page.click(selector)
        return {"clicked": selector}

    @circuit("firefox", failure_threshold=3, recovery_timeout=30)
    async def _type(self, selector: str, text: str):
        if not self._page:
            raise RuntimeError("No page open")
        await self._page.fill(selector, text)
        return {"typed": text}

    @circuit("firefox", failure_threshold=3, recovery_timeout=30)
    async def _set_viewport(self, width: int, height: int):
        if not self._page:
            raise RuntimeError("No page open")
        await self._page.set_viewport_size({"width": width, "height": height})
        return {"viewport": {"width": width, "height": height}}

    @circuit("firefox", failure_threshold=3, recovery_timeout=30)
    async def _pdf(self, path: str):
        if not self._page:
            raise RuntimeError("No page open")
        await self._page.pdf(path=path)
        return {"pdf_path": path}

    async def health(self) -> Dict[str, Any]:
        try:
            from playwright.async_api import async_playwright
            pw = await async_playwright().start()
            browser = await pw.firefox.launch()
            await browser.close()
            return {"status": "healthy", "browser": "firefox"}
        except Exception as exc:
            return {"status": "unhealthy", "error": str(exc)}

    async def close(self) -> None:
        if self._browser:
            await self._browser.close()
            self._browser = None
        self._page = None
