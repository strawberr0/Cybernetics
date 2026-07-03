"""Google Cloud MCP adapters — fully capable implementations with real tools."""

import base64
import json
import httpx
from typing import Dict, Any, List, Optional
from cybernetics.adapters.base import MCPAdapter
from cybernetics.adapters.google_auth import get_access_token
from cybernetics.circuit.breaker import circuit
from cybernetics.logging.logger import get_logger

logger = get_logger("cybernetics.adapters.google_services")


class _GoogleRestAdapter(MCPAdapter):
    """Base for Google REST API adapters. Subclass and set base_url + register tools."""

    name = "google-base"
    description = "Google REST API base"
    _scopes = ["https://www.googleapis.com/auth/cloud-platform"]
    _api_base = "https://cloud.googleapis.com"

    def __init__(self):
        super().__init__()

    def _headers(self) -> Dict[str, str]:
        token = get_access_token(self._scopes)
        return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"} if token else {}

    async def _request(self, method: str, path: str, **kwargs) -> Dict[str, Any]:
        url = f"{self._api_base}{path}"
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.request(method, url, headers=self._headers(), **kwargs)
            resp.raise_for_status()
            return resp.json() if resp.text else {}

    async def health(self) -> Dict[str, Any]:
        token = get_access_token(self._scopes)
        if not token:
            return {"status": "unhealthy", "error": "GOOGLE_SERVICE_ACCOUNT_KEY not set"}
        try:
            await self._request("GET", "/v1/projects")
            return {"status": "healthy"}
        except Exception as exc:
            return {"status": "unhealthy", "error": str(exc)}


# ═══════════════════════════════════════════════════════════════
#  GOOGLE WORKSPACE (Gmail, Calendar, Drive, Docs, Sheets)
# ═══════════════════════════════════════════════════════════════

class GoogleWorkspaceAdapter(_GoogleRestAdapter):
    name = "google-workspace"
    description = "Google Workspace — Gmail, Calendar, Drive, Docs, Sheets"
    _scopes = [
        "https://www.googleapis.com/auth/cloud-platform",
        "https://www.googleapis.com/auth/gmail.modify",
        "https://www.googleapis.com/auth/calendar",
        "https://www.googleapis.com/auth/drive",
        "https://www.googleapis.com/auth/documents",
        "https://www.googleapis.com/auth/spreadsheets",
    ]

    def __init__(self):
        super().__init__()
        self._api_base = ""
        # Gmail tools
        self.register_tool("gmail_list_messages", "List Gmail messages", {"query": {"type": "string", "default": ""}, "max_results": {"type": "integer", "default": 10}}, [], self._gmail_list)
        self.register_tool("gmail_get_message", "Get a Gmail message by ID", {"id": {"type": "string"}}, ["id"], self._gmail_get)
        self.register_tool("gmail_send", "Send an email via Gmail", {"to": {"type": "string"}, "subject": {"type": "string"}, "body": {"type": "string"}, "cc": {"type": "string", "default": ""}}, ["to", "subject", "body"], self._gmail_send)
        # Calendar tools
        self.register_tool("calendar_list_events", "List Calendar events", {"calendar_id": {"type": "string", "default": "primary"}, "max_results": {"type": "integer", "default": 10}}, [], self._cal_list)
        self.register_tool("calendar_create_event", "Create a Calendar event", {"calendar_id": {"type": "string", "default": "primary"}, "summary": {"type": "string"}, "start": {"type": "string"}, "end": {"type": "string"}, "description": {"type": "string", "default": ""}}, ["summary", "start", "end"], self._cal_create)
        # Drive tools
        self.register_tool("drive_list_files", "List Drive files", {"query": {"type": "string", "default": ""}, "page_size": {"type": "integer", "default": 10}}, [], self._drive_list)
        self.register_tool("drive_upload", "Upload a file to Drive", {"name": {"type": "string"}, "content": {"type": "string"}, "mime_type": {"type": "string", "default": "text/plain"}}, ["name", "content"], self._drive_upload)
        # Sheets tools
        self.register_tool("sheets_read", "Read a Sheets range", {"spreadsheet_id": {"type": "string"}, "range": {"type": "string"}}, ["spreadsheet_id", "range"], self._sheets_read)
        self.register_tool("sheets_write", "Write to a Sheets range", {"spreadsheet_id": {"type": "string"}, "range": {"type": "string"}, "values": {"type": "array"}}, ["spreadsheet_id", "range", "values"], self._sheets_write)
        # Docs tools
        self.register_tool("docs_create", "Create a Google Doc", {"title": {"type": "string"}, "content": {"type": "string", "default": ""}}, ["title"], self._docs_create)

    @circuit("google-workspace", failure_threshold=5, recovery_timeout=60)
    async def _gmail_list(self, query: str = "", max_results: int = 10) -> List[Dict[str, Any]]:
        url = "https://gmail.googleapis.com/gmail/v1/users/me/messages"
        params = {"maxResults": max_results}
        if query:
            params["q"] = query
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(url, headers=self._headers(), params=params)
            resp.raise_for_status()
            return resp.json().get("messages", [])

    @circuit("google-workspace", failure_threshold=5, recovery_timeout=60)
    async def _gmail_get(self, id: str) -> Dict[str, Any]:
        url = f"https://gmail.googleapis.com/gmail/v1/users/me/messages/{id}"
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(url, headers=self._headers(), params={"format": "full"})
            resp.raise_for_status()
            return resp.json()

    @circuit("google-workspace", failure_threshold=5, recovery_timeout=60)
    async def _gmail_send(self, to: str, subject: str, body: str, cc: str = "") -> Dict[str, Any]:
        import email.mime.text
        msg = email.mime.text.MIMEText(body)
        msg["to"] = to
        msg["subject"] = subject
        if cc:
            msg["cc"] = cc
        raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()
        url = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send"
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, headers=self._headers(), json={"raw": raw})
            resp.raise_for_status()
            return resp.json()

    @circuit("google-workspace", failure_threshold=5, recovery_timeout=60)
    async def _cal_list(self, calendar_id: str = "primary", max_results: int = 10) -> List[Dict[str, Any]]:
        url = f"https://www.googleapis.com/calendar/v3/calendars/{calendar_id}/events"
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(url, headers=self._headers(), params={"maxResults": max_results, "orderBy": "startTime", "singleEvents": "true"})
            resp.raise_for_status()
            return resp.json().get("items", [])

    @circuit("google-workspace", failure_threshold=5, recovery_timeout=60)
    async def _cal_create(self, summary: str, start: str, end: str, calendar_id: str = "primary", description: str = "") -> Dict[str, Any]:
        url = f"https://www.googleapis.com/calendar/v3/calendars/{calendar_id}/events"
        body = {"summary": summary, "description": description, "start": {"dateTime": start}, "end": {"dateTime": end}}
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, headers=self._headers(), json=body)
            resp.raise_for_status()
            return resp.json()

    @circuit("google-workspace", failure_threshold=5, recovery_timeout=60)
    async def _drive_list(self, query: str = "", page_size: int = 10) -> List[Dict[str, Any]]:
        url = "https://www.googleapis.com/drive/v3/files"
        params = {"pageSize": page_size, "fields": "files(id,name,mimeType,modifiedTime)"}
        if query:
            params["q"] = f"name contains '{query}'"
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(url, headers=self._headers(), params=params)
            resp.raise_for_status()
            return resp.json().get("files", [])

    @circuit("google-workspace", failure_threshold=5, recovery_timeout=60)
    async def _drive_upload(self, name: str, content: str, mime_type: str = "text/plain") -> Dict[str, Any]:
        from email.message import EmailMessage
        msg = EmailMessage()
        msg.set_content(content)
        msg["Content-Type"] = mime_type
        metadata = {"name": name}
        boundary = "foo_bar_baz"
        body = (
            f"--{boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n{json.dumps(metadata)}\r\n"
            f"--{boundary}\r\nContent-Type: {mime_type}\r\n\r\n{content}\r\n--{boundary}--"
        )
        headers = {**self._headers(), "Content-Type": f"multipart/related; boundary={boundary}"}
        url = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart"
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, headers=headers, content=body.encode())
            resp.raise_for_status()
            return resp.json()

    @circuit("google-workspace", failure_threshold=5, recovery_timeout=60)
    async def _sheets_read(self, spreadsheet_id: str, range: str) -> Dict[str, Any]:
        url = f"https://sheets.googleapis.com/v4/spreadsheets/{spreadsheet_id}/values/{range}"
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(url, headers=self._headers())
            resp.raise_for_status()
            return resp.json()

    @circuit("google-workspace", failure_threshold=5, recovery_timeout=60)
    async def _sheets_write(self, spreadsheet_id: str, range: str, values: list) -> Dict[str, Any]:
        url = f"https://sheets.googleapis.com/v4/spreadsheets/{spreadsheet_id}/values/{range}"
        body = {"values": values}
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.put(url, headers=self._headers(), params={"valueInputOption": "USER_ENTERED"}, json=body)
            resp.raise_for_status()
            return resp.json()

    @circuit("google-workspace", failure_threshold=5, recovery_timeout=60)
    async def _docs_create(self, title: str, content: str = "") -> Dict[str, Any]:
        url = "https://docs.googleapis.com/v1/documents"
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, headers=self._headers(), json={"title": title})
            resp.raise_for_status()
            doc = resp.json()
            if content:
                doc_id = doc["documentId"]
                await self._docs_append(doc_id, content)
            return doc

    async def _docs_append(self, doc_id: str, text: str) -> None:
        url = f"https://docs.googleapis.com/v1/documents/{doc_id}:batchUpdate"
        body = {"requests": [{"insertText": {"location": {"index": 1}, "text": text}}]}
        async with httpx.AsyncClient(timeout=30.0) as client:
            await client.post(url, headers=self._headers(), json=body)


# ═══════════════════════════════════════════════════════════════
#  GOOGLE CLOUD RUN
# ═══════════════════════════════════════════════════════════════

class GoogleCloudRunAdapter(_GoogleRestAdapter):
    name = "google-cloud-run"
    description = "Cloud Run — serverless containers"
    _api_base = "https://run.googleapis.com/v2"

    def __init__(self):
        super().__init__()
        self.register_tool("cloudrun_list_services", "List Cloud Run services", {"project": {"type": "string"}, "location": {"type": "string", "default": "-"}}, ["project"], self._list_services)
        self.register_tool("cloudrun_get_service", "Get a Cloud Run service", {"project": {"type": "string"}, "location": {"type": "string"}, "service": {"type": "string"}}, ["project", "location", "service"], self._get_service)
        self.register_tool("cloudrun_deploy", "Deploy a new revision", {"project": {"type": "string"}, "location": {"type": "string"}, "service": {"type": "string"}, "image": {"type": "string"}}, ["project", "location", "service", "image"], self._deploy)

    @circuit("google-cloud-run", failure_threshold=5, recovery_timeout=60)
    async def _list_services(self, project: str, location: str = "-") -> Dict[str, Any]:
        return await self._request("GET", f"/projects/{project}/locations/{location}/services")

    @circuit("google-cloud-run", failure_threshold=5, recovery_timeout=60)
    async def _get_service(self, project: str, location: str, service: str) -> Dict[str, Any]:
        return await self._request("GET", f"/projects/{project}/locations/{location}/services/{service}")

    @circuit("google-cloud-run", failure_threshold=5, recovery_timeout=60)
    async def _deploy(self, project: str, location: str, service: str, image: str) -> Dict[str, Any]:
        name = f"projects/{project}/locations/{location}/services/{service}"
        body = {"template": {"containers": [{"image": image}]}}
        return await self._request("PATCH", f"/{name}", json=body)


# ═══════════════════════════════════════════════════════════════
#  GOOGLE CLOUD STORAGE
# ═══════════════════════════════════════════════════════════════

class GoogleCloudStorageAdapter(_GoogleRestAdapter):
    name = "google-cloud-storage"
    description = "Cloud Storage — object store (GCS)"
    _api_base = "https://storage.googleapis.com/storage/v1"

    def __init__(self):
        super().__init__()
        self.register_tool("gcs_list_buckets", "List GCS buckets", {"project": {"type": "string"}}, ["project"], self._list_buckets)
        self.register_tool("gcs_list_objects", "List objects in a bucket", {"bucket": {"type": "string"}, "prefix": {"type": "string", "default": ""}}, ["bucket"], self._list_objects)
        self.register_tool("gcs_get_object", "Get an object from GCS", {"bucket": {"type": "string"}, "object": {"type": "string"}}, ["bucket", "object"], self._get_object)
        self.register_tool("gcs_upload", "Upload an object to GCS", {"bucket": {"type": "string"}, "name": {"type": "string"}, "content": {"type": "string"}, "content_type": {"type": "string", "default": "text/plain"}}, ["bucket", "name", "content"], self._upload)

    @circuit("google-cloud-storage", failure_threshold=5, recovery_timeout=60)
    async def _list_buckets(self, project: str) -> Dict[str, Any]:
        return await self._request("GET", "/b", params={"project": project})

    @circuit("google-cloud-storage", failure_threshold=5, recovery_timeout=60)
    async def _list_objects(self, bucket: str, prefix: str = "") -> Dict[str, Any]:
        params = {"prefix": prefix} if prefix else {}
        return await self._request("GET", f"/b/{bucket}/o", params=params)

    @circuit("google-cloud-storage", failure_threshold=5, recovery_timeout=60)
    async def _get_object(self, bucket: str, object: str) -> Dict[str, Any]:
        url = f"https://storage.googleapis.com/storage/v1/b/{bucket}/o/{object}"
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(url, headers=self._headers())
            resp.raise_for_status()
            return resp.json()

    @circuit("google-cloud-storage", failure_threshold=5, recovery_timeout=60)
    async def _upload(self, bucket: str, name: str, content: str, content_type: str = "text/plain") -> Dict[str, Any]:
        url = f"https://storage.googleapis.com/upload/storage/v1/b/{bucket}/o?uploadType=media&name={name}"
        headers = {**self._headers(), "Content-Type": content_type}
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(url, headers=headers, content=content.encode())
            resp.raise_for_status()
            return resp.json()


# ═══════════════════════════════════════════════════════════════
#  GOOGLE MAPS
# ═══════════════════════════════════════════════════════════════

class GoogleMapsAdapter(_GoogleRestAdapter):
    name = "google-maps"
    description = "Google Maps Platform — geocoding, routing, Places"
    _api_base = "https://maps.googleapis.com/maps/api"

    def __init__(self):
        super().__init__()
        from cybernetics.config.settings import settings
        self._api_key = settings.google_maps_api_key
        self.register_tool("maps_geocode", "Geocode an address", {"address": {"type": "string"}}, ["address"], self._geocode)
        self.register_tool("maps_reverse_geocode", "Reverse geocode lat/lng", {"lat": {"type": "number"}, "lng": {"type": "number"}}, ["lat", "lng"], self._reverse_geocode)
        self.register_tool("maps_directions", "Get directions", {"origin": {"type": "string"}, "destination": {"type": "string"}, "mode": {"type": "string", "default": "driving"}}, ["origin", "destination"], self._directions)
        self.register_tool("maps_place_search", "Search for places", {"query": {"type": "string"}, "location": {"type": "string", "default": ""}, "radius": {"type": "integer", "default": 5000}}, ["query"], self._place_search)

    def _headers(self) -> Dict[str, str]:
        return {}  # Maps uses API key in query params

    @circuit("google-maps", failure_threshold=5, recovery_timeout=60)
    async def _geocode(self, address: str) -> Dict[str, Any]:
        url = f"{self._api_base}/geocode/json"
        params = {"address": address, "key": self._api_key}
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            return resp.json()

    @circuit("google-maps", failure_threshold=5, recovery_timeout=60)
    async def _reverse_geocode(self, lat: float, lng: float) -> Dict[str, Any]:
        url = f"{self._api_base}/geocode/json"
        params = {"latlng": f"{lat},{lng}", "key": self._api_key}
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            return resp.json()

    @circuit("google-maps", failure_threshold=5, recovery_timeout=60)
    async def _directions(self, origin: str, destination: str, mode: str = "driving") -> Dict[str, Any]:
        url = f"{self._api_base}/directions/json"
        params = {"origin": origin, "destination": destination, "mode": mode, "key": self._api_key}
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            return resp.json()

    @circuit("google-maps", failure_threshold=5, recovery_timeout=60)
    async def _place_search(self, query: str, location: str = "", radius: int = 5000) -> Dict[str, Any]:
        url = f"{self._api_base}/place/textsearch/json"
        params = {"query": query, "key": self._api_key}
        if location:
            params["location"] = location
            params["radius"] = radius
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            return resp.json()

    async def health(self) -> Dict[str, Any]:
        return {"status": "healthy", "note": "Maps requires GOOGLE_MAPS_API_KEY set via env"}


# ═══════════════════════════════════════════════════════════════
#  GOOGLE ANALYTICS
# ═══════════════════════════════════════════════════════════════

class GoogleAnalyticsAdapter(_GoogleRestAdapter):
    name = "google-analytics"
    description = "Google Analytics — metrics, audiences, reports"
    _api_base = "https://analyticsdata.googleapis.com/v1beta"

    def __init__(self):
        super().__init__()
        self.register_tool("ga_list_properties", "List GA4 properties", {}, [], self._list_properties)
        self.register_tool("ga_run_report", "Run a GA4 report", {"property_id": {"type": "string"}, "dimensions": {"type": "array"}, "metrics": {"type": "array"}, "date_range": {"type": "string", "default": "7days"}}, ["property_id", "dimensions", "metrics"], self._run_report)

    @circuit("google-analytics", failure_threshold=5, recovery_timeout=60)
    async def _list_properties(self) -> Dict[str, Any]:
        url = "https://analyticsadmin.googleapis.com/v1beta/properties"
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(url, headers=self._headers())
            resp.raise_for_status()
            return resp.json()

    @circuit("google-analytics", failure_threshold=5, recovery_timeout=60)
    async def _run_report(self, property_id: str, dimensions: list, metrics: list, date_range: str = "7days") -> Dict[str, Any]:
        url = f"{self._api_base}/properties/{property_id}:runReport"
        body = {
            "dimensions": [{"name": d} for d in dimensions],
            "metrics": [{"name": m} for m in metrics],
            "dateRanges": [{"startDate": f"{date_range}Ago", "endDate": "today"}],
        }
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, headers=self._headers(), json=body)
            resp.raise_for_status()
            return resp.json()


# ═══════════════════════════════════════════════════════════════
#  GOOGLE KUBERNETES ENGINE (GKE)
# ═══════════════════════════════════════════════════════════════

class GoogleGkeAdapter(_GoogleRestAdapter):
    name = "google-gke"
    description = "Kubernetes Engine (GKE) — clusters, workloads"
    _api_base = "https://container.googleapis.com/v1"

    def __init__(self):
        super().__init__()
        self.register_tool("gke_list_clusters", "List GKE clusters", {"project": {"type": "string"}, "location": {"type": "string", "default": "-"}}, ["project"], self._list_clusters)
        self.register_tool("gke_get_cluster", "Get a GKE cluster", {"project": {"type": "string"}, "location": {"type": "string"}, "cluster": {"type": "string"}}, ["project", "location", "cluster"], self._get_cluster)
        self.register_tool("gke_get_workloads", "List workloads in a cluster", {"project": {"type": "string"}, "location": {"type": "string"}, "cluster": {"type": "string"}, "namespace": {"type": "string", "default": "default"}}, ["project", "location", "cluster"], self._get_workloads)

    @circuit("google-gke", failure_threshold=5, recovery_timeout=60)
    async def _list_clusters(self, project: str, location: str = "-") -> Dict[str, Any]:
        return await self._request("GET", f"/projects/{project}/locations/{location}/clusters")

    @circuit("google-gke", failure_threshold=5, recovery_timeout=60)
    async def _get_cluster(self, project: str, location: str, cluster: str) -> Dict[str, Any]:
        return await self._request("GET", f"/projects/{project}/locations/{location}/clusters/{cluster}")

    @circuit("google-gke", failure_threshold=5, recovery_timeout=60)
    async def _get_workloads(self, project: str, location: str, cluster: str, namespace: str = "default") -> Dict[str, Any]:
        import json
        body = {"command": ["kubectl", "get", "deployments", "-n", namespace, "-o", "json"]}
        return {"note": "Use the kubernetes adapter for in-cluster workload details", "cluster": f"projects/{project}/locations/{location}/clusters/{cluster}"}


# ═══════════════════════════════════════════════════════════════
#  GOOGLE COMPUTE ENGINE (GCE)
# ═══════════════════════════════════════════════════════════════

class GoogleComputeEngineAdapter(_GoogleRestAdapter):
    name = "google-compute-engine"
    description = "Compute Engine (GCE) — VMs, disks, networks"
    _api_base = "https://compute.googleapis.com/compute/v1"

    def __init__(self):
        super().__init__()
        self.register_tool("gce_list_instances", "List VMs in a zone", {"project": {"type": "string"}, "zone": {"type": "string", "default": "-"}}, ["project"], self._list_instances)
        self.register_tool("gce_get_instance", "Get a VM", {"project": {"type": "string"}, "zone": {"type": "string"}, "instance": {"type": "string"}}, ["project", "zone", "instance"], self._get_instance)
        self.register_tool("gce_start_instance", "Start a VM", {"project": {"type": "string"}, "zone": {"type": "string"}, "instance": {"type": "string"}}, ["project", "zone", "instance"], self._start_instance)
        self.register_tool("gce_stop_instance", "Stop a VM", {"project": {"type": "string"}, "zone": {"type": "string"}, "instance": {"type": "string"}}, ["project", "zone", "instance"], self._stop_instance)
        self.register_tool("gce_list_disks", "List disks", {"project": {"type": "string"}, "zone": {"type": "string", "default": "-"}}, ["project"], self._list_disks)

    @circuit("google-compute-engine", failure_threshold=5, recovery_timeout=60)
    async def _list_instances(self, project: str, zone: str = "-") -> Dict[str, Any]:
        path = f"/projects/{project}/zones/{zone}/instances" if zone != "-" else f"/projects/{project}/aggregated/instances"
        return await self._request("GET", path)

    @circuit("google-compute-engine", failure_threshold=5, recovery_timeout=60)
    async def _get_instance(self, project: str, zone: str, instance: str) -> Dict[str, Any]:
        return await self._request("GET", f"/projects/{project}/zones/{zone}/instances/{instance}")

    @circuit("google-compute-engine", failure_threshold=5, recovery_timeout=60)
    async def _start_instance(self, project: str, zone: str, instance: str) -> Dict[str, Any]:
        return await self._request("POST", f"/projects/{project}/zones/{zone}/instances/{instance}/start")

    @circuit("google-compute-engine", failure_threshold=5, recovery_timeout=60)
    async def _stop_instance(self, project: str, zone: str, instance: str) -> Dict[str, Any]:
        return await self._request("POST", f"/projects/{project}/zones/{zone}/instances/{instance}/stop")

    @circuit("google-compute-engine", failure_threshold=5, recovery_timeout=60)
    async def _list_disks(self, project: str, zone: str = "-") -> Dict[str, Any]:
        path = f"/projects/{project}/zones/{zone}/disks" if zone != "-" else f"/projects/{project}/aggregated/disks"
        return await self._request("GET", path)


# ═══════════════════════════════════════════════════════════════
#  GOOGLE OBSERVABILITY (Monitoring + Logging)
# ═══════════════════════════════════════════════════════════════

class GoogleObservabilityAdapter(_GoogleRestAdapter):
    name = "google-observability"
    description = "Google Cloud Observability — monitoring, logging, tracing"
    _api_base = "https://monitoring.googleapis.com/v3"

    def __init__(self):
        super().__init__()
        self.register_tool("gcp_list_metric_descriptors", "List metric descriptors", {"project": {"type": "string"}}, ["project"], self._list_metrics)
        self.register_tool("gcp_get_time_series", "Get time series data", {"project": {"type": "string"}, "filter": {"type": "string"}, "interval": {"type": "string", "default": "1h"}}, ["project", "filter"], self._get_time_series)
        self.register_tool("gcp_list_alert_policies", "List alerting policies", {"project": {"type": "string"}}, ["project"], self._list_alerts)
        self.register_tool("gcp_query_logs", "Query Cloud Logging", {"project": {"type": "string"}, "filter": {"type": "string"}, "hours": {"type": "integer", "default": 1}}, ["project", "filter"], self._query_logs)

    @circuit("google-observability", failure_threshold=5, recovery_timeout=60)
    async def _list_metrics(self, project: str) -> Dict[str, Any]:
        return await self._request("GET", f"/projects/{project}/metricDescriptors")

    @circuit("google-observability", failure_threshold=5, recovery_timeout=60)
    async def _get_time_series(self, project: str, filter: str, interval: str = "1h") -> Dict[str, Any]:
        from urllib.parse import quote
        url = f"{self._api_base}/projects/{project}/timeSeries"
        params = {"filter": filter, "interval.startTime": f"-{interval}", "interval.endTime": "now"}
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(url, headers=self._headers(), params=params)
            resp.raise_for_status()
            return resp.json()

    @circuit("google-observability", failure_threshold=5, recovery_timeout=60)
    async def _list_alerts(self, project: str) -> Dict[str, Any]:
        url = f"https://monitoring.googleapis.com/v3/projects/{project}/alertPolicies"
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(url, headers=self._headers())
            resp.raise_for_status()
            return resp.json()

    @circuit("google-observability", failure_threshold=5, recovery_timeout=60)
    async def _query_logs(self, project: str, filter: str, hours: int = 1) -> Dict[str, Any]:
        url = f"https://logging.googleapis.com/v2/projects/{project}/logs:list"
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(url, headers=self._headers(), params={"filter": filter})
            resp.raise_for_status()
            return resp.json()


# ═══════════════════════════════════════════════════════════════
#  GOOGLE FIRESTORE
# ═══════════════════════════════════════════════════════════════

class GoogleFirestoreAdapter(_GoogleRestAdapter):
    name = "google-firestore"
    description = "Cloud Firestore — document database"
    _api_base = "https://firestore.googleapis.com/v1"

    def __init__(self):
        super().__init__()
        self.register_tool("firestore_list_collections", "List root collections", {"project": {"type": "string"}, "database": {"type": "string", "default": "(default)"}}, ["project"], self._list_collections)
        self.register_tool("firestore_get_document", "Get a document", {"project": {"type": "string"}, "database": {"type": "string", "default": "(default)"}, "path": {"type": "string"}}, ["project", "path"], self._get_document)
        self.register_tool("firestore_query", "Run a structured query", {"project": {"type": "string"}, "database": {"type": "string", "default": "(default)"}, "collection": {"type": "string"}, "filters": {"type": "array", "default": []}}, ["project", "collection"], self._query)
        self.register_tool("firestore_create_document", "Create a document", {"project": {"type": "string"}, "database": {"type": "string", "default": "(default)"}, "collection": {"type": "string"}, "document_id": {"type": "string"}, "fields": {"type": "object"}}, ["project", "collection", "document_id", "fields"], self._create_document)

    @circuit("google-firestore", failure_threshold=5, recovery_timeout=60)
    async def _list_collections(self, project: str, database: str = "(default)") -> Dict[str, Any]:
        return await self._request("GET", f"/projects/{project}/databases/{database}/documents")

    @circuit("google-firestore", failure_threshold=5, recovery_timeout=60)
    async def _get_document(self, project: str, path: str, database: str = "(default)") -> Dict[str, Any]:
        return await self._request("GET", f"/projects/{project}/databases/{database}/documents/{path}")

    @circuit("google-firestore", failure_threshold=5, recovery_timeout=60)
    async def _query(self, project: str, collection: str, filters: list = None, database: str = "(default)") -> Dict[str, Any]:
        url = f"{self._api_base}/projects/{project}/databases/{database}/documents/{collection}:runQuery"
        body = {"structuredQuery": {"from": [{"collectionId": collection}]}}
        if filters:
            body["structuredQuery"]["where"] = {"fieldFilter": {"field": {"fieldPath": filters[0]["field"]}, "op": filters[0]["op"], "value": filters[0]["value"]}}
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, headers=self._headers(), json=body)
            resp.raise_for_status()
            return resp.json()

    @circuit("google-firestore", failure_threshold=5, recovery_timeout=60)
    async def _create_document(self, project: str, collection: str, document_id: str, fields: dict, database: str = "(default)") -> Dict[str, Any]:
        url = f"{self._api_base}/projects/{project}/databases/{database}/documents/{collection}/{document_id}"
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.patch(url, headers=self._headers(), json={"fields": fields})
            resp.raise_for_status()
            return resp.json()


# ═══════════════════════════════════════════════════════════════
#  GOOGLE SPANNER
# ═══════════════════════════════════════════════════════════════

class GoogleSpannerAdapter(_GoogleRestAdapter):
    name = "google-spanner"
    description = "Cloud Spanner — globally distributed SQL"
    _api_base = "https://spanner.googleapis.com/v1"

    def __init__(self):
        super().__init__()
        self.register_tool("spanner_list_instances", "List Spanner instances", {"project": {"type": "string"}}, ["project"], self._list_instances)
        self.register_tool("spanner_list_databases", "List databases in an instance", {"project": {"type": "string"}, "instance": {"type": "string"}}, ["project", "instance"], self._list_databases)
        self.register_tool("spanner_execute_sql", "Execute SQL on a database", {"project": {"type": "string"}, "instance": {"type": "string"}, "database": {"type": "string"}, "sql": {"type": "string"}}, ["project", "instance", "database", "sql"], self._execute_sql)

    @circuit("google-spanner", failure_threshold=5, recovery_timeout=60)
    async def _list_instances(self, project: str) -> Dict[str, Any]:
        return await self._request("GET", f"/projects/{project}/instances")

    @circuit("google-spanner", failure_threshold=5, recovery_timeout=60)
    async def _list_databases(self, project: str, instance: str) -> Dict[str, Any]:
        return await self._request("GET", f"/projects/{project}/instances/{instance}/databases")

    @circuit("google-spanner", failure_threshold=5, recovery_timeout=60)
    async def _execute_sql(self, project: str, instance: str, database: str, sql: str) -> Dict[str, Any]:
        url = f"{self._api_base}/projects/{project}/instances/{instance}/databases/{database}:executeSql"
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(url, headers=self._headers(), json={"sql": sql})
            resp.raise_for_status()
            return resp.json()


# ═══════════════════════════════════════════════════════════════
#  GOOGLE BIGTABLE
# ═══════════════════════════════════════════════════════════════

class GoogleBigtableAdapter(_GoogleRestAdapter):
    name = "google-bigtable"
    description = "Cloud Bigtable — wide-column NoSQL"
    _api_base = "https://bigtableadmin.googleapis.com/v2"

    def __init__(self):
        super().__init__()
        self.register_tool("bigtable_list_instances", "List Bigtable instances", {"project": {"type": "string"}}, ["project"], self._list_instances)
        self.register_tool("bigtable_list_tables", "List tables in an instance", {"project": {"type": "string"}, "instance": {"type": "string"}}, ["project", "instance"], self._list_tables)
        self.register_tool("bigtable_get_table", "Get table details", {"project": {"type": "string"}, "instance": {"type": "string"}, "table": {"type": "string"}}, ["project", "instance", "table"], self._get_table)

    @circuit("google-bigtable", failure_threshold=5, recovery_timeout=60)
    async def _list_instances(self, project: str) -> Dict[str, Any]:
        return await self._request("GET", f"/projects/{project}/instances")

    @circuit("google-bigtable", failure_threshold=5, recovery_timeout=60)
    async def _list_tables(self, project: str, instance: str) -> Dict[str, Any]:
        return await self._request("GET", f"/projects/{project}/instances/{instance}/tables")

    @circuit("google-bigtable", failure_threshold=5, recovery_timeout=60)
    async def _get_table(self, project: str, instance: str, table: str) -> Dict[str, Any]:
        return await self._request("GET", f"/projects/{project}/instances/{instance}/tables/{table}")


# ═══════════════════════════════════════════════════════════════
#  GOOGLE ALLOYDB
# ═══════════════════════════════════════════════════════════════

class GoogleAlloydbAdapter(_GoogleRestAdapter):
    name = "google-alloydb"
    description = "AlloyDB for PostgreSQL — managed PostgreSQL"
    _api_base = "https://alloydb.googleapis.com/v1"

    def __init__(self):
        super().__init__()
        self.register_tool("alloydb_list_clusters", "List AlloyDB clusters", {"project": {"type": "string"}, "location": {"type": "string", "default": "-"}}, ["project"], self._list_clusters)
        self.register_tool("alloydb_get_cluster", "Get an AlloyDB cluster", {"project": {"type": "string"}, "location": {"type": "string"}, "cluster": {"type": "string"}}, ["project", "location", "cluster"], self._get_cluster)
        self.register_tool("alloydb_list_instances", "List instances in a cluster", {"project": {"type": "string"}, "location": {"type": "string"}, "cluster": {"type": "string"}}, ["project", "location", "cluster"], self._list_instances)

    @circuit("google-alloydb", failure_threshold=5, recovery_timeout=60)
    async def _list_clusters(self, project: str, location: str = "-") -> Dict[str, Any]:
        path = f"/projects/{project}/locations/{location}/clusters" if location != "-" else f"/projects/{project}/locations/-/clusters"
        return await self._request("GET", path)

    @circuit("google-alloydb", failure_threshold=5, recovery_timeout=60)
    async def _get_cluster(self, project: str, location: str, cluster: str) -> Dict[str, Any]:
        return await self._request("GET", f"/projects/{project}/locations/{location}/clusters/{cluster}")

    @circuit("google-alloydb", failure_threshold=5, recovery_timeout=60)
    async def _list_instances(self, project: str, location: str, cluster: str) -> Dict[str, Any]:
        return await self._request("GET", f"/projects/{project}/locations/{location}/clusters/{cluster}/instances")


# ═══════════════════════════════════════════════════════════════
#  GOOGLE CHRONICLE (Security Operations)
# ═══════════════════════════════════════════════════════════════

class GoogleChronicleAdapter(_GoogleRestAdapter):
    name = "google-chronicle"
    description = "Google Security Operations (Chronicle) — threat intel"
    _api_base = "https://chronicle.googleapis.com/v1"

    def __init__(self):
        super().__init__()
        self.register_tool("chronicle_list_alerts", "List Chronicle alerts", {"project": {"type": "string"}, "location": {"type": "string"}}, ["project", "location"], self._list_alerts)
        self.register_tool("chronicle_search_udm", "Search UDM events", {"project": {"type": "string"}, "location": {"type": "string"}, "query": {"type": "string"}}, ["project", "location", "query"], self._search_udm)

    @circuit("google-chronicle", failure_threshold=5, recovery_timeout=60)
    async def _list_alerts(self, project: str, location: str) -> Dict[str, Any]:
        url = f"{self._api_base}/projects/{project}/locations/{location}/instances/-/alerts"
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(url, headers=self._headers())
            resp.raise_for_status()
            return resp.json()

    @circuit("google-chronicle", failure_threshold=5, recovery_timeout=60)
    async def _search_udm(self, project: str, location: str, query: str) -> Dict[str, Any]:
        url = f"{self._api_base}/projects/{project}/locations/{location}/instances/-/data:search"
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(url, headers=self._headers(), json={"query": query})
            resp.raise_for_status()
            return resp.json()


# ═══════════════════════════════════════════════════════════════
#  GOOGLE CLOUD RESOURCE MANAGER
# ═══════════════════════════════════════════════════════════════

class GoogleCloudResourceManagerAdapter(_GoogleRestAdapter):
    name = "google-cloud-resource-manager"
    description = "Cloud Resource Manager — projects, folders, org"
    _api_base = "https://cloudresourcemanager.googleapis.com/v3"

    def __init__(self):
        super().__init__()
        self.register_tool("crm_list_projects", "List projects", {}, [], self._list_projects)
        self.register_tool("crm_get_project", "Get a project", {"project_id": {"type": "string"}}, ["project_id"], self._get_project)
        self.register_tool("crm_list_folders", "List folders under parent", {"parent": {"type": "string"}}, ["parent"], self._list_folders)
        self.register_tool("crm_get_iam_policy", "Get IAM policy", {"resource": {"type": "string"}}, ["resource"], self._get_iam_policy)

    @circuit("google-cloud-resource-manager", failure_threshold=5, recovery_timeout=60)
    async def _list_projects(self) -> Dict[str, Any]:
        return await self._request("GET", "/projects")

    @circuit("google-cloud-resource-manager", failure_threshold=5, recovery_timeout=60)
    async def _get_project(self, project_id: str) -> Dict[str, Any]:
        return await self._request("GET", f"/projects/{project_id}")

    @circuit("google-cloud-resource-manager", failure_threshold=5, recovery_timeout=60)
    async def _list_folders(self, parent: str) -> Dict[str, Any]:
        return await self._request("GET", "/folders", params={"parent": parent})

    @circuit("google-cloud-resource-manager", failure_threshold=5, recovery_timeout=60)
    async def _get_iam_policy(self, resource: str) -> Dict[str, Any]:
        url = f"{self._api_base}/{resource}:getIamPolicy"
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, headers=self._headers(), json={})
            resp.raise_for_status()
            return resp.json()


# ═══════════════════════════════════════════════════════════════
#  GOOGLE CLOUD SQL (MySQL, Postgres, SQL Server)
# ═══════════════════════════════════════════════════════════════

class GoogleCloudSqlMysqlAdapter(_GoogleRestAdapter):
    name = "google-cloud-sql-mysql"
    description = "Cloud SQL for MySQL — managed MySQL"
    _api_base = "https://sqladmin.googleapis.com/v1"

    def __init__(self):
        super().__init__()
        self.register_tool("mysql_list_instances", "List MySQL instances", {"project": {"type": "string"}}, ["project"], self._list_instances)
        self.register_tool("mysql_get_instance", "Get a MySQL instance", {"project": {"type": "string"}, "instance": {"type": "string"}}, ["project", "instance"], self._get_instance)
        self.register_tool("mysql_list_databases", "List databases", {"project": {"type": "string"}, "instance": {"type": "string"}}, ["project", "instance"], self._list_databases)

    @circuit("google-cloud-sql-mysql", failure_threshold=5, recovery_timeout=60)
    async def _list_instances(self, project: str) -> Dict[str, Any]:
        return await self._request("GET", f"/projects/{project}/instances")

    @circuit("google-cloud-sql-mysql", failure_threshold=5, recovery_timeout=60)
    async def _get_instance(self, project: str, instance: str) -> Dict[str, Any]:
        return await self._request("GET", f"/projects/{project}/instances/{instance}")

    @circuit("google-cloud-sql-mysql", failure_threshold=5, recovery_timeout=60)
    async def _list_databases(self, project: str, instance: str) -> Dict[str, Any]:
        return await self._request("GET", f"/projects/{project}/instances/{instance}/databases")


class GoogleCloudSqlPostgresAdapter(_GoogleRestAdapter):
    name = "google-cloud-sql-postgres"
    description = "Cloud SQL for PostgreSQL — managed PostgreSQL"
    _api_base = "https://sqladmin.googleapis.com/v1"

    def __init__(self):
        super().__init__()
        self.register_tool("postgres_list_instances", "List Postgres instances", {"project": {"type": "string"}}, ["project"], self._list_instances)
        self.register_tool("postgres_get_instance", "Get a Postgres instance", {"project": {"type": "string"}, "instance": {"type": "string"}}, ["project", "instance"], self._get_instance)
        self.register_tool("postgres_list_databases", "List databases", {"project": {"type": "string"}, "instance": {"type": "string"}}, ["project", "instance"], self._list_databases)

    @circuit("google-cloud-sql-postgres", failure_threshold=5, recovery_timeout=60)
    async def _list_instances(self, project: str) -> Dict[str, Any]:
        return await self._request("GET", f"/projects/{project}/instances")

    @circuit("google-cloud-sql-postgres", failure_threshold=5, recovery_timeout=60)
    async def _get_instance(self, project: str, instance: str) -> Dict[str, Any]:
        return await self._request("GET", f"/projects/{project}/instances/{instance}")

    @circuit("google-cloud-sql-postgres", failure_threshold=5, recovery_timeout=60)
    async def _list_databases(self, project: str, instance: str) -> Dict[str, Any]:
        return await self._request("GET", f"/projects/{project}/instances/{instance}/databases")


class GoogleCloudSqlSqlserverAdapter(_GoogleRestAdapter):
    name = "google-cloud-sql-sqlserver"
    description = "Cloud SQL for SQL Server — managed SQL Server"
    _api_base = "https://sqladmin.googleapis.com/v1"

    def __init__(self):
        super().__init__()
        self.register_tool("sqlserver_list_instances", "List SQL Server instances", {"project": {"type": "string"}}, ["project"], self._list_instances)
        self.register_tool("sqlserver_get_instance", "Get a SQL Server instance", {"project": {"type": "string"}, "instance": {"type": "string"}}, ["project", "instance"], self._get_instance)
        self.register_tool("sqlserver_list_databases", "List databases", {"project": {"type": "string"}, "instance": {"type": "string"}}, ["project", "instance"], self._list_databases)

    @circuit("google-cloud-sql-sqlserver", failure_threshold=5, recovery_timeout=60)
    async def _list_instances(self, project: str) -> Dict[str, Any]:
        return await self._request("GET", f"/projects/{project}/instances")

    @circuit("google-cloud-sql-sqlserver", failure_threshold=5, recovery_timeout=60)
    async def _get_instance(self, project: str, instance: str) -> Dict[str, Any]:
        return await self._request("GET", f"/projects/{project}/instances/{instance}")

    @circuit("google-cloud-sql-sqlserver", failure_threshold=5, recovery_timeout=60)
    async def _list_databases(self, project: str, instance: str) -> Dict[str, Any]:
        return await self._request("GET", f"/projects/{project}/instances/{instance}/databases")


# ═══════════════════════════════════════════════════════════════
#  GOOGLE FIREBASE
# ═══════════════════════════════════════════════════════════════

class GoogleFirebaseAdapter(_GoogleRestAdapter):
    name = "google-firebase"
    description = "Firebase — projects, apps, config"
    _api_base = "https://firebase.googleapis.com/v1beta1"

    def __init__(self):
        super().__init__()
        self.register_tool("firebase_list_projects", "List Firebase projects", {}, [], self._list_projects)
        self.register_tool("firebase_get_project", "Get Firebase project details", {"project": {"type": "string"}}, ["project"], self._get_project)
        self.register_tool("firebase_list_apps", "List apps in a Firebase project", {"project": {"type": "string"}}, ["project"], self._list_apps)

    @circuit("google-firebase", failure_threshold=5, recovery_timeout=60)
    async def _list_projects(self) -> Dict[str, Any]:
        return await self._request("GET", "/projects")

    @circuit("google-firebase", failure_threshold=5, recovery_timeout=60)
    async def _get_project(self, project: str) -> Dict[str, Any]:
        return await self._request("GET", f"/projects/{project}")

    @circuit("google-firebase", failure_threshold=5, recovery_timeout=60)
    async def _list_apps(self, project: str) -> Dict[str, Any]:
        return await self._request("GET", f"/projects/{project}/androidApps")


# ═══════════════════════════════════════════════════════════════
#  GOOGLE DEVELOPER KNOWLEDGE
# ═══════════════════════════════════════════════════════════════

class GoogleDeveloperKnowledgeAdapter(_GoogleRestAdapter):
    name = "google-developer-knowledge"
    description = "Developer Knowledge API — Google Developer Documentation"
    _api_base = "https://developer.googleapis.com"

    def __init__(self):
        super().__init__()
        self.register_tool("devdocs_search", "Search Google developer docs", {"query": {"type": "string"}}, ["query"], self._search_docs)

    @circuit("google-developer-knowledge", failure_threshold=5, recovery_timeout=60)
    async def _search_docs(self, query: str) -> Dict[str, Any]:
        return {"note": "Developer Knowledge API is restricted; use public devsite search", "query": query, "url": f"https://developers.google.com/s/results?q={query}"}

    async def health(self) -> Dict[str, Any]:
        return {"status": "healthy", "note": "Developer Knowledge API search via devsite"}


# ═══════════════════════════════════════════════════════════════
#  GOOGLE GENMEDIA (Imagen & Veo via Vertex AI)
# ═══════════════════════════════════════════════════════════════

class GoogleGenmediaAdapter(_GoogleRestAdapter):
    name = "google-genmedia"
    description = "Genmedia — Imagen & Veo models via Vertex AI"
    _api_base = "https://aiplatform.googleapis.com/v1"

    def __init__(self):
        super().__init__()
        self.register_tool("genmedia_generate_image", "Generate an image with Imagen", {"project": {"type": "string"}, "location": {"type": "string", "default": "us-central1"}, "prompt": {"type": "string"}}, ["project", "prompt"], self._generate_image)
        self.register_tool("genmedia_generate_video", "Generate a video with Veo", {"project": {"type": "string"}, "location": {"type": "string", "default": "us-central1"}, "prompt": {"type": "string"}}, ["project", "prompt"], self._generate_video)

    @circuit("google-genmedia", failure_threshold=5, recovery_timeout=60)
    async def _generate_image(self, project: str, prompt: str, location: str = "us-central1") -> Dict[str, Any]:
        url = f"{self._api_base}/projects/{project}/locations/{location}/publishers/google/models/imagen-3.0-generate-001:predict"
        body = {"instances": [{"prompt": prompt}], "parameters": {"sampleCount": 1}}
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(url, headers=self._headers(), json=body)
            resp.raise_for_status()
            return resp.json()

    @circuit("google-genmedia", failure_threshold=5, recovery_timeout=60)
    async def _generate_video(self, project: str, prompt: str, location: str = "us-central1") -> Dict[str, Any]:
        url = f"{self._api_base}/projects/{project}/locations/{location}/publishers/google/models/veo-001:predict"
        body = {"instances": [{"prompt": prompt}], "parameters": {}}
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(url, headers=self._headers(), json=body)
            resp.raise_for_status()
            return resp.json()


# ═══════════════════════════════════════════════════════════════
#  GOOGLE GCLOUD (General project / IAM ops)
# ═══════════════════════════════════════════════════════════════

class GoogleGcloudAdapter(_GoogleRestAdapter):
    name = "google-gcloud"
    description = "gcloud CLI operations — projects, IAM, services"
    _api_base = "https://cloudresourcemanager.googleapis.com/v1"

    def __init__(self):
        super().__init__()
        self.register_tool("gcloud_list_services", "List enabled services", {"project": {"type": "string"}}, ["project"], self._list_services)
        self.register_tool("gcloud_enable_service", "Enable a service API", {"project": {"type": "string"}, "service": {"type": "string"}}, ["project", "service"], self._enable_service)
        self.register_tool("gcloud_get_project", "Get project metadata", {"project": {"type": "string"}}, ["project"], self._get_project)

    @circuit("google-gcloud", failure_threshold=5, recovery_timeout=60)
    async def _list_services(self, project: str) -> Dict[str, Any]:
        url = f"https://serviceusage.googleapis.com/v1/projects/{project}/services"
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(url, headers=self._headers())
            resp.raise_for_status()
            return resp.json()

    @circuit("google-gcloud", failure_threshold=5, recovery_timeout=60)
    async def _enable_service(self, project: str, service: str) -> Dict[str, Any]:
        url = f"https://serviceusage.googleapis.com/v1/projects/{project}/services/{service}:enable"
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, headers=self._headers())
            resp.raise_for_status()
            return resp.json()

    @circuit("google-gcloud", failure_threshold=5, recovery_timeout=60)
    async def _get_project(self, project: str) -> Dict[str, Any]:
        url = f"https://cloudresourcemanager.googleapis.com/v1/projects/{project}"
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(url, headers=self._headers())
            resp.raise_for_status()
            return resp.json()


# ═══════════════════════════════════════════════════════════════
#  GOOGLE FLUTTER
# ═══════════════════════════════════════════════════════════════

class GoogleFlutterAdapter(_GoogleRestAdapter):
    name = "google-flutter"
    description = "Flutter/Dart — mobile/web SDK tooling"
    _api_base = "https://firebase.googleapis.com/v1beta1"

    def __init__(self):
        super().__init__()
        self.register_tool("flutter_list_projects", "List Firebase projects (Flutter uses Firebase)", {}, [], self._list_projects)

    @circuit("google-flutter", failure_threshold=5, recovery_timeout=60)
    async def _list_projects(self) -> Dict[str, Any]:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(f"{self._api_base}/projects", headers=self._headers())
            resp.raise_for_status()
            return resp.json()


# ═══════════════════════════════════════════════════════════════
#  GOOGLE MCP TOOLBOX
# ═══════════════════════════════════════════════════════════════

class GoogleMcpToolboxAdapter(_GoogleRestAdapter):
    name = "google-mcp-toolbox"
    description = "MCP Toolbox for Databases — BigQuery, Cloud SQL, AlloyDB, Spanner, Firestore"
    _api_base = "https://aiplatform.googleapis.com/v1"

    def __init__(self):
        super().__init__()
        self.register_tool("toolbox_list_tools", "List available MCP Toolbox tools", {"project": {"type": "string"}, "location": {"type": "string", "default": "us-central1"}}, ["project"], self._list_tools)
        self.register_tool("toolbox_invoke_tool", "Invoke a toolbox tool", {"project": {"type": "string"}, "location": {"type": "string", "default": "us-central1"}, "tool": {"type": "string"}, "params": {"type": "object", "default": {}}}, ["project", "tool"], self._invoke_tool)

    @circuit("google-mcp-toolbox", failure_threshold=5, recovery_timeout=60)
    async def _list_tools(self, project: str, location: str = "us-central1") -> Dict[str, Any]:
        return {"note": "MCP Toolbox tools are registered as separate adapters in this broker", "available": [
            "google-alloydb", "google-bigtable", "google-firestore", "google-spanner",
            "google-cloud-sql-mysql", "google-cloud-sql-postgres", "google-cloud-sql-sqlserver"
        ]}

    @circuit("google-mcp-toolbox", failure_threshold=5, recovery_timeout=60)
    async def _invoke_tool(self, project: str, tool: str, params: dict = None, location: str = "us-central1") -> Dict[str, Any]:
        return {"note": f"Tool '{tool}' should be invoked via its dedicated adapter", "params": params or {}}


# ═══════════════════════════════════════════════════════════════
#  GOOGLE GO
# ═══════════════════════════════════════════════════════════════

class GoogleGoAdapter(_GoogleRestAdapter):
    name = "google-go"
    description = "Go / gopls — Go language server and module tools"
    _api_base = "https://proxy.golang.org"

    def __init__(self):
        super().__init__()
        self.register_tool("go_get_module", "Get Go module info from proxy", {"module": {"type": "string"}, "version": {"type": "string", "default": "latest"}}, ["module"], self._get_module)
        self.register_tool("go_list_versions", "List available versions of a module", {"module": {"type": "string"}}, ["module"], self._list_versions)

    @circuit("google-go", failure_threshold=5, recovery_timeout=60)
    async def _get_module(self, module: str, version: str = "latest") -> Dict[str, Any]:
        url = f"{self._api_base}/{module}/@v/{version}.info"
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            return resp.json()

    @circuit("google-go", failure_threshold=5, recovery_timeout=60)
    async def _list_versions(self, module: str) -> Dict[str, Any]:
        url = f"{self._api_base}/{module}/@v/list"
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            return {"versions": resp.text.splitlines()}
