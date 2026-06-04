package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"strings"
	"time"
)

// ── Template definitions ────────────────────────────────────────────────

type Template struct {
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Adapters    []string `json:"adapters"`
	Phases      []string `json:"phases"`
}

var templates = []Template{
	{
		Name:        "sentinel",
		Description: "Self-healing SRE: detect → investigate → reason → act → evaluate → learn",
		Adapters:    []string{"dynatrace", "elastic", "postgres", "gitlab", "arize", "fivetran"},
		Phases:      []string{"Detect", "Investigate", "Reason", "Act", "Verify", "Evaluate", "Learn"},
	},
	{
		Name:        "deploy",
		Description: "CI/CD Orchestrator: validate → build → deploy → verify → learn",
		Adapters:    []string{"github", "vercel", "aws", "postgres"},
		Phases:      []string{"Validate", "Build", "Deploy", "Verify", "Learn"},
	},
	{
		Name:        "finance",
		Description: "Payment Anomaly Detection: detect → investigate → reconcile → refund → learn",
		Adapters:    []string{"stripe", "supabase", "postgres"},
		Phases:      []string{"Detect", "Investigate", "Reason", "Act", "Learn"},
	},
	{
		Name:        "infra",
		Description: "Infrastructure Optimization: detect latency → DNS + infra → optimize → deploy → verify → learn",
		Adapters:    []string{"dynatrace", "cloudflare", "aws", "postgres"},
		Phases:      []string{"Detect", "Investigate", "Reason", "Act", "Verify", "Learn"},
	},
	{
		Name:        "security",
		Description: "Vulnerability & Secret Scanning: scan → assess → triage → remediate → verify → learn",
		Adapters:    []string{"github", "slack", "postgres", "cloudflare", "datadog"},
		Phases:      []string{"Scan", "Assess", "Triage", "Remediate", "Verify", "Learn"},
	},
	{
		Name:        "data",
		Description: "ETL Pipeline Orchestration: extract → validate → transform → load → monitor → learn",
		Adapters:    []string{"postgres", "supabase", "fivetran", "slack"},
		Phases:      []string{"Extract", "Validate", "Transform", "Load", "Monitor", "Learn"},
	},
	{
		Name:        "ops",
		Description: "General DevOps Orchestration: observe → diagnose → act → notify → learn",
		Adapters:    []string{"datadog", "slack", "github", "linear", "postgres"},
		Phases:      []string{"Observe", "Diagnose", "Act", "Notify", "Learn"},
	},
	{
		Name:        "content",
		Description: "Content Operations: plan → draft → review → publish → distribute → learn",
		Adapters:    []string{"notion", "linear", "slack"},
		Phases:      []string{"Plan", "Draft", "Review", "Publish", "Distribute", "Learn"},
	},
	{
		Name:        "commerce",
		Description: "E-commerce Operations: catalog → pricing → checkout → fulfillment → reconcile → notify",
		Adapters:    []string{"stripe", "supabase", "aws", "slack"},
		Phases:      []string{"Catalog", "Pricing", "Checkout", "Fulfillment", "Reconcile", "Notify"},
	},
	{
		Name:        "analytics",
		Description: "Metrics & Alerting: collect → aggregate → detect anomaly → alert → visualize → learn",
		Adapters:    []string{"datadog", "postgres", "elastic", "slack"},
		Phases:      []string{"Collect", "Aggregate", "Detect", "Alert", "Visualize", "Learn"},
	},
	{
		Name:        "google-workspace",
		Description: "Workspace Automation: monitor → triage → draft → schedule → notify → archive",
		Adapters:    []string{"google-workspace", "slack"},
		Phases:      []string{"Monitor", "Triage", "Draft", "Schedule", "Notify", "Archive"},
	},
	{
		Name:        "atlassian",
		Description: "Engineering Project Management: backlog → sprint → review → deploy → retro → learn",
		Adapters:    []string{"jira", "confluence", "github", "slack"},
		Phases:      []string{"Backlog", "Sprint", "Review", "Deploy", "Retro", "Learn"},
	},
	{
		Name:        "browser-qa",
		Description: "Frontend QA Automation: scan → test → screenshot → compare → report → learn",
		Adapters:    []string{"browser", "chrome", "firefox", "slack"},
		Phases:      []string{"Scan", "Test", "Screenshot", "Compare", "Report", "Learn"},
	},
	{
		Name:        "crm",
		Description: "Sales Operations: lead → qualify → proposal → close → onboard → nurture",
		Adapters:    []string{"airtable", "google-workspace", "slack"},
		Phases:      []string{"Lead", "Qualify", "Proposal", "Close", "Onboard", "Nurture"},
	},
	{
		Name:        "shopify-commerce",
		Description: "Shopify Store Ops: inventory → pricing → order → fulfill → refund → review",
		Adapters:    []string{"shopify", "stripe", "postgres", "slack"},
		Phases:      []string{"Inventory", "Pricing", "Order", "Fulfill", "Refund", "Review"},
	},
	{
		Name:        "database-ops",
		Description: "Polyglot Database Ops: monitor → diagnose → migrate → optimise → backup → learn",
		Adapters:    []string{"mongodb", "redis", "postgres", "datadog", "slack"},
		Phases:      []string{"Monitor", "Diagnose", "Migrate", "Optimise", "Backup", "Learn"},
	},
	{
		Name:        "sre-observability",
		Description: "Full-Stack Observability: detect → correlate → escalate → remediate → verify → learn",
		Adapters:    []string{"dynatrace", "elastic", "datadog", "pagerduty", "slack"},
		Phases:      []string{"Detect", "Correlate", "Escalate", "Remediate", "Verify", "Learn"},
	},
	{
		Name:        "infrastructure",
		Description: "IaC & Container Ops: plan → build → test → deploy → monitor → learn",
		Adapters:    []string{"docker", "gitlab", "aws", "cloudflare", "slack"},
		Phases:      []string{"Plan", "Build", "Test", "Deploy", "Monitor", "Learn"},
	},
}

type Adapter struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Source      string `json:"source"`
	Group       string `json:"group,omitempty"`
}

var adapters = []Adapter{
	// ── Non-Google (alphabetical) ──
	{Name: "airtable", Description: "Spreadsheet-database hybrid — bases, records, views", Source: "https://support.airtable.com/docs/using-the-airtable-mcp-server"},
	{Name: "arize", Description: "ML observability — evaluation, judging, logging", Source: "https://github.com/Arize-ai/arize-tracing-assistant"},
	{Name: "asana", Description: "Project & task management — projects, tasks, portfolios", Source: "https://developers.asana.com/docs/mcp-server"},
	{Name: "aws", Description: "Cloud infrastructure — S3, EC2, Lambda, CloudWatch", Source: "https://github.com/awslabs/mcp"},
	{Name: "brave", Description: "Brave Search — privacy-first web search", Source: "https://github.com/brave/brave-search-mcp-server"},
	{Name: "browser", Description: "Playwright browser automation — navigate, screenshot, evaluate", Source: "https://github.com/microsoft/playwright-mcp"},
	{Name: "chrome", Description: "Chrome DevTools Protocol — debugging, profiling", Source: "https://github.com/ChromeDevTools/chrome-devtools-mcp"},
	{Name: "cloudflare", Description: "Edge network — DNS, Workers, zones", Source: "https://github.com/cloudflare/mcp-server-cloudflare"},
	{Name: "confluence", Description: "Team documentation — pages, spaces, search", Source: "https://github.com/atlassian/atlassian-mcp-server"},
	{Name: "datadog", Description: "Monitoring & metrics — dashboards, alerts, logs", Source: "https://github.com/datadog-labs/mcp-server"},
	{Name: "docker", Description: "Container management — images, containers, compose", Source: "https://docs.docker.com/ai/mcp-catalog-and-toolkit/"},
	{Name: "dynatrace", Description: "Observability & AIOps — problems, traces, DQL", Source: "https://github.com/dynatrace-oss/dynatrace-mcp"},
	{Name: "elastic", Description: "Search & analytics — incidents, runbooks, insights", Source: "https://github.com/elastic/mcp-server-elasticsearch"},
	{Name: "fivetran", Description: "Data pipeline automation — connectors, syncs", Source: "https://github.com/fivetran/fivetran-mcp"},
	{Name: "firefox", Description: "Firefox DevTools — debugging, console, network", Source: "https://github.com/mozilla/firefox-devtools-mcp"},
	{Name: "github", Description: "Repos, issues, PRs, Actions — full GitHub API", Source: "https://github.com/github/github-mcp-server"},
	{Name: "gitlab", Description: "Git repos & CI/CD — issues, MRs, pipelines", Source: "https://docs.gitlab.com/user/gitlab_duo/model_context_protocol/mcp_server/"},
	{Name: "jira", Description: "Agile project management — issues, sprints, boards", Source: "https://github.com/atlassian/atlassian-mcp-server"},
	{Name: "kubernetes", Description: "Kubernetes cluster ops — pods, services, deployments", Source: "https://github.com/kubernetes/mcp"},
	{Name: "linear", Description: "Issue tracking — teams, issues, projects", Source: "https://linear.app/docs/mcp"},
	{Name: "mongodb", Description: "Document database — CRUD, aggregation, indexing", Source: "https://www.mongodb.com/docs/mcp-server/get-started/"},
	{Name: "n8n", Description: "Workflow automation — triggers, nodes, executions", Source: "https://docs.n8n.io/advanced-ai/mcp/accessing-n8n-mcp-server/"},
	{Name: "notion", Description: "Docs & databases — pages, blocks, queries", Source: "https://github.com/makenotion/notion-mcp-server"},
	{Name: "pagerduty", Description: "Incident response — on-call, alerts, escalations", Source: "https://github.com/PagerDuty/pagerduty-mcp-server"},
	{Name: "postgres", Description: "Relational database — patterns, incidents, logs", Source: "https://github.com/prisma/mcp"},
	{Name: "quickbooks", Description: "Accounting — invoices, customers, payments, reports", Source: "https://github.com/intuit/quickbooks-online-mcp-server"},
	{Name: "redis", Description: "In-memory data store — keys, streams, pub/sub", Source: "https://github.com/redis/mcp-redis"},
	{Name: "shopify", Description: "E-commerce — products, orders, customers, inventory", Source: "https://shopify.dev/docs/apps/build/storefront-mcp/servers/storefront"},
	{Name: "slack", Description: "Workspace messaging — channels, users, files", Source: "https://docs.slack.dev/ai/slack-mcp-server/"},
	{Name: "snowflake", Description: "Cloud data warehouse — SQL, warehouses, shares", Source: "https://github.com/Snowflake-Labs/mcp"},
	{Name: "stripe", Description: "Payments & billing — customers, charges, subscriptions", Source: "https://github.com/mcp/com.stripe/mcp"},
	{Name: "supabase", Description: "Backend-as-a-service — DB, auth, realtime", Source: "https://supabase.com/docs/guides/ai-tools/mcp"},
	{Name: "vercel", Description: "Frontend deployments — projects, deployments, env vars", Source: "https://github.com/vercel-labs/mcp-on-vercel"},

	// ── Google MCP Hub (individual servers) ──
	{Name: "google-alloydb", Description: "AlloyDB for PostgreSQL — managed PostgreSQL", Source: "https://github.com/google/mcp", Group: "google"},
	{Name: "google-analytics", Description: "Google Analytics — metrics, audiences, reports", Source: "https://github.com/googleanalytics/google-analytics-mcp", Group: "google"},
	{Name: "google-bigtable", Description: "Cloud Bigtable — wide-column NoSQL", Source: "https://github.com/google/mcp", Group: "google"},
	{Name: "google-chronicle", Description: "Google Security Operations (Chronicle) — threat intel", Source: "https://github.com/google/mcp", Group: "google"},
	{Name: "google-cloud-resource-manager", Description: "Cloud Resource Manager — projects, folders, org", Source: "https://github.com/google/mcp", Group: "google"},
	{Name: "google-cloud-run", Description: "Cloud Run — serverless containers", Source: "https://github.com/GoogleCloudPlatform/cloud-run-mcp", Group: "google"},
	{Name: "google-cloud-sql-mysql", Description: "Cloud SQL for MySQL — managed MySQL", Source: "https://github.com/google/mcp", Group: "google"},
	{Name: "google-cloud-sql-postgres", Description: "Cloud SQL for PostgreSQL — managed PostgreSQL", Source: "https://github.com/google/mcp", Group: "google"},
	{Name: "google-cloud-sql-sqlserver", Description: "Cloud SQL for SQL Server — managed SQL Server", Source: "https://github.com/google/mcp", Group: "google"},
	{Name: "google-cloud-storage", Description: "Cloud Storage — object store (GCS)", Source: "https://github.com/googleapis/gcloud-mcp/tree/main/packages/storage-mcp", Group: "google"},
	{Name: "google-compute-engine", Description: "Compute Engine (GCE) — VMs, disks, networks", Source: "https://github.com/google/mcp", Group: "google"},
	{Name: "google-developer-knowledge", Description: "Developer Knowledge API — Google Developer Documentation", Source: "https://github.com/google/mcp", Group: "google"},
	{Name: "google-firebase", Description: "Firebase — auth, Firestore, Hosting, FCM", Source: "https://github.com/google/mcp", Group: "google"},
	{Name: "google-firestore", Description: "Cloud Firestore — document database", Source: "https://github.com/google/mcp", Group: "google"},
	{Name: "google-flutter", Description: "Flutter/Dart — mobile/web SDK", Source: "https://github.com/dart-lang/ai/tree/main/pkgs/dart_mcp_server", Group: "google"},
	{Name: "google-gcloud", Description: "gcloud CLI — deploy, config, IAM", Source: "https://github.com/googleapis/gcloud-mcp/tree/main/packages/gcloud-mcp", Group: "google"},
	{Name: "google-genmedia", Description: "Genmedia — Imagen & Veo models", Source: "https://github.com/GoogleCloudPlatform/vertex-ai-creative-studio/tree/main/experiments/mcp-genmedia", Group: "google"},
	{Name: "google-gke", Description: "Kubernetes Engine (GKE) — clusters, workloads", Source: "https://github.com/GoogleCloudPlatform/gke-mcp", Group: "google"},
	{Name: "google-go", Description: "Go / gopls — Go language server", Source: "https://go.dev/gopls/features/mcp", Group: "google"},
	{Name: "google-maps", Description: "Google Maps Platform — geocoding, routing, Places", Source: "https://developers.google.com/maps/ai/code-assist", Group: "google"},
	{Name: "google-mcp-toolbox", Description: "MCP Toolbox for Databases — BigQuery, Cloud SQL, AlloyDB, Spanner, Firestore", Source: "https://github.com/googleapis/mcp-toolbox", Group: "google"},
	{Name: "google-observability", Description: "Google Cloud Observability — monitoring, logging, tracing", Source: "https://github.com/googleapis/gcloud-mcp/tree/main/packages/observability-mcp", Group: "google"},
	{Name: "google-spanner", Description: "Cloud Spanner — globally distributed SQL", Source: "https://github.com/google/mcp", Group: "google"},
	{Name: "google-workspace", Description: "Google Workspace — Docs, Sheets, Slides, Calendar, Gmail", Source: "https://github.com/gemini-cli-extensions/workspace", Group: "google"},
}

// ── Request / Response types ──────────────────────────────────────────

type ComposeRequest struct {
	Template   string            `json:"template"`
	Adapters   []string          `json:"adapters"`
	EnvVars    map[string]string `json:"env_vars"`
	Prompt     string            `json:"prompt"`
}

type ComposeResponse struct {
	AgentCode  string `json:"agent_code"`
	Dockerfile string `json:"dockerfile"`
}

type DeployRequest struct {
	ProjectID   string `json:"project_id"`
	Region      string `json:"region"`
	ServiceName string `json:"service_name"`
	AgentCode   string `json:"agent_code"`
}

type ChatRequest struct {
	Message string        `json:"message"`
	History []ChatMessage `json:"history"`
	Model   string        `json:"model"`
	Context ChatContext   `json:"context"`
}

type ChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type ChatContext struct {
	Template string            `json:"template"`
	Adapters []string          `json:"adapters"`
	EnvVars  map[string]string `json:"env_vars"`
}

type ChatResponse struct {
	Reply      string `json:"reply"`
	Action     string `json:"action"`
	ActionData any    `json:"action_data,omitempty"`
}

// ── Gemini client ───────────────────────────────────────────────────

func callGemini(ctx context.Context, prompt string) (string, error) {
	apiKey := os.Getenv("GEMINI_API_KEY")
	if apiKey == "" {
		return "", fmt.Errorf("GEMINI_API_KEY not set")
	}

	body := map[string]any{
		"contents": []map[string]any{
			{"parts": []map[string]any{{"text": prompt}}},
		},
		"generationConfig": map[string]any{
			"temperature":     0.2,
			"maxOutputTokens": 8192,
		},
	}
	b, _ := json.Marshal(body)

	url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=%s", apiKey)
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(b))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("gemini HTTP %d", resp.StatusCode)
	}

	var result struct {
		Candidates []struct {
			Content struct {
				Parts []struct {
					Text string `json:"text"`
				} `json:"parts"`
			} `json:"content"`
		} `json:"candidates"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}
	if len(result.Candidates) == 0 || len(result.Candidates[0].Content.Parts) == 0 {
		return "", fmt.Errorf("empty gemini response")
	}
	return result.Candidates[0].Content.Parts[0].Text, nil
}

// ── HTTP Handlers ───────────────────────────────────────────────────

func listTemplates(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"templates": templates,
		"adapters":  adapters,
	})
}

func composeAgent(w http.ResponseWriter, r *http.Request) {
	var req ComposeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	var sb strings.Builder
	sb.WriteString("You are an expert Python developer. Generate a production-ready async agent class using the Cybernetics MCP framework.\n\n")
	sb.WriteString(fmt.Sprintf("Base template: %s\n", req.Template))
	sb.WriteString(fmt.Sprintf("Selected adapters: %v\n", req.Adapters))
	sb.WriteString("Requirements:\n")
	sb.WriteString("- Import from cybernetics.agents.base import AgentTemplate\n")
	sb.WriteString("- Use self.registry.execute(adapter_name, tool_name, args) pattern\n")
	sb.WriteString("- Include proper error handling, structured logging, tenacity retries\n")
	sb.WriteString("- Return a dict with status, session_id, and results\n")
	sb.WriteString("- Use uuid for session_id\n\n")
	if req.Prompt != "" {
		sb.WriteString(fmt.Sprintf("User requirements: %s\n\n", req.Prompt))
	}
	sb.WriteString("Output ONLY the Python code inside a markdown code block. No explanations.\n")

	ctx, cancel := context.WithTimeout(r.Context(), 60*time.Second)
	defer cancel()

	code, err := callGemini(ctx, sb.String())
	if err != nil {
		slog.Error("gemini compose failed", "error", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	code = strings.TrimPrefix(code, "```python")
	code = strings.TrimPrefix(code, "```")
	code = strings.TrimSuffix(code, "```")
	code = strings.TrimSpace(code)

	dockerfile := `FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["python", "-m", "agent"]
`

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(ComposeResponse{
		AgentCode:  code,
		Dockerfile: dockerfile,
	})
}

func deployAgent(w http.ResponseWriter, r *http.Request) {
	var req DeployRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if req.ProjectID == "" || req.Region == "" || req.ServiceName == "" {
		http.Error(w, "missing project_id, region, or service_name", http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"status":     "ready",
		"message":    "Agent package generated. Deploy with gcloud or the CLI.",
		"project_id": req.ProjectID,
		"region":     req.Region,
		"service":    req.ServiceName,
		"command": fmt.Sprintf(
			"gcloud run deploy %s --project %s --region %s --source . --allow-unauthenticated",
			req.ServiceName, req.ProjectID, req.Region,
		),
	})
}

func chatAgent(w http.ResponseWriter, r *http.Request) {
	var req ChatRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	apiKey := os.Getenv("GEMINI_API_KEY")
	if apiKey == "" {
		http.Error(w, "GEMINI_API_KEY not set", http.StatusServiceUnavailable)
		return
	}

	var tmplNames []string
	for _, t := range templates {
		tmplNames = append(tmplNames, t.Name)
	}
	var adapterNames []string
	for _, a := range adapters {
		adapterNames = append(adapterNames, a.Name)
	}

	sysPrompt := fmt.Sprintf(`You are the Cybernetics Composer — an expert agent builder.
Available templates: %v
Available adapters: %v

When the user wants to compose an agent, return JSON with:
- "reply": friendly text
- "action": one of [show_templates, show_adapters, show_keys, compose, deploy, none]
- "action_data": optional payload for the action

If the user just wants to chat, use action "none".
If the user asks to see templates, use action "show_templates".
If they mention specific adapters, use action "show_adapters" with adapter names.
If they want to deploy, use action "show_deploy".
`, tmplNames, adapterNames)

	contents := []map[string]any{
		{"role": "user", "parts": []map[string]any{{"text": sysPrompt}}},
		{"role": "model", "parts": []map[string]any{{"text": "Understood. I'm ready to help you build agents."}}},
	}
	for _, m := range req.History {
		role := m.Role
		if role == "assistant" {
			role = "model"
		}
		contents = append(contents, map[string]any{
			"role":  role,
			"parts": []map[string]any{{"text": m.Content}},
		})
	}
	contents = append(contents, map[string]any{
		"role":  "user",
		"parts": []map[string]any{{"text": req.Message}},
	})

	body := map[string]any{
		"contents": contents,
		"generationConfig": map[string]any{
			"temperature":     0.3,
			"maxOutputTokens": 2048,
		},
	}
	b, _ := json.Marshal(body)

	model := req.Model
	if model == "" {
		model = "gemini-3-flash-preview"
	}
	url := fmt.Sprintf("[https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s](https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s)", model, apiKey)
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	gr, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(b))
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	gr.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(gr)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		http.Error(w, fmt.Sprintf("gemini HTTP %d", resp.StatusCode), http.StatusInternalServerError)
		return
	}

	var result struct {
		Candidates []struct {
			Content struct {
				Parts []struct {
					Text string `json:"text"`
				} `json:"parts"`
			} `json:"content"`
		} `json:"candidates"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if len(result.Candidates) == 0 || len(result.Candidates[0].Content.Parts) == 0 {
		http.Error(w, "empty gemini response", http.StatusInternalServerError)
		return
	}

	text := result.Candidates[0].Content.Parts[0].Text

	var actionData any
	action := "none"
	reply := text

	if idx := strings.Index(text, "```json"); idx != -1 {
		end := strings.Index(text[idx+7:], "```")
		if end != -1 {
			jsonStr := text[idx+7 : idx+7+end]
			jsonStr = strings.TrimSpace(jsonStr)
			var parsed map[string]any
			if err := json.Unmarshal([]byte(jsonStr), &parsed); err == nil {
				if a, ok := parsed["action"].(string); ok {
					action = a
				}
				if r, ok := parsed["reply"].(string); ok {
					reply = r
				}
				if d, ok := parsed["action_data"]; ok {
					actionData = d
				}
			}
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(ChatResponse{
		Reply:      reply,
		Action:     action,
		ActionData: actionData,
	})
}

// ── Middleware ────────────────────────────────────────────────────────

func cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin == "" {
			origin = "*"
		}
		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func main() {
	mux := http.NewServeMux()

	// API Endpoints
	mux.HandleFunc("/api/templates", listTemplates)
	mux.HandleFunc("/api/compose", composeAgent)
	mux.HandleFunc("/api/deploy", deployAgent)
	mux.HandleFunc("/api/chat", chatAgent)

	// Serve Static Frontend
	// This serves files from the ./static folder (where Vite build output is copied)
	fs := http.FileServer(http.Dir("./static"))
	mux.Handle("/", fs)

	var handler http.Handler = mux
	handler = cors(handler)

	port := os.Getenv("PORT")
	if port == "" {
		port = "3001"
	}
	slog.Info("server starting", "port", port)
	if err := http.ListenAndServe(":"+port, handler); err != nil {
		slog.Error("server failed", "error", err)
		os.Exit(1)
	}
}