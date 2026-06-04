"""Chrome/Chromium adapter via Chrome DevTools Protocol (CDP) over WebSocket."""

from typing import Dict, Any
from cybernetics.adapters.base import MCPAdapter
from cybernetics.circuit.breaker import circuit
from cybernetics.logging.logger import get_logger

logger = get_logger("cybernetics.adapters.chrome")


class ChromeAdapter(MCPAdapter):
    name = "chrome"
    description = "Chrome/Chromium browser automation via CDP WebSocket"

    def __init__(self):
        super().__init__()
        self._page = None
        self._client = None
        self._setup_tools()

    def _setup_tools(self):
        self.register_tool(
            "chrome_navigate",
            "Navigate Chrome to a URL via CDP",
            {"url": {"type": "string", "description": "Target URL"}},
            ["url"],
            self._navigate,
        )
        self.register_tool(
            "chrome_evaluate",
            "Evaluate JavaScript in Chrome page context",
            {"expression": {"type": "string", "description": "JS expression"}},
            ["expression"],
            self._evaluate,
        )
        self.register_tool(
            "chrome_screenshot",
            "Capture full-page or element screenshot",
            {
                "selector": {"type": "string", "description": "CSS selector (optional)", "default": ""},
                "full_page": {"type": "boolean", "description": "Capture full page", "default": False},
            },
            [],
            self._screenshot,
        )
        self.register_tool(
            "chrome_get_network",
            "Retrieve captured network requests",
            {"limit": {"type": "integer", "description": "Max entries", "default": 100}},
            [],
            self._get_network,
        )
        self.register_tool(
            "chrome_get_console",
            "Retrieve console logs",
            {"level": {"type": "string", "description": "Filter by level", "default": ""}},
            [],
            self._get_console,
        )
        self.register_tool(
            "chrome_clear_cache",
            "Clear browser cache and cookies",
            {},
            [],
            self._clear_cache,
        )
        self.register_tool(
            "chrome_set_viewport",
            "Set viewport dimensions",
            {
                "width": {"type": "integer", "description": "Viewport width"},
                "height": {"type": "integer", "description": "Viewport height"},
            },
            ["width", "height"],
            self._set_viewport,
        )
        self.register_tool(
            "chrome_click",
            "Click element by selector",
            {"selector": {"type": "string", "description": "CSS selector"}},
            ["selector"],
            self._click,
        )
        self.register_tool(
            "chrome_type",
            "Type text into input element",
            {
                "selector": {"type": "string", "description": "CSS selector"},
                "text": {"type": "string", "description": "Text to type"},
            },
            ["selector", "text"],
            self._type,
        )
        self.register_tool(
            "chrome_pdf",
            "Generate PDF of current page",
            {
                "path": {"type": "string", "description": "Output file path"},
                "format": {"type": "string", "description": "Paper format", "default": "A4"},
            },
            ["path"],
            self._pdf,
        )

    @circuit("chrome", failure_threshold=3, recovery_timeout=30)
    async def _navigate(self, url: str):
        try:
            from playwright.async_api import async_playwright
            pw = await async_playwright().start()
            browser = await pw.chromium.launch(headless=True)
            self._client = browser
            self._page = await browser.new_page()
            await self._page.goto(url, wait_until="networkidle")
            title = await self._page.title()
            return {"url": url, "title": title}
        except Exception as exc:
            logger.error("chrome_navigate_failed", error=str(exc))
            raise

    @circuit("chrome", failure_threshold=3, recovery_timeout=30)
    async def _evaluate(self, expression: str):
        if not self._page:
            raise RuntimeError("No page open. Call chrome_navigate first.")
        result = await self._page.evaluate(expression)
        return {"result": result}

    @circuit("chrome", failure_threshold=3, recovery_timeout=30)
    async def _screenshot(self, selector: str = "", full_page: bool = False):
        if not self._page:
            raise RuntimeError("No page open. Call chrome_navigate first.")
        if selector:
            el = await self._page.query_selector(selector)
            if not el:
                return {"error": f"Element not found: {selector}"}
            data = await el.screenshot(type="png")
        else:
            data = await self._page.screenshot(full_page=full_page, type="png")
        import base64
        return {"screenshot_base64": base64.b64encode(data).decode()}

    @circuit("chrome", failure_threshold=3, recovery_timeout=30)
    async def _get_network(self, limit: int = 100):
        return {"requests": [], "note": "Network intercept requires CDP session setup"}

    @circuit("chrome", failure_threshold=3, recovery_timeout=30)
    async def _get_console(self, level: str = ""):
        return {"logs": [], "note": "Console collection requires CDP session setup"}

    @circuit("chrome", failure_threshold=3, recovery_timeout=30)
    async def _clear_cache(self):
        if not self._page:
            return {"cleared": False, "note": "No active page"}
        await self._page.context.clear_cookies()
        return {"cleared": True}

    @circuit("chrome", failure_threshold=3, recovery_timeout=30)
    async def _set_viewport(self, width: int, height: int):
        if not self._page:
            raise RuntimeError("No page open")
        await self._page.set_viewport_size({"width": width, "height": height})
        return {"viewport": {"width": width, "height": height}}

    @circuit("chrome", failure_threshold=3, recovery_timeout=30)
    async def _click(self, selector: str):
        if not self._page:
            raise RuntimeError("No page open")
        await self._page.click(selector)
        return {"clicked": selector}

    @circuit("chrome", failure_threshold=3, recovery_timeout=30)
    async def _type(self, selector: str, text: str):
        if not self._page:
            raise RuntimeError("No page open")
        await self._page.fill(selector, text)
        return {"typed": text, "into": selector}

    @circuit("chrome", failure_threshold=3, recovery_timeout=30)
    async def _pdf(self, path: str, format: str = "A4"):
        if not self._page:
            raise RuntimeError("No page open")
        await self._page.pdf(path=path, format=format)
        return {"pdf_path": path}

    async def health(self) -> Dict[str, Any]:
        try:
            from playwright.async_api import async_playwright
            pw = await async_playwright().start()
            browser = await pw.chromium.launch()
            await browser.close()
            return {"status": "healthy", "browser": "chromium"}
        except Exception as exc:
            return {"status": "unhealthy", "error": str(exc)}

    async def close(self) -> None:
        if self._client:
            await self._client.close()
            self._client = None
        self._page = None
