"""Jira adapter — issues, sprints, boards."""

import httpx
from typing import Dict, Any, List
from cybernetics.adapters.base import MCPAdapter
from cybernetics.config.settings import settings
from cybernetics.circuit.breaker import circuit
from cybernetics.logging.logger import get_logger

logger = get_logger("cybernetics.adapters.jira")


class JiraAdapter(MCPAdapter):
    name = "jira"
    description = "Jira — issues, sprints, boards"

    def __init__(self):
        super().__init__()
        self.base_url = settings.jira_url.rstrip("/")
        auth_str = f"{settings.jira_user_email}:{settings.jira_api_token}"
        import base64
        self.headers = {
            "Authorization": f"Basic {base64.b64encode(auth_str.encode()).decode()}",
            "Content-Type": "application/json",
        }
        self.register_tool("jira_create_issue", "Create an issue", {"project": {"type": "string"}, "summary": {"type": "string"}, "issue_type": {"type": "string", "default": "Task"}, "description": {"type": "string", "default": ""}}, ["project", "summary"], self._create_issue)
        self.register_tool("jira_search_issues", "Search JQL", {"jql": {"type": "string"}, "max_results": {"type": "integer", "default": 10}}, ["jql"], self._search_issues)
        self.register_tool("jira_get_sprint", "Get sprint issues", {"sprint_id": {"type": "string"}}, ["sprint_id"], self._get_sprint)
        self.register_tool("jira_transition_issue", "Transition issue", {"issue_key": {"type": "string"}, "transition_id": {"type": "string"}}, ["issue_key", "transition_id"], self._transition_issue)

    @circuit("jira", failure_threshold=5, recovery_timeout=60)
    async def _create_issue(self, project: str, summary: str, issue_type: str = "Task", description: str = "") -> Dict[str, Any]:
        payload = {"fields": {"project": {"key": project}, "summary": summary, "description": description, "issuetype": {"name": issue_type}}}
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(f"{self.base_url}/rest/api/2/issue", headers=self.headers, json=payload)
            resp.raise_for_status()
            return resp.json()

    @circuit("jira", failure_threshold=5, recovery_timeout=60)
    async def _search_issues(self, jql: str, max_results: int = 10) -> Dict[str, Any]:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(f"{self.base_url}/rest/api/2/search", headers=self.headers, params={"jql": jql, "maxResults": max_results})
            resp.raise_for_status()
            return resp.json()

    @circuit("jira", failure_threshold=5, recovery_timeout=60)
    async def _get_sprint(self, sprint_id: str) -> Dict[str, Any]:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(f"{self.base_url}/rest/agile/1.0/sprint/{sprint_id}/issue", headers=self.headers)
            resp.raise_for_status()
            return resp.json()

    @circuit("jira", failure_threshold=5, recovery_timeout=60)
    async def _transition_issue(self, issue_key: str, transition_id: str) -> None:
        payload = {"transition": {"id": transition_id}}
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(f"{self.base_url}/rest/api/2/issue/{issue_key}/transitions", headers=self.headers, json=payload)
            resp.raise_for_status()

    async def health(self) -> Dict[str, Any]:
        if not self.base_url:
            return {"status": "unhealthy", "error": "JIRA_URL not set"}
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(f"{self.base_url}/rest/api/2/myself", headers=self.headers)
                resp.raise_for_status()
            return {"status": "healthy"}
        except Exception as exc:
            return {"status": "unhealthy", "error": str(exc)}
