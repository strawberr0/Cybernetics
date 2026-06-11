<div align="center">

![Cybernetics Banner](assets/banner.svg)

</div>

<p align="center">
  <strong>Composable Meta-MCP for Google Cloud Agents</strong><br/>
  <sub>v0.1.1  •  56 Adapters  •  Agent Composer  •  A2A/ERC-8004 Ready</sub>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/status-production--ready-emerald?style=flat-square&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxNiAxNiI+PGNpcmNsZSBjeD0iOCIgY3k9IjgiIHI9IjgiIGZpbGw9IiMxMGI5ODEiLz48L3N2Zz4=" alt="Status"/>
  <img src="https://img.shields.io/badge/Go-1.22-blue?style=flat-square&logo=go&logoColor=white" alt="Go"/>
  <img src="https://img.shields.io/badge/Python-3.11-blue?style=flat-square&logo=python&logoColor=white" alt="Python"/>
  <img src="https://img.shields.io/badge/React-19-blue?style=flat-square&logo=react&logoColor=white" alt="React"/>
  <img src="https://img.shields.io/badge/TypeScript-strict-blue?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript"/>
  <img src="https://img.shields.io/badge/license-AGPL--3.0-slate?style=flat-square" alt="License"/>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/MCP-2024--11--05-green?style=flat-square" alt="MCP"/>
  <img src="https://img.shields.io/badge/A2A-compatible-green?style=flat-square" alt="A2A"/>
  <img src="https://img.shields.io/badge/ERC--8004-compatible-green?style=flat-square" alt="ERC-8004"/>
  <img src="https://img.shields.io/badge/Google%20Cloud-Run-orange?style=flat-square&logo=google-cloud&logoColor=white" alt="Google Cloud"/>
  <img src="https://img.shields.io/badge/Gemini-3.x-orange?style=flat-square&logo=google&logoColor=white" alt="Gemini"/>
</p>

---

## Quick Start (Docker Compose)

```bash
# 1. Configure (optional — defaults to PORT=4001, GEMINI_API_KEY empty)
cp .env.example.compose .env

# 2. Build & run
docker compose up --build

# 3. Open
open http://localhost:4001
```

The composer container serves both the built React frontend and the Go `/api/*`
backend on the port set by `$COMPOSER_PORT` (default **4001**). All ports are
env-overridable — no values are hardcoded in the image.

### Local dev (no Docker)

```bash
# Backend (Go) — defaults to :4001, override with PORT=...
go run ./cmd/composer

# Frontend (Vite) — defaults to :4000, proxies /api -> BACKEND_URL (default http://localhost:4001)
cd frontend && npm install && npm run dev
```

---

**Classification:** OPEN SOURCE  
**Authors:** plasmaraygun, GoryGrey, royhodge812, sebuh-infsol  (strawberr0)  
**Version:** 0.1.1  
**Status:** Production-Ready  

---

## 1. Executive Summary

Cybernetics is a **composable Model Context Protocol (MCP) meta-broker** designed for Google Cloud enterprise environments. It aggregates 56 third-party MCP servers into a unified, authenticated, auditable control plane and exposes composable **agent templates** that execute multi-phase autonomous workflows on top of that plane.

The project ships two surfaces:

1. **Cybernetics MCP broker** — a single stdio-based MCP peer (`cybernetics-mcp`) that aggregates 56 adapters into one tool namespace. Drop it into Claude, Cursor, Codex, Antigravity, Devin, or Vims and you get every tool the broker advertises.
2. **Composer service** — the Go HTTP + React UI in this repo. Generates Python agent code via Gemini, serves the public catalog at `/api/templates`, and is the operational dashboard.

See the [Quick Start](#quick-start-docker-compose) above for the composer; section 3 for the broker.

### Key Differentiators
- **Zero Trust by default** — every request authenticated, no anonymous endpoints beyond health probes
- **Defense in depth** — circuit breakers, input sanitization, sentinel middleware, structured logging
- **Multi-tenant ready** — per-adapter isolation, API-key scoping, audit trails
- **Operational hardening** — non-root containers, Cloud IAM binding, Secret Manager injection, VPC-SC compatible

---

## 2. Architecture

```
┌───────────────────────────────────────────────────────────────────┐
│                    Google Cloud (VPC-SC)                          │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────┐        │
│  │ Cloud Run   │◄──►│  Cloud SQL  │◄──►│ Secret Manager  │        │
│  │ (Broker)    │    │  (Postgres) │    │                 │        │
│  └──────┬──────┘    └─────────────┘    └─────────────────┘        │
│         │                                                         │
│  ┌──────┴─────────────────────────────────────────────────────┐   │
│  │                  Cybernetics Broker                        │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐      │   │
│  │  │ Auth MW  │  │ Registry │  │Circuits  │  │Health  │      │   │
│  │  │ (Bearer) │  │ (Adapters│  │(CBs)     │  │Probes  │      │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └────────┘      │   │
│  │  ┌───────────────────────────────────────────────────────┐ │   │
│  │  │            Agent Template Engine                      │ │   │
│  │  │  Sentinel  │  DeployAgent │ FinanceAgent │ InfraAgent │ │   │
│  │  └───────────────────────────────────────────────────────┘ │   │
│  └────────────────────────────────────────────────────────────┘   │
│         │                                                         │
│  ┌──────┴─────────────────────────────────────────────────┐       │
│  │                  MCP Adapter Layer                     │       │
│  │  Dynatrace  Elastic  Postgres  GitLab  Arize  Fivetran │       │
│  │  GitHub     Stripe   AWS       Vercel  Supabase        │       │
│  │  Cloudflare Browser (Playwright CDP)                   │       │
│  └────────────────────────────────────────────────────────┘       │
└───────────────────────────────────────────────────────────────────┘
         │
    ┌────┴──────────────────────────────────────┐
    │            Google ADK / Vertex AI         │
    │   (Agent orchestration, LLM-as-a-Judge)   │
    └───────────────────────────────────────────┘
```

### Data Flow
1. **Request** → Cloud Run → `APIKeyAuth` middleware validates Bearer token
2. **Routing** → FastAPI dispatches to `/mcp/invoke`, `/mcp/tools`, or `/mcp/sse`
3. **Sentinel Pipeline** → `Auditor.before()` logs call, `Guard.before()` blocks sensitive keys
4. **Registry** → `auto_discover()` scans `cybernetics/adapters/` and registers all concrete `MCPAdapter` subclasses dynamically; executes tool via circuit breaker
5. **Adapter** → Async HTTP/SQL client calls downstream MCP server
6. **Response** → `Auditor.after()` logs result, circuit breaker state updated

---

## 3. Cybernetics MCP Server — Usage Guide

Cybernetics is a **first-class MCP server** that exposes its adapters and agent templates as tools over the Model Context Protocol. Any MCP client (Antigravity, Claude Code, Cursor, Devin, Vims etc.) can connect to it.

### 3.1 What Is the Cybernetics MCP Server?

The Cybernetics MCP server is a single stdio-based MCP peer that aggregates all configured adapters into one unified tool namespace. Instead of installing 20 separate MCP servers, you install **one**:

```json
{
  "mcpServers": {
    "cybernetics": {
      "command": "python",
      "args": ["-m", "cybernetics.mcp"],
      "env": {
        "BROKER_API_KEY": "your-broker-key",
        "POSTGRES_DSN": "postgresql+asyncpg://user:pass@localhost/sentinel"
      }
    }
  }
}
```

Once connected, your MCP client sees **all tools** from **all enabled adapters** as a flat list:

| Tool | What it does |
|---|---|
| `dynatrace_get_problems` | Fetch active problems from Dynatrace |
| `github_create_issue` | Create a GitHub issue |
| `slack_post_message` | Post to a Slack channel |
| `browser_screenshot` | Take a browser screenshot via CDP |
| `sentinel_run` | Execute the full Sentinel agent workflow |
| `deploy_trigger_pipeline` | Trigger a GitLab CI/CD pipeline |

### 3.2 How It Works

```
┌─────────────┐      stdio       ┌──────────────────────────────────────────┐
│ AntiGravity │ ◄──────────────► │  Cybernetics MCP Server                  │
│   Desktop   │   JSON-RPC 2.0   │  ┌─────────────┐   ┌──────────────────┐  │
└─────────────┘                  │  │  Registry   │   │  Dynatrace       │  │
                                 │  │  (loads     │──►│  GitHub          │  │
                                 │  │  adapters)  │   │  Slack           │  │
                                 │  └─────────────┘   │  Browser...      │  │
                                 │                    └──────────────────┘  │
                                 └──────────────────────────────────────────┘
```

**You do not configure each adapter individually.** Adapters are loaded from the Cybernetics broker's registry based on the environment variables already set on the host.

### 3.3 Required Environment (Preset by Ops)

These are **connection settings** that your platform team configures once:

| Variable | Purpose | Example |
|---|---|---|
| `POSTGRES_DSN` | Database connection | `postgresql+asyncpg://...` |
| `DYNATRACE_BASE_URL` | Dynatrace tenant URL | `https://xyz.live.dynatrace.com` |
| `ELASTIC_CLOUD_ID` | Elastic Cloud deployment ID | `my-deployment:ZXUta2...` |
| `GITLAB_URL` | GitLab instance | `https://gitlab.com` |
| `ARIZE_ENDPOINT` | Arize Phoenix URL | `https://app.phoenix.arize.com` |
| `DATADOG_SITE` | Datadog region | `datadoghq.com` |
| `BROWSER_CDP_HOST` | Browser CDP host | `localhost` |
| `BROWSER_CDP_PORT` | Browser CDP port | `9222` |

### 3.4 Secret Keys (Injected per User / Team)

Set only the keys for the adapters you actually use. Adapters with no key
required (`browser`, `chrome`, `firefox`, `brave`, `docker`, `postgres`) are
omitted; they rely on preset connection settings from § 3.3.

#### Core

| Variable | Adapter | Where to get it |
|---|---|---|
| `BROKER_API_KEY` | Cybernetics broker | Self-generated shared secret — `openssl rand -hex 32`. Set the same value on the broker process and in every MCP client config. |
| `GEMINI_API_KEY` | Composer (Gemini) | <https://aistudio.google.com/apikey> |

#### Observability & Incident

| Variable | Adapter | Where to get it |
|---|---|---|
| `DYNATRACE_API_TOKEN` | Dynatrace | Settings → Access tokens |
| `DATADOG_API_KEY` / `DATADOG_APP_KEY` | Datadog | Org Settings → API Keys / Application Keys |
| `ELASTIC_API_KEY` | Elastic | Stack Management → API Keys |
| `PAGERDUTY_API_KEY` | PagerDuty | Profile → User Settings → API Access |
| `ARIZE_API_KEY` | Arize | Settings → API Keys |

#### Source Control & CI/CD

| Variable | Adapter | Where to get it |
|---|---|---|
| `GITHUB_TOKEN` | GitHub | Settings → Developer settings → PAT (fine-grained) |
| `GITLAB_TOKEN` | GitLab | User Settings → Access Tokens |
| `VERCEL_TOKEN` | Vercel | Account Settings → Tokens |

#### Cloud Infrastructure

| Variable | Adapter | Where to get it |
|---|---|---|
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | AWS | IAM → Users → Security credentials |
| `CLOUDFLARE_API_TOKEN` | Cloudflare | My Profile → API Tokens (Custom or "Edit zone") |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | All `google-*` adapters (25 services) | GCP → IAM → Service Accounts → Keys → Create (JSON) |

#### Productivity & Workspace

| Variable | Adapter | Where to get it |
|---|---|---|
| `SLACK_BOT_TOKEN` | Slack | api.slack.com/apps → OAuth & Permissions (`xoxb-…`) |
| `NOTION_TOKEN` | Notion | <https://www.notion.so/my-integrations> |
| `CONFLUENCE_API_TOKEN` | Confluence | id.atlassian.com → Security → API tokens |
| `JIRA_API_TOKEN` | Jira | id.atlassian.com → Security → API tokens |
| `ASANA_TOKEN` | Asana | Profile Settings → Apps → Manage Developer Apps → PAT |
| `LINEAR_API_KEY` | Linear | Settings → API |
| `AIRTABLE_API_KEY` | Airtable | airtable.com/create/tokens |

#### Data & Databases

| Variable | Adapter | Where to get it |
|---|---|---|
| `MONGODB_URI` | MongoDB | Atlas → Database Access → connection string |
| `REDIS_URL` | Redis | `redis://:<pass>@host:port/db` |
| `SUPABASE_KEY` | Supabase | Project Settings → API → `service_role` key |
| `SNOWFLAKE_ACCOUNT` / `SNOWFLAKE_USER` / `SNOWFLAKE_PASSWORD` | Snowflake | Account admin |
| `FIVETRAN_API_KEY` / `FIVETRAN_API_SECRET` | Fivetran | Account → API Config |

#### Commerce & Finance

| Variable | Adapter | Where to get it |
|---|---|---|
| `STRIPE_API_KEY` | Stripe | Developers → API Keys (use restricted keys in prod) |
| `SHOPIFY_ACCESS_TOKEN` / `SHOPIFY_SHOP_DOMAIN` | Shopify | Admin → Apps → Develop apps → Access token |
| `QUICKBOOKS_ACCESS_TOKEN` / `QUICKBOOKS_COMPANY_ID` | QuickBooks | Intuit Developer → My Apps → OAuth 2.0 Playground |

#### Automation

| Variable | Adapter | Where to get it |
|---|---|---|
| `N8N_API_KEY` | n8n | Settings → API → Create API key |

> **No-key adapters** (preset config from § 3.3 only): `airtable` connection, `brave`, `browser`, `chrome`, `docker`, `firefox`, `postgres`.

### 3.5 Example: Using Cybernetics from Antigravity

Google Antigravity inherits VS Code's MCP wiring under the `mcp.servers` key.

**Step 1:** Install the broker:

```bash
pip install cybernetics-mcp
```

**Step 2:** Add to Antigravity's `settings.json` (Command Palette → *Preferences: Open User Settings (JSON)*):

```json
{
  "mcp.servers": {
    "cybernetics": {
      "command": "cybernetics-mcp",
      "args": [],
      "env": {
        "BROKER_API_KEY": "$(openssl rand -hex 32)",
        "GEMINI_API_KEY": "<aistudio-key>",
        "POSTGRES_DSN": "postgresql+asyncpg://user:pass@localhost/cybernetics",
        "DYNATRACE_BASE_URL": "https://xyz.live.dynatrace.com",
        "DYNATRACE_API_TOKEN": "dt0c01.xxx"
      }
    }
  }
}
```

**Step 3:** Ask the agent to use it:

> "Check Dynatrace for active problems on the `api` service, then post a summary to Slack `#incidents`."

The Antigravity agent will:
1. Call `tools/list` and see `dynatrace_get_problems` + `slack_post_message`.
2. Call `dynatrace_get_problems` with `{ "service": "api" }`.
3. Call `slack_post_message` with the results.

### 3.6 Other clients

The broker speaks vanilla MCP — same JSON schema in **Claude Desktop / Claude Code**
(`mcpServers`), **Cursor** (`.cursor/mcp.json`), **Codex CLI** (`~/.codex/config.toml`, TOML),
**Devin** (dashboard), and **Vims** (`vims_mcp_add_server`). The Composer UI's
MCP Control Plane page renders copy-pasteable boilerplate for each.

### 3.7 Protocol Details

Implements MCP protocol `2024-11-05` over stdio (JSON-RPC 2.0):

| Method | Purpose |
|---|---|
| `initialize` | Handshake + capability exchange |
| `tools/list` | Discover all tools from all adapters |
| `tools/call` | Invoke any tool by `adapter_tool` name |

Tool names are namespaced: `dynatrace_get_problems`, `github_create_issue`, `browser_screenshot`, etc.

---

## 4. Adapter Catalog (56 Adapters)

### Non-Google Adapters

| Adapter | Protocol | Auth | Circuit | Tools (complete) |
|---|---|---|---|---|
| `airtable` | REST | `Bearer` | airtable | `airtable_list_bases`, `airtable_get_base`, `airtable_create_record` |
| `arize` | REST | `Bearer` | arize | `arize_run_judge` (Gemini), `arize_log_eval` |
| `asana` | REST | `Bearer` | asana | `asana_list_projects`, `asana_get_task`, `asana_create_task` |
| `aws` | boto3 | IAM / keys | aws | `aws_s3_list_buckets`, `aws_s3_list_objects`, `aws_ec2_describe_instances`, `aws_lambda_list_functions`, `aws_lambda_invoke`, `aws_cloudwatch_get_metrics` |
| `brave` | Playwright | N/A | brave | `brave_navigate`, `brave_evaluate`, `brave_screenshot`, `brave_click`, `brave_type`, `brave_set_viewport`, `brave_pdf`, `brave_check_shields` |
| `browser` | WebSocket CDP | N/A | browser | `browser_navigate`, `browser_evaluate`, `browser_screenshot`, `browser_get_network_log`, `browser_get_console_log`, `browser_clear_cache` |
| `chrome` | WebSocket CDP | N/A | chrome | `chrome_navigate`, `chrome_evaluate`, `chrome_screenshot`, `chrome_get_network`, `chrome_get_console`, `chrome_clear_cache`, `chrome_set_viewport`, `chrome_click`, `chrome_type`, `chrome_pdf` |
| `cloudflare` | REST | `Bearer` | cloudflare | `cloudflare_list_zones`, `cloudflare_list_dns`, `cloudflare_create_dns`, `cloudflare_list_workers`, `cloudflare_deploy_worker` |
| `confluence` | REST | `Api-Token` | confluence | `confluence_search_pages`, `confluence_get_page`, `confluence_create_page` |
| `datadog` | REST | `DD-API-Key` | datadog | `datadog_query_metrics`, `datadog_list_monitors`, `datadog_get_monitor`, `datadog_mute_monitor`, `datadog_list_incidents`, `datadog_search_logs`, `datadog_post_event` |
| `docker` | REST / socket | N/A | docker | `docker_list_containers`, `docker_run`, `docker_build`, `docker_logs` |
| `dynatrace` | REST | `Api-Token` | dynatrace | `dynatrace_get_problems`, `dynatrace_get_traces`, `dynatrace_run_dql` |
| `elastic` | REST | `ApiKey` | elastic | `elastic_search_incidents`, `elastic_search_runbooks`, `elastic_write_insight` |
| `fivetran` | REST | Basic | fivetran | `fivetran_list_connectors`, `fivetran_get_connector_status`, `fivetran_sync_connector`, `fivetran_create_log_pipeline` |
| `firefox` | Playwright | N/A | firefox | `firefox_navigate`, `firefox_evaluate`, `firefox_screenshot`, `firefox_get_console`, `firefox_click`, `firefox_type`, `firefox_set_viewport`, `firefox_pdf` |
| `github` | REST | `token` | github | `github_create_issue`, `github_get_issue`, `github_create_pr`, `github_list_repos`, `github_trigger_workflow`, `github_search_code` |
| `gitlab` | REST | `PRIVATE-TOKEN` | gitlab | `gitlab_create_issue`, `gitlab_create_mr`, `gitlab_get_file`, `gitlab_trigger_pipeline` |
| `jira` | REST | `Api-Token` | jira | `jira_create_issue`, `jira_search_issues`, `jira_get_sprint`, `jira_transition_issue` |
| `linear` | GraphQL | `Bearer` | linear | `linear_create_issue`, `linear_list_issues`, `linear_update_issue`, `linear_get_teams`, `linear_search_issues`, `linear_create_comment` |
| `mongodb` | TCP | URI | mongodb | `mongodb_find`, `mongodb_insert`, `mongodb_aggregate`, `mongodb_index` |
| `n8n` | REST | `Api-Key` | n8n | `n8n_list_workflows`, `n8n_trigger`, `n8n_get_execution` |
| `notion` | REST | `Bearer` | notion | `notion_search`, `notion_get_page`, `notion_create_page`, `notion_query_database`, `notion_update_page`, `notion_get_database` |
| `pagerduty` | REST | `Token` | pagerduty | `pagerduty_list_incidents`, `pagerduty_acknowledge`, `pagerduty_get_oncall` |
| `postgres` | TCP | DSN | postgres | `postgres_recall_pattern`, `postgres_store_pattern`, `postgres_log_incident`, `postgres_get_recent_incidents` |
| `quickbooks` | REST | OAuth | quickbooks | `qb_list_customers`, `qb_get_customer`, `qb_create_invoice`, `qb_list_invoices`, `qb_get_report` |
| `redis` | TCP | URI | redis | `redis_get`, `redis_set`, `redis_publish`, `redis_stream_read` |
| `shopify` | REST | `Access-Token` | shopify | `shopify_list_products`, `shopify_get_order`, `shopify_create_draft`, `shopify_update_inventory` |
| `slack` | REST | `Bearer` | slack | `slack_post_message`, `slack_get_channel_history`, `slack_list_channels`, `slack_search_messages`, `slack_upload_file`, `slack_get_user_info` |
| `snowflake` | JDBC/REST | Key-pair | snowflake | `snowflake_query`, `snowflake_list_warehouses`, `snowflake_share` |
| `stripe` | REST | `Bearer` | stripe | `stripe_create_customer`, `stripe_get_customer`, `stripe_create_charge`, `stripe_list_invoices`, `stripe_create_subscription` |
| `supabase` | REST | `apikey` | supabase | `supabase_select`, `supabase_insert`, `supabase_update`, `supabase_delete`, `supabase_rpc` |
| `vercel` | REST | `Bearer` | vercel | `vercel_list_projects`, `vercel_get_deployment`, `vercel_list_deployments`, `vercel_add_env_var` |

### Google MCP Hub (25 Servers)

| Adapter | Source |
|---|---|
| `google-workspace` | [gemini-cli-extensions/workspace](https://github.com/gemini-cli-extensions/workspace) |
| `google-cloud-run` | [GoogleCloudPlatform/cloud-run-mcp](https://github.com/GoogleCloudPlatform/cloud-run-mcp) |
| `google-go` | [go.dev/gopls/features/mcp](https://go.dev/gopls/features/mcp) |
| `google-analytics` | [googleanalytics/google-analytics-mcp](https://github.com/googleanalytics/google-analytics-mcp) |
| `google-mcp-toolbox` | [googleapis/mcp-toolbox](https://github.com/googleapis/mcp-toolbox) |
| `google-cloud-storage` | [googleapis/gcloud-mcp/packages/storage-mcp](https://github.com/googleapis/gcloud-mcp/tree/main/packages/storage-mcp) |
| `google-genmedia` | [vertex-ai-creative-studio/mcp-genmedia](https://github.com/GoogleCloudPlatform/vertex-ai-creative-studio/tree/main/experiments/mcp-genmedia) |
| `google-gke` | [GoogleCloudPlatform/gke-mcp](https://github.com/GoogleCloudPlatform/gke-mcp) |
| `google-gcloud` | [googleapis/gcloud-mcp/packages/gcloud-mcp](https://github.com/googleapis/gcloud-mcp/tree/main/packages/gcloud-mcp) |
| `google-observability` | [googleapis/gcloud-mcp/packages/observability-mcp](https://github.com/googleapis/gcloud-mcp/tree/main/packages/observability-mcp) |
| `google-flutter` | [dart-lang/ai/pkgs/dart_mcp_server](https://github.com/dart-lang/ai/tree/main/pkgs/dart_mcp_server) |
| `google-maps` | [Google Maps AI Code Assist](https://developers.google.com/maps/ai/code-assist) |
| `google-alloydb` | [Google MCP Hub](https://github.com/google/mcp) (remote) |
| `google-bigtable` | [Google MCP Hub](https://github.com/google/mcp) (remote) |
| `google-chronicle` | [Google MCP Hub](https://github.com/google/mcp) (remote) |
| `google-cloud-resource-manager` | [Google MCP Hub](https://github.com/google/mcp) (remote) |
| `google-cloud-sql-mysql` | [Google MCP Hub](https://github.com/google/mcp) (remote) |
| `google-cloud-sql-postgres` | [Google MCP Hub](https://github.com/google/mcp) (remote) |
| `google-cloud-sql-sqlserver` | [Google MCP Hub](https://github.com/google/mcp) (remote) |
| `google-compute-engine` | [Google MCP Hub](https://github.com/google/mcp) (remote) |
| `google-developer-knowledge` | [Google MCP Hub](https://github.com/google/mcp) (remote) |
| `google-firebase` | [Google MCP Hub](https://github.com/google/mcp) (remote) |
| `google-firestore` | [Google MCP Hub](https://github.com/google/mcp) (remote) |
| `google-spanner` | [Google MCP Hub](https://github.com/google/mcp) (remote) |

### 4.1 MCP Server Sources

| Adapter | Official MCP Server / Source |
|---|---|
| `airtable` | [Airtable MCP Server](https://support.airtable.com/docs/using-the-airtable-mcp-server) |
| `arize` | [Arize-ai/arize-tracing-assistant](https://github.com/Arize-ai/arize-tracing-assistant) |
| `asana` | [Asana MCP Server](https://developers.asana.com/docs/mcp-server) |
| `aws` | [awslabs/mcp](https://github.com/awslabs/mcp) |
| `brave` | [brave/brave-search-mcp-server](https://github.com/brave/brave-search-mcp-server) |
| `confluence`, `jira` | [Atlassian MCP Server](https://github.com/atlassian/atlassian-mcp-server) |
| `browser` / `playwright` | [microsoft/playwright-mcp](https://github.com/microsoft/playwright-mcp) |
| `chrome` | [ChromeDevTools/chrome-devtools-mcp](https://github.com/ChromeDevTools/chrome-devtools-mcp) |
| `cloudflare` | [cloudflare/mcp-server-cloudflare](https://github.com/cloudflare/mcp-server-cloudflare) |
| `datadog` | [datadog-labs/mcp-server](https://github.com/datadog-labs/mcp-server) |
| `dynatrace` | [dynatrace-oss/dynatrace-mcp](https://github.com/dynatrace-oss/dynatrace-mcp) |
| `elastic` | [elastic/mcp-server-elasticsearch](https://github.com/elastic/mcp-server-elasticsearch) |
| `fivetran` | [fivetran/fivetran-mcp](https://github.com/fivetran/fivetran-mcp) |
| `firefox` | [mozilla/firefox-devtools-mcp](https://github.com/mozilla/firefox-devtools-mcp) |
| `github` | [github/github-mcp-server](https://github.com/github/github-mcp-server) |
| `gitlab` | [GitLab MCP Server](https://docs.gitlab.com/user/gitlab_duo/model_context_protocol/mcp_server/) |
| `linear` | [Linear MCP Docs](https://linear.app/docs/mcp) |
| `mongodb` | [MongoDB MCP Server Docs](https://www.mongodb.com/docs/mcp-server/get-started/) |
| `n8n` | [n8n MCP Server](https://docs.n8n.io/advanced-ai/mcp/accessing-n8n-mcp-server/) |
| `notion` | [makenotion/notion-mcp-server](https://github.com/makenotion/notion-mcp-server) |
| `pagerduty` | [PagerDuty/pagerduty-mcp-server](https://github.com/PagerDuty/pagerduty-mcp-server) |
| `postgres` | [prisma/mcp](https://github.com/prisma/mcp) |
| `quickbooks` | [intuit/quickbooks-online-mcp-server](https://github.com/intuit/quickbooks-online-mcp-server) |
| `redis` | [redis/mcp-redis](https://github.com/redis/mcp-redis) |
| `shopify` | [Shopify MCP Storefront](https://shopify.dev/docs/apps/build/storefront-mcp/servers/storefront) |
| `slack` | [Slack MCP Server](https://docs.slack.dev/ai/slack-mcp-server/) |
| `snowflake` | [Snowflake-Labs/mcp](https://github.com/Snowflake-Labs/mcp) |
| `stripe` | [mcp/com.stripe/mcp](https://github.com/mcp/com.stripe/mcp) |
| `supabase` | [Supabase MCP Guide](https://supabase.com/docs/guides/ai-tools/mcp) |
| `vercel` | [vercel-labs/mcp-on-vercel](https://github.com/vercel-labs/mcp-on-vercel) |

**Google MCP Servers** — see the Google MCP Hub table above for all 24 individual server sources.

---

## 5. Agent Templates

### 5.1 Sentinel — Self-Healing SRE
**Adapters:** dynatrace, elastic, postgres, gitlab, arize, fivetran  
**Phases:**
1. **Detect** — Fetch active problems from Dynatrace
2. **Investigate** — Hybrid search incidents + runbooks in Elastic
3. **Reason** — Recall pattern from Postgres; if unknown, generate diagnosis
4. **Act** — Create GitLab issue with auto-labels
5. **Verify** — Poll Dynatrace traces with exponential backoff until error rate < 1%
6. **Evaluate** — Gemini LLM-as-a-Judge scores diagnosis/action quality
7. **Learn** — Upsert pattern + log incident to Postgres; trigger Fivetran sync

### 5.2 DeployAgent — CI/CD Orchestrator
**Adapters:** github, vercel, aws, postgres  
**Phases:**
1. **Validate** — Verify latest commit on branch
2. **Build** — Trigger GitHub Actions workflow
3. **Deploy** — Vercel deployment + S3 artifact sync
4. **Verify** — Smoke test deployed URL via `httpx`
5. **Learn** — Log deployment outcome to Postgres

### 5.3 FinanceAgent — Payment Anomaly Detection
**Adapters:** stripe, supabase, postgres  
**Phases:**
1. **Detect** — Flag invoices > $1,000 or duplicate charges in 24h window
2. **Investigate** — Pull customer tier/history from Supabase
3. **Reason** — Tier-based decision: flag_for_review / partial_refund / notify
4. **Act** — Execute Stripe refund or insert review ticket
5. **Learn** — Store pattern + log incident

### 5.4 InfraAgent — Infrastructure Optimization
**Adapters:** dynatrace, cloudflare, aws, postgres  
**Phases:**
1. **Detect** — Dynatrace latency spikes on service
2. **Investigate** — DNS records (Cloudflare) + EC2 instances (AWS)
3. **Reason** — Under-provisioned? Deploy CF Worker cache? Scale EC2?
4. **Act** — Deploy Worker script or scale compute
5. **Verify** — Poll Dynatrace traces until error rate < 1%
6. **Learn** — Store remediation pattern

### 5.5 SecurityAgent — Vulnerability & Secret Scanning
**Adapters:** github, slack, postgres, cloudflare, datadog  
**Phases:**
1. **Scan** — Dependency checks + secret detection in GitHub repos
2. **Assess** — Severity scoring (critical/high/medium/low)
3. **Triage** — Slack alerts for critical findings
4. **Remediate** — Auto-fix low-severity, ticket rest
5. **Verify** — Re-scan to confirm remediation
6. **Learn** — Store scan patterns in Postgres

### 5.6 DataAgent — ETL Pipeline Orchestration
**Adapters:** postgres, supabase, fivetran, slack  
**Phases:**
1. **Extract** — Pull from Supabase tables
2. **Validate** — Quality scoring (nulls, duplicates)
3. **Transform** — Deduplicate, normalize
4. **Load** — Upsert into Postgres destination
5. **Monitor** — Slack notification on completion
6. **Learn** — Store pipeline patterns

### 5.7 OpsAgent — General DevOps Orchestration
**Adapters:** datadog, slack, github, linear, postgres  
**Phases:**
1. **Observe** — Datadog metrics + system health checks
2. **Diagnose** — Crash loop? Memory pressure? Latency spike?
3. **Act** — Restart deployment, scale replicas, create Linear ticket
4. **Notify** — Slack #ops-alerts with diagnosis + actions
5. **Learn** — Store remediation patterns in Postgres

### 5.8 ContentAgent — Content Operations
**Adapters:** notion, linear, slack  
**Phases:**
1. **Plan** — Outline content from Linear roadmap
2. **Draft** — Generate in Notion
3. **Review** — Slack approval workflow
4. **Publish** — Schedule via Notion API
5. **Distribute** — Cross-post to channels
6. **Learn** — Engagement analytics → content strategy

### 5.9 CommerceAgent — E-commerce Operations
**Adapters:** stripe, supabase, aws, slack  
**Phases:**
1. **Catalog** — Sync product data from Supabase
2. **Pricing** — Dynamic pricing rules
3. **Checkout** — Stripe payment flow monitoring
4. **Fulfillment** — AWS Lambda order processing
5. **Reconcile** — Daily Stripe payout audit
6. **Notify** — Slack revenue digest

### 5.10 GoogleWorkspaceAgent — Workspace Automation
**Adapters:** google-workspace, slack  
**Phases:**
1. **Monitor** — Scan Gmail for priority threads
2. **Triage** — Label & route via Drive docs
3. **Draft** — Compose Calendar invites + replies
4. **Schedule** — Auto-book meetings from email context
5. **Notify** — Slack summary of day's actions
6. **Archive** — Move resolved threads to Drive folder

### 5.11 AtlassianAgent — Engineering Project Management
**Adapters:** jira, confluence, github, slack  
**Phases:**
1. **Backlog** — Jira grooming from Confluence specs
2. **Sprint** — Auto-assign from GitHub commit velocity
3. **Review** — PR checklist from Jira acceptance criteria
4. **Deploy** — GitHub Actions → Jira transition
5. **Retro** — Confluence retro doc + Slack poll
6. **Learn** — Sprint velocity trend analysis

### 5.12 BrowserQAAgent — Frontend QA Automation
**Adapters:** browser, chrome, firefox, slack  
**Phases:**
1. **Scan** — Crawl sitemap for changes
2. **Test** — Playwright regression suite
3. **Screenshot** — Visual diff across Chrome + Firefox
4. **Compare** — Baseline vs current pixel match
5. **Report** — Slack #qa-alerts with diff links
6. **Learn** — Flaky test pattern detection

### 5.13 CRMAgent — Sales Operations
**Adapters:** airtable, google-workspace, slack  
**Phases:**
1. **Lead** — Ingest leads from Gmail signature capture
2. **Qualify** — Airtable scoring + Drive proposal lookup
3. **Proposal** — Generate quote from Drive template
4. **Close** — Gmail follow-up sequence + Slack win channel
5. **Onboard** — Drive welcome kit + Calendar kickoff
6. **Nurture** — Airtable campaign enrollment

### 5.14 ShopifyAgent — Shopify Store Ops
**Adapters:** shopify, stripe, postgres, slack  
**Phases:**
1. **Inventory** — Shopify stock sync to Postgres
2. **Pricing** — Dynamic margin rules
3. **Order** — Shopify webhook → Stripe charge verify
4. **Fulfill** — Shipping label + tracking update
5. **Refund** — Stripe refund → Shopify order adjust
6. **Review** — Slack daily P&L digest

### 5.15 DatabaseOpsAgent — Polyglot Database Ops
**Adapters:** mongodb, redis, postgres, datadog, slack  
**Phases:**
1. **Monitor** — Datadog slow query alerts
2. **Diagnose** — Explain plan + index health across all DBs
3. **Migrate** — Postgres → MongoDB schema mapping
4. **Optimise** — Redis eviction + MongoDB index rebuild
5. **Backup** — Cross-DB snapshot verification
6. **Learn** — Query pattern + cache hit rate trends

### 5.16 SREObservabilityAgent — Full-Stack Observability
**Adapters:** dynatrace, elastic, datadog, pagerduty, slack  
**Phases:**
1. **Detect** — Dynatrace anomaly + Elastic error spike correlation
2. **Correlate** — Datadog cross-service trace linking
3. **Escalate** — PagerDuty severity + on-call routing
4. **Remediate** — Auto-runbook execution
5. **Verify** — Dynatrace/Elastic post-fix metrics
6. **Learn** — Incident post-mortem → runbook update

### 5.17 InfrastructureAgent — IaC & Container Ops
**Adapters:** docker, gitlab, aws, cloudflare, slack  
**Phases:**
1. **Plan** — GitLab CI pipeline + drift detection
2. **Build** — Docker image build + scan
3. **Test** — GitLab plan against AWS staging
4. **Deploy** — Cloudflare Worker + ECS rollout
5. **Monitor** — AWS CloudWatch + CF analytics
6. **Learn** — Cost + performance delta analysis

---

## 6. Production Deployment

For **local development** see the [Quick Start (Docker Compose)](#quick-start-docker-compose) at the top of this document — that's the canonical entry point for both the composer service and the broker.

### 6.1 GCP Production (Cloud Run)

Prerequisites:
- GCP project with Cloud Run, Cloud SQL (Postgres 15+), Secret Manager enabled
- Service account with `roles/cloudsql.client`, `roles/secretmanager.secretAccessor`

```bash
# 1. Create secrets
gcloud secrets create broker-api-key --data-file=<(openssl rand -hex 32)
gcloud secrets create gemini-api-key --data-file=<(echo -n YOUR_GEMINI_KEY)
gcloud secrets create postgres-dsn --data-file=<(echo -n "postgresql+asyncpg://user@/sentinel?host=/cloudsql/PROJECT:REGION:INSTANCE")

# 2. Build & deploy
gcloud builds submit --config cloudbuild.yaml

# 3. Verify
gcloud run services describe cybernetics-composer --region=us-central1
curl https://<URL>/healthz
curl https://<URL>/readyz
```

### 6.2 Cloud SQL Migration

```bash
# Apply schema
psql "host=/cloudsql/PROJECT:REGION:INSTANCE dbname=sentinel user=postgres" \
  -f migrations/001_init.sql
```

### 6.3 Hardening Checklist

The composer image already enforces the in-container half (distroless `nonroot`,
read-only FS, `cap_drop: ALL`, cosign-signed, SBOM-attested). The deployment
half is the operator's responsibility:

- [ ] Cloud Run `--no-allow-unauthenticated` enforced (or OIDC via `OIDC_ISSUER`/`OIDC_AUDIENCE`)
- [ ] Cloud Armor WAF + rate-limit policy in front of Cloud Run
- [ ] VPC-SC perimeter restricts egress to approved APIs only
- [ ] Cloud SQL private IP + IAM database authentication
- [ ] Secret Manager rotation policy (90 days)
- [ ] Cloud Audit Logs enabled for `data_access`, `admin_activity`
- [ ] `govulncheck` + `trivy fs` gates pass in CI (`.github/workflows/composer-security.yml`)
- [ ] Container scanning via Artifact Registry + Container Analysis

Full control mapping in [`docs/CONTROLS_NIST_800_53.md`](docs/CONTROLS_NIST_800_53.md);
threat model in [`docs/THREAT_MODEL.md`](docs/THREAT_MODEL.md).

---

## 7. Operations

### 7.1 Health & Readiness

```bash
# Liveness
curl https://<URL>/healthz

# Readiness (also verifies GEMINI_API_KEY presence)
curl https://<URL>/readyz

# Tool discovery
curl -H "Authorization: Bearer $API_KEY" https://<URL>/mcp/tools

# Circuit breaker status
curl -H "Authorization: Bearer $API_KEY" https://<URL>/mcp/circuits

# SSE health stream
curl -H "Authorization: Bearer $API_KEY" https://<URL>/mcp/sse
```

### 7.2 Structured Logging

Both surfaces emit JSON to `stdout`, captured by Cloud Logging.

**Composer (Go, `slog`)** — one line per HTTP request, correlation via `X-Request-ID`:

```json
{
  "time": "2026-05-19T14:32:01Z",
  "level": "INFO",
  "msg": "http.request",
  "request_id": "3f8a1c2b9e0d",
  "method": "POST",
  "path": "/api/compose",
  "status": 200,
  "bytes": 4823,
  "duration": 612,
  "remote": "10.0.0.42"
}
```

**Broker (Python)** — one line per tool invocation, correlation via `correlation_id`:

```json
{
  "timestamp": "2026-05-19T14:32:01Z",
  "level": "info",
  "event": "tool_executed",
  "adapter": "dynatrace",
  "tool": "dynatrace_get_problems",
  "latency_ms": 145,
  "session_id": "a1b2c3",
  "correlation_id": "req-xyz"
}
```

### 7.3 Runbook: Adapter Circuit Open

```bash
# 1. Diagnose
curl -H "Authorization: Bearer $API_KEY" https://<URL>/mcp/circuits
# → {"circuits": {"dynatrace": "OPEN"}}

# 2. Inspect Cloud Logging for failure reason
gcloud logging read "jsonPayload.breaker=dynatrace AND severity>=ERROR" --limit=10

# 3. Manual reset (if operator-verified)
# Restart Cloud Run revision to reset breaker state
gcloud run services update cybernetics-composer --region=us-central1
```

---

## 8. Testing

### Composer (Go)

```bash
go vet ./...
go test -race -count=1 -coverprofile=cover.out ./...
go tool cover -func=cover.out | tail -1

# Static analysis & vulnerability gates (same as CI)
golangci-lint run                       # config: .golangci.yml
gosec -severity medium -confidence medium ./...
govulncheck ./...
trivy fs --severity CRITICAL,HIGH --ignore-unfixed .
```

### Broker (Python)

```bash
pytest tests/ -v
pytest tests/ --cov=cybernetics --cov-fail-under=80
pip-audit --requirement requirements.txt
bandit -r cybernetics/
```

### Container scan

```bash
gcloud artifacts docker images scan us-central1-docker.pkg.dev/PROJECT/cybernetics/composer:latest
```

CI runs the full composer gate on every push/PR — see [`.github/workflows/composer-security.yml`](.github/workflows/composer-security.yml).

---

## 9. Google ADK Integration

```python
from cybernetics.adk.bridge import cybernetics_adk_agent
from google.adk.runners import Runner

runner = Runner(agent=cybernetics_adk_agent)
for event in runner.run("Deploy my-app to production"):
    print(event)
```

---

## 10. Agent Composer

The React + TypeScript UI and Go backend that generate Python agent code via
Gemini, serve the public adapter catalog at `/api/templates`, and expose the
operational dashboard. See the [Quick Start](#quick-start-docker-compose) at
the top of this document for setup instructions — it is the canonical entry point.

Runtime config is fully env-driven; the composer-side env-var matrix is
documented in [`AGENTS.md`](AGENTS.md) (project-wide AI-agent guide) and
[`SECURITY.md`](SECURITY.md) (control posture).

**Workflow:**
1. **Pick Template** — Choose from 18 agent templates (Sentinel, Deploy, Finance, Infra, Security, Data, Ops, Content, Commerce, Analytics, Google Workspace, Atlassian, Browser QA, CRM, Shopify, Database Ops, SRE Observability, Infrastructure)
2. **Select Adapters** — Toggle any of the 56 MCP adapters
3. **Configure Keys** — Enter API keys for selected adapters
4. **Compose** — Gemini generates a custom Python agent class
5. **Deploy** — One-click deploy to Google Cloud Run

**API Endpoints:**

| Endpoint | Method | Description |
|---|---|---|
| `/api/templates` | GET | List all 18 templates + 56 adapters |
| `/api/compose` | POST | Generate agent code via Gemini |
| `/api/deploy` | POST | Return Cloud Run deployment command |

**Example compose request:**

```bash
curl -X POST http://localhost:4001/api/compose \
  -H "Content-Type: application/json" \
  -d '{
    "template": "sentinel",
    "adapters": ["dynatrace", "slack", "datadog"],
    "env_vars": {"DYNATRACE_API_TOKEN": "xxx", "SLACK_BOT_TOKEN": "xoxb-xxx"},
    "prompt": "Add a custom phase that posts a daily digest to Slack"
  }'
```

---

## 11. Google ADK A2A, A2P & ERC-8004 Integration

Cybernetics agents implement Google's **Agent-to-Agent (A2A)** and **Agent-to-Protocol (A2P)** patterns for cross-agent interoperability.

### 11.1 A2A — Agent-to-Agent

Agents register capabilities in a shared `A2ARegistry`. Other agents can discover and invoke those capabilities dynamically.

```python
from cybernetics.a2a.hooks import A2ACapability, get_a2a_registry

cap = A2ACapability(
    id="sentinel_detect",
    name="Sentinel Problem Detection",
    description="Fetch active Dynatrace problems for a service",
    input_schema={"service": {"type": "string"}},
    output_schema={"problems": {"type": "array"}},
)
get_a2a_registry().register_capability(cap)
```

### 11.2 A2P — Agent-to-Protocol

Agents can subscribe to or emit protocol events for decoupled coordination.

```python
from cybernetics.a2a.hooks import A2PProtocol, get_a2a_registry

proto = A2PProtocol(
    id="incident_v1",
    name="Incident Stream",
    version="1.0",
    schema_uri="https://cybernetics.dev/schemas/incident.json",
    event_types=["detected", "resolved", "escalated"],
)
get_a2a_registry().register_protocol(proto)
```

### 11.3 ERC-8004 (8004.org)

**ERC-8004** is an Ethereum standard for agent capability discovery and identity, authored by Google. Cybernetics implements the on-chain resolution contract via `ERC8004Resolver`.

```python
from cybernetics.a2a.hooks import get_erc8004_resolver

resolver = get_erc8004_resolver()

# Query which capabilities are available
resolver.resolve(["sentinel_detect", "deploy_trigger"])
# → {"sentinel_detect": {"available": true, ...}, ...}

# Negotiate intersecting capabilities with a remote agent
resolver.negotiate([{"id": "sentinel_detect"}, {"id": "unknown_cap"}])
# → ["sentinel_detect"]
```

**Reference:** [8004.org](https://8004.org)

---

## 12. Extending Cybernetics

Cybernetics is designed to be easily extensible. Adapters placed in `cybernetics/adapters/` are **automatically discovered and registered** at startup via `auto_discover()`. To add a new MCP adapter, follow these steps:

### 1. Create the Adapter Class
Create a new file in `cybernetics/adapters/` (e.g., `my_service.py`). Inherit from `MCPAdapter` and implement the required methods:

```python
from typing import Dict, Any
from cybernetics.adapters.base import MCPAdapter
from cybernetics.config.settings import settings

class MyServiceAdapter(MCPAdapter):
    name = "myservice"
    description = "Integration with MyService API"

    def __init__(self):
        super().__init__()
        self._api_key = settings.myservice_api_key
        # Initialize your client (e.g., httpx.AsyncClient)
        self._setup_tools()

    def _setup_tools(self):
        self.register_tool(
            "myservice_get_data",
            "Fetch data from MyService",
            {"id": {"type": "string"}},
            ["id"],
            self._get_data,
        )

    async def _get_data(self, id: str):
        # Implementation logic
        return {"id": id, "data": "..."}

    async def health(self) -> Dict[str, Any]:
        return {"status": "healthy"}
```

### 2. Add Configuration
Add any required environment variables to `cybernetics/config/settings.py` using Pydantic `Field` with an `alias`:

```python
    # MyService
    myservice_api_key: str = Field("", alias="MYSERVICE_API_KEY")
```

### 3. Auto-Registration (No manual step needed)
Because `auto_discover()` scans `cybernetics/adapters/` at startup, your adapter will be picked up automatically. No imports or manual registration required.

If your adapter lives outside the standard directory, register it explicitly:

```python
from cybernetics.adapters.my_service import MyServiceAdapter
from cybernetics.registry.manager import register_adapter
register_adapter("myservice", MyServiceAdapter)
```

### 4. Verify
Run the integration tests and ensure your new adapter is listed in `/mcp/tools`.

---

## 13. Threat Model & Security Posture

Full STRIDE analysis lives in [`docs/THREAT_MODEL.md`](docs/THREAT_MODEL.md). Per-surface highlights:

### Composer service (Go, `cmd/composer/`)

| Threat | Mitigation | Verification |
|---|---|---|
| Anonymous API access | `BearerAuth` (constant-time) or `OIDCAuth` (RS256 JWT) | `internal/middleware/middleware_test.go`, `internal/oidc/oidc_test.go` |
| CSRF / hostile origin | Strict CORS allowlist; no wildcard echo | `TestCORS_AllowlistOnly` |
| Body-size DoS | `MaxBody` (1 MiB default, env-tunable) | `TestMaxBody_Enforces413OnOversize` |
| Per-IP request flood | Token-bucket rate limiter | `TestRateLimiter_*` |
| Panic stack-trace leak | `Recover` middleware → generic 500 | `TestRecover_TurnsPanicInto500` |
| Container escape | Distroless `nonroot`, `cap_drop: ALL`, `no-new-privileges`, read-only FS | `Dockerfile`, `docker-compose.yml` |
| Supply-chain compromise | stdlib-only Go, cosign keyless sign, CycloneDX SBOM attest, govulncheck + Trivy CI gates | `.github/workflows/composer-security.yml` |
| Missing audit trail | `slog` JSON with `X-Request-ID` correlation on every request | `internal/middleware/middleware.go` |

### Broker service (Python, `cybernetics/broker/`)

| Threat | Mitigation | Verification |
|---|---|---|
| Secret exfiltration from image | Multi-stage build; `.env` excluded; secrets via `--set-secrets` | `docker inspect` shows no `Env` secrets |
| Unauthorized broker access | `--no-allow-unauthenticated` + Identity-Aware Proxy (IAP) | `gcloud run services describe` |
| Timing attacks on API key | `hmac.compare_digest` + random delay on mismatch | Static analysis via `bandit` |
| DQL / SQL injection | Regex allow-list sanitization (`_sanitize_dql`) + parameterized queries | Unit test `test_dql_sanitization` |
| SSRF via adapter callbacks | URL prefix validation, no redirects, `httpx` timeout caps | Respx mock tests |
| ReDoS in regex filters | Bounded regex (`^...$`), no `.*` backtracking | Code review |
| Credential leakage in logs | `Guard` sentinel blocks keys named `password`, `secret`, `token` | `test_guard_blocks_sensitive` |
| Async blocking I/O | All clients are `httpx.AsyncClient`, `asyncpg`, etc. | `pytest-asyncio` coverage |

### Compliance Mapping

Full control-by-control coverage is in [`docs/CONTROLS_NIST_800_53.md`](docs/CONTROLS_NIST_800_53.md) (38 controls across 9 NIST 800-53 Rev 5 families, 66% fully implemented). Highlights:

- **NIST 800-53 Rev 5:** AC-3, AU-2/3/10, CM-2/6/7/8, SC-5/7/8/13/17, SI-7/10/11 — all ✅. Full STRIDE analysis in [`docs/THREAT_MODEL.md`](docs/THREAT_MODEL.md).
- **FedRAMP Moderate:** in-container controls covered; deployment controls (TLS, IdP, log storage) are operator-supplied via Cloud Run + Cloud SQL + Secret Manager.
- **SOC 2 Type II:** structured JSON audit logs with `X-Request-ID` correlation, captured by Cloud Logging.

---

## 14. License & Attribution

Licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**.
See `LICENSE` for the full text and `NOTICE` for third-party attributions.

Network use is distribution under the AGPL: anyone who interacts with this
software over a network is entitled to receive the corresponding source.

**Authors:** plasmaraygun, GoryGrey, royhodge812, sebuh-infsol

---

*For operational issues, contact the maintainers via GitHub Security Advisories. Do not open public issues for security-sensitive topics.*
