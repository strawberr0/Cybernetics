"""Linear adapter for issue tracking and project management."""
import httpx
from typing import Dict, Any, List
from cybernetics.adapters.base import MCPAdapter
from cybernetics.config.settings import settings
from cybernetics.circuit.breaker import circuit
from cybernetics.logging.logger import get_logger

logger = get_logger("cybernetics.adapters.linear")


class LinearAdapter(MCPAdapter):
    name = "linear"
    description = "Linear project management integration"

    def __init__(self):
        super().__init__()
        self._token = settings.linear_api_key
        self._client = httpx.AsyncClient(
            base_url="https://api.linear.app",
            headers={
                "Authorization": self._token,
                "Content-Type": "application/json",
            },
            timeout=httpx.Timeout(30.0),
        )
        self.register_tool(
            "linear_create_issue",
            "Create a Linear issue",
            {
                "team_id": {"type": "string"},
                "title": {"type": "string"},
                "description": {"type": "string", "default": ""},
                "state_id": {"type": "string", "default": ""},
                "label_ids": {"type": "array", "items": {"type": "string"}, "default": []},
            },
            ["team_id", "title"],
            self._create_issue,
        )
        self.register_tool(
            "linear_list_issues",
            "List issues with optional filters",
            {
                "team_id": {"type": "string", "default": ""},
                "state": {"type": "string", "default": ""},
                "assignee_id": {"type": "string", "default": ""},
                "limit": {"type": "integer", "default": 50},
            },
            [],
            self._list_issues,
        )
        self.register_tool(
            "linear_update_issue",
            "Update issue state or properties",
            {
                "issue_id": {"type": "string"},
                "state_id": {"type": "string", "default": ""},
                "assignee_id": {"type": "string", "default": ""},
                "title": {"type": "string", "default": ""},
            },
            ["issue_id"],
            self._update_issue,
        )
        self.register_tool(
            "linear_get_teams",
            "List teams in workspace",
            {},
            [],
            self._get_teams,
        )
        self.register_tool(
            "linear_search_issues",
            "Search issues by text",
            {"query": {"type": "string"}, "limit": {"type": "integer", "default": 20}},
            ["query"],
            self._search_issues,
        )
        self.register_tool(
            "linear_create_comment",
            "Add comment to an issue",
            {"issue_id": {"type": "string"}, "body": {"type": "string"}},
            ["issue_id", "body"],
            self._create_comment,
        )

    async def _graphql(self, query: str, variables: dict = None):
        body = {"query": query}
        if variables:
            body["variables"] = variables
        r = await self._client.post("/graphql", json=body)
        data = r.json()
        if "errors" in data:
            raise RuntimeError(data["errors"][0]["message"])
        return data["data"]

    @circuit("linear", failure_threshold=5, recovery_timeout=60)
    async def _create_issue(self, team_id: str, title: str, description: str = "", state_id: str = "", label_ids: list = None):
        q = """
        mutation CreateIssue($input: IssueCreateInput!) {
            issueCreate(input: $input) { success issue { id identifier url } }
        }"""
        inp = {"teamId": team_id, "title": title, "description": description}
        if state_id:
            inp["stateId"] = state_id
        if label_ids:
            inp["labelIds"] = label_ids
        data = await self._graphql(q, {"input": inp})
        return data["issueCreate"]["issue"]

    @circuit("linear", failure_threshold=5, recovery_timeout=60)
    async def _list_issues(self, team_id: str = "", state: str = "", assignee_id: str = "", limit: int = 50):
        filters = []
        if team_id:
            filters.append(f'team: {{ id: {{ eq: "{team_id}" }} }}')
        if state:
            filters.append(f'state: {{ name: {{ eq: "{state}" }} }}')
        if assignee_id:
            filters.append(f'assignee: {{ id: {{ eq: "{assignee_id}" }} }}')
        filter_str = ", ".join(filters) if filters else ""
        q = f"""
        query {{
            issues(first: {limit}, filter: {{ {filter_str} }}) {{
                nodes {{ id identifier title state {{ name }} assignee {{ name }} }}
            }}
        }}"""
        data = await self._graphql(q)
        return {"issues": data["issues"]["nodes"]}

    @circuit("linear", failure_threshold=5, recovery_timeout=60)
    async def _update_issue(self, issue_id: str, state_id: str = "", assignee_id: str = "", title: str = ""):
        q = """
        mutation UpdateIssue($id: String!, $input: IssueUpdateInput!) {
            issueUpdate(id: $id, input: $input) { success issue { id identifier } }
        }"""
        inp = {}
        if state_id:
            inp["stateId"] = state_id
        if assignee_id:
            inp["assigneeId"] = assignee_id
        if title:
            inp["title"] = title
        data = await self._graphql(q, {"id": issue_id, "input": inp})
        return data["issueUpdate"]["issue"]

    @circuit("linear", failure_threshold=5, recovery_timeout=60)
    async def _get_teams(self):
        q = "query { teams { nodes { id name key } } }"
        data = await self._graphql(q)
        return {"teams": data["teams"]["nodes"]}

    @circuit("linear", failure_threshold=5, recovery_timeout=60)
    async def _search_issues(self, query: str, limit: int = 20):
        q = f"""
        query {{
            issues(filter: {{ title: {{ contains: "{query}" }} }}, first: {limit}) {{
                nodes {{ id identifier title state {{ name }} }}
            }}
        }}"""
        data = await self._graphql(q)
        return {"issues": data["issues"]["nodes"]}

    @circuit("linear", failure_threshold=5, recovery_timeout=60)
    async def _create_comment(self, issue_id: str, body: str):
        q = """
        mutation CreateComment($input: CommentCreateInput!) {
            commentCreate(input: $input) { success comment { id body } }
        }"""
        data = await self._graphql(q, {"input": {"issueId": issue_id, "body": body}})
        return data["commentCreate"]["comment"]

    async def health(self) -> Dict[str, Any]:
        if not self._token:
            return {"status": "unhealthy", "reason": "LINEAR_API_KEY not set"}
        try:
            await self._graphql("query { viewer { id name } }")
            return {"status": "healthy"}
        except Exception as exc:
            return {"status": "unhealthy", "error": str(exc)}

    async def close(self) -> None:
        await self._client.aclose()
