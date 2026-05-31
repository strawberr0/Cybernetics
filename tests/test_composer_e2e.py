import pytest
import os
import time
import subprocess
from playwright.async_api import async_playwright
import http.server
import socketserver
import threading

# Directory where the built frontend lives
FRONTEND_DIST = os.path.join(os.path.dirname(__file__), "../frontend/dist")

class MockServer:
    def __init__(self, directory, port=8000):
        self.directory = directory
        self.port = port
        self.handler = http.server.SimpleHTTPRequestHandler
        self.httpd = None
        self.thread = None

    def start(self):
        class ReuseAddrHandler(self.handler):
            def __init__(hself, *args, **kwargs):
                super().__init__(*args, directory=self.directory, **kwargs)
        self.httpd = socketserver.TCPServer(("", self.port), ReuseAddrHandler, bind_and_activate=False)
        self.httpd.socket.setsockopt(socketserver.socket.SOL_SOCKET, socketserver.socket.SO_REUSEADDR, 1)
        self.httpd.server_bind()
        self.httpd.server_activate()
        self.thread = threading.Thread(target=self.httpd.serve_forever)
        self.thread.daemon = True
        self.thread.start()

    def stop(self):
        if self.httpd:
            self.httpd.shutdown()
            self.httpd.server_close()

@pytest.mark.asyncio
async def test_composer_flow():
    # Start a simple server to serve the frontend
    # We must ensure we are in the right directory or use a handler that knows the path
    # For simplicity, we'll just start it from the dist dir
    original_cwd = os.getcwd()
    server = MockServer(FRONTEND_DIST, port=8002)
    server.start()
    
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context()
            page = await context.new_page()

            # Mock API responses
            await page.route("**/api/templates", lambda route: route.fulfill(
                json={
                    "templates": [
                        {"name": "sentinel", "description": "SRE Agent", "adapters": ["dynatrace"], "phases": ["Detect"]}
                    ],
                    "adapters": ["dynatrace"]
                }
            ))

            await page.route("**/api/chat", lambda route: route.fulfill(
                json={
                    "reply": "I can help with that.",
                    "action": "none"
                }
            ))
            
            await page.route("**/api/compose", lambda route: route.fulfill(
                json={
                    "agent_code": "class SentinelAgent:\n    pass",
                    "dockerfile": "FROM python"
                }
            ))

            # Navigate to the frontend
            await page.goto("http://localhost:8002")

            # Check if we are on the composer page
            await page.wait_for_selector("text=Agent Composer")

            # 1. Test "show templates"
            input_box = page.get_by_placeholder("Message Gemini...")
            await input_box.fill("show templates")
            await input_box.press("Enter")

            # Verify templates are displayed (rendered by the frontend action logic)
            await page.wait_for_selector("text=SRE Agent")

            # 2. Test "compose"
            await input_box.fill("compose")
            await input_box.press("Enter")

            # Verify agent code is rendered
            await page.wait_for_selector("text=agent.py")
            await page.wait_for_selector("text=SentinelAgent")

            await browser.close()
    finally:
        server.stop()
        os.chdir(original_cwd)
