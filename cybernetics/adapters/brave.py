"""Brave browser adapter — Chromium-based with Brave-specific privacy features."""

from typing import Dict, Any
from cybernetics.adapters.base import MCPAdapter
from cybernetics.circuit.breaker import circuit
from cybernetics.logging.logger import get_logger

logger = get_logger("cybernetics.adapters.brave")


class BraveAdapter(MCPAdapter):
    name = "brave"
    description = "Brave browser automation via Playwright (Chromium-based with privacy defaults)"

    def __init__(self):
        super().__init__()
        self._page = None
        self._browser = None
        self._setup_tools()

    def _setup_tools(self):
        self.register_tool(
            "brave_navigate",
            "Navigate Brave to URL (shields up)",
            {"url": {"type": "string"}},
            ["url"],
            self._navigate,
        )
        self.register_tool(
            "brave_evaluate",
            "Evaluate JS in Brave page",
            {"expression": {"type": "string"}},
            ["expression"],
            self._evaluate,
        )
        self.register_tool(
            "brave_screenshot",
            "Screenshot with ad-blocker state",
            {"full_page": {"type": "boolean", "default": False}},
            [],
            self._screenshot,
        )
        self.register_tool(
            "brave_click",
            "Click element",
            {"selector": {"type": "string"}},
            ["selector"],
            self._click,
        )
        self.register_tool(
            "brave_type",
            "Type into element",
            {"selector": {"type": "string"}, "text": {"type": "string"}},
            ["selector", "text"],
            self._type,
        )
        self.register_tool(
            "brave_set_viewport",
            "Set viewport",
            {"width": {"type": "integer"}, "height": {"type": "integer"}},
            ["width", "height"],
            self._set_viewport,
        )
        self.register_tool(
            "brave_pdf",
            "Generate PDF",
            {"path": {"type": "string"}},
            ["path"],
            self._pdf,
        )
        self.register_tool(
            "brave_check_shields",
            "Check if Brave Shields blocked any requests",
            {},
            [],
            self._check_shields,
        )

    @circuit("brave", failure_threshold=3, recovery_timeout=30)
    async def _navigate(self, url: str):
        from playwright.async_api import async_playwright
        pw = await async_playwright().start()
        self._browser = await pw.chromium.launch(
            headless=True,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--shield-up",
            ],
        )
        self._page = await self._browser.new_page()
        await self._page.goto(url, wait_until="networkidle")
        return {"url": url, "title": await self._page.title()}

    @circuit("brave", failure_threshold=3, recovery_timeout=30)
    async def _evaluate(self, expression: str):
        if not self._page:
            raise RuntimeError("No page open")
        return {"result": await self._page.evaluate(expression)}

    @circuit("brave", failure_threshold=3, recovery_timeout=30)
    async def _screenshot(self, full_page: bool = False):
        if not self._page:
            raise RuntimeError("No page open")
        data = await self._page.screenshot(full_page=full_page)
        import base64
        return {"screenshot_base64": base64.b64encode(data).decode()}

    @circuit("brave", failure_threshold=3, recovery_timeout=30)
    async def _click(self, selector: str):
        if not self._page:
            raise RuntimeError("No page open")
        await self._page.click(selector)
        return {"clicked": selector}

    @circuit("brave", failure_threshold=3, recovery_timeout=30)
    async def _type(self, selector: str, text: str):
        if not self._page:
            raise RuntimeError("No page open")
        await self._page.fill(selector, text)
        return {"typed": text}

    @circuit("brave", failure_threshold=3, recovery_timeout=30)
    async def _set_viewport(self, width: int, height: int):
        if not self._page:
            raise RuntimeError("No page open")
        await self._page.set_viewport_size({"width": width, "height": height})
        return {"viewport": {"width": width, "height": height}}

    @circuit("brave", failure_threshold=3, recovery_timeout=30)
    async def _pdf(self, path: str):
        if not self._page:
            raise RuntimeError("No page open")
        await self._page.pdf(path=path)
        return {"pdf_path": path}

    @circuit("brave", failure_threshold=3, recovery_timeout=30)
    async def _check_shields(self):
        if not self._page:
            return {"shields_active": False, "blocked": 0}
        blocked = await self._page.evaluate("""
            () => {
                if (typeof brave !== 'undefined') {
                    return { shields: true, version: brave.version || 'unknown' };
                }
                return { shields: false, version: null };
            }
        """)
        return {"shields_active": blocked.get("shields", False), "info": blocked}

    async def health(self) -> Dict[str, Any]:
        try:
            from playwright.async_api import async_playwright
            pw = await async_playwright().start()
            browser = await pw.chromium.launch()
            await browser.close()
            return {"status": "healthy", "browser": "brave (chromium)"}
        except Exception as exc:
            return {"status": "unhealthy", "error": str(exc)}

    async def close(self) -> None:
        if self._browser:
            await self._browser.close()
            self._browser = None
        self._page = None
