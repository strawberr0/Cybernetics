"""
GitLab Adapter — wraps GitLab REST API as MCP-compatible tools.

Tools:
  gitlab_get_project       — Get project info
  gitlab_create_issue      — Create a new issue
  gitlab_merge_request     — Create a merge request
  gitlab_get_merge_request — Fetch merge request details
"""

import os
import aiohttp
import logging
from typing import Any, Dict, Optional

logger = logging.getLogger("cybernetics.adapters.gitlab")


class GitLabAdapter:
    def __init__(self, token: Optional[str] = None, project_id: Optional[str] = None, url: Optional[str] = None):
        self.token = token or os.getenv("GITLAB_TOKEN")
        self.project_id = project_id or os.getenv("GITLAB_PROJECT_ID", "1")
        self.base_url = (url or os.getenv("GITLAB_URL", "https://gitlab.com")).rstrip("/")
        self.headers = {"PRIVATE-TOKEN": self.token} if self.token else {}

    async def _request(self, method: str, path: str, json_data: Optional[Dict] = None, params: Optional[Dict] = None) -> Dict[str, Any]:
        url = f"{self.base_url}/api/v4{path}"
        async with aiohttp.ClientSession() as session:
            async with session.request(method, url, headers=self.headers, json=json_data, params=params, timeout=30) as resp:
                resp.raise_for_status()
                return await resp.json()

    async def get_project(self, project_id: str) -> Dict[str, Any]:
        """Get project details."""
        return await self._request("GET", f"/projects/{project_id}")

    async def create_issue(self, project_id: str, title: str, description: str) -> Dict[str, Any]:
        """Create an issue in a project."""
        data = {"title": title, "description": description}
        return await self._request("POST", f"/projects/{project_id}/issues", json_data=data)

    async def create_mr(self, source_branch: str, target_branch: str, title: str, description: str = "") -> Dict[str, Any]:
        """Create a merge request in a project."""
        data = {
            "source_branch": source_branch,
            "target_branch": target_branch,
            "title": title,
            "description": description,
        }
        return await self._request("POST", f"/projects/{self.project_id}/merge_requests", json_data=data)

    async def get_mr(self, mr_iid: int) -> Dict[str, Any]:
        """Get details of a merge request."""
        return await self._request("GET", f"/projects/{self.project_id}/merge_requests/{mr_iid}")

    def get_tools(self) -> list:
        """Return GitLab tools schema for the MCP broker."""
        return [
            {
                "name": "gitlab_get_project",
                "description": "Get project details from GitLab including stars, forks, and default branch",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "project_id": {"type": "string", "description": "Project ID or path (urlencoded if needed)"},
                    },
                    "required": ["project_id"],
                },
            },
            {
                "name": "gitlab_create_issue",
                "description": "Create a new issue in a GitLab project",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "project_id": {"type": "string", "description": "Project ID or path"},
                        "title": {"type": "string", "description": "Issue title"},
                        "description": {"type": "string", "description": "Issue description"},
                    },
                    "required": ["project_id", "title"],
                },
            },
            {
                "name": "gitlab_merge_request",
                "description": "Create a new merge request in a GitLab project",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "source_branch": {"type": "string", "description": "Source branch"},
                        "target_branch": {"type": "string", "description": "Target branch (default: main)"},
                        "title": {"type": "string", "description": "MR title"},
                        "description": {"type": "string", "description": "MR description"},
                    },
                    "required": ["source_branch", "target_branch", "title"],
                },
            },
            {
                "name": "gitlab_get_merge_request",
                "description": "Get details of an existing GitLab merge request",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "mr_iid": {"type": "integer", "description": "Merge request internal ID (IID)"},
                    },
                    "required": ["mr_iid"],
                },
            },
        ]

    async def resolve(self, tool_name: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """Resolve GitLab tool call and return response."""
        try:
            if tool_name == "gitlab_get_project":
                result = await self.get_project(params["project_id"])
                return {
                    "status": "success",
                    "data": {
                        "id": result.get("id"),
                        "name": result.get("name"),
                        "description": result.get("description"),
                        "visibility": result.get("visibility"),
                        "web_url": result.get("web_url"),
                        "stars": result.get("star_count"),
                        "forks": result.get("forks_count"),
                        "default_branch": result.get("default_branch"),
                    }
                }
            elif tool_name == "gitlab_create_issue":
                result = await self.create_issue(params["project_id"], params["title"], params.get("description", ""))
                return {
                    "status": "success",
                    "data": {
                        "iid": result.get("iid"),
                        "project_id": result.get("project_id"),
                        "title": result.get("title"),
                        "description": result.get("description"),
                        "state": result.get("state"),
                        "web_url": result.get("web_url"),
                    }
                }
            elif tool_name == "gitlab_merge_request":
                result = await self.create_mr(
                    params["source_branch"],
                    params["target_branch"],
                    params["title"],
                    params.get("description", "")
                )
                return {
                    "status": "success",
                    "data": {
                        "iid": result.get("iid"),
                        "source_branch": result.get("source_branch"),
                        "target_branch": result.get("target_branch"),
                        "title": result.get("title"),
                        "state": result.get("state"),
                        "web_url": result.get("web_url"),
                    }
                }
            elif tool_name == "gitlab_get_merge_request":
                result = await self.get_mr(params["mr_iid"])
                return {
                    "status": "success",
                    "data": {
                        "iid": result.get("iid"),
                        "source_branch": result.get("source_branch"),
                        "target_branch": result.get("target_branch"),
                        "title": result.get("title"),
                        "state": result.get("state"),
                        "web_url": result.get("web_url"),
                        "merge_status": result.get("merge_status"),
                    }
                }
            else:
                return {"status": "error", "message": f"Unknown tool: {tool_name}"}
        except aiohttp.ClientResponseError as e:
            logger.error(f"GitLab HTTP Error: {e}")
            return {"status": "error", "message": f"GitLab HTTP error: {e.status} - {e.message}"}
        except Exception as e:
            logger.error(f"Unexpected GitLab error: {e}")
            return {"status": "error", "message": str(e)}
