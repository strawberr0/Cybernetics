package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync/atomic"
	"time"

	"github.com/strawberryfield/cybernetics/internal/middleware"
	"github.com/strawberryfield/cybernetics/internal/oidc"
)


// requirePOST writes 405 with an Allow header and returns false if the
// request is not a POST. Mutating /api/* routes call this first.
func requirePOST(w http.ResponseWriter, r *http.Request) bool {
	if r.Method == http.MethodPost {
		return true
	}
	w.Header().Set("Allow", "POST")
	http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
	return false
}

// decodeJSONBody decodes r.Body into dst. If the body exceeds MaxBytesReader's
// limit the response is 413 Payload Too Large; on parse errors it's 400.
// Returns false if the response has been written.
func decodeJSONBody(w http.ResponseWriter, r *http.Request, dst any) bool {
	if err := json.NewDecoder(r.Body).Decode(dst); err != nil {
		var mbe *http.MaxBytesError
		if errors.As(err, &mbe) {
			http.Error(w, "Payload Too Large", http.StatusRequestEntityTooLarge)
			return false
		}
		http.Error(w, err.Error(), http.StatusBadRequest)
		return false
	}
	return true
}

// oidcAdapter bridges *oidc.Verifier to middleware.TokenVerifier (which
// returns `any` to avoid an import cycle in the middleware package).
type oidcAdapter struct{ v *oidc.Verifier }

func (a oidcAdapter) Verify(ctx context.Context, token string) (any, error) {
	return a.v.Verify(ctx, token)
}

// build-time metadata injected via -ldflags
var (
	buildVersion = "dev"
	buildCommit  = "unknown"
)

// readiness is flipped to true once startup probes pass.
var ready atomic.Bool

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
	Template string            `json:"template"`
	Adapters []string          `json:"adapters"`
	EnvVars  map[string]string `json:"env_vars"`
	Prompt   string            `json:"prompt"`
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
	Message   string        `json:"message"`
	History   []ChatMessage `json:"history"`
	Model     string        `json:"model"`
	GeminiKey string        `json:"gemini_key"`
	Context   ChatContext   `json:"context"`
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

	model := os.Getenv("GEMINI_MODEL")
	if model == "" {
		model = "gemini-3-flash-preview"
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

	url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s", model, apiKey)
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
	_ = json.NewEncoder(w).Encode(map[string]any{
		"templates": templates,
		"adapters":  adapters,
	})
}

func composeAgent(w http.ResponseWriter, r *http.Request) {
	if !requirePOST(w, r) {
		return
	}
	var req ComposeRequest
	if !decodeJSONBody(w, r, &req) {
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
	_ = json.NewEncoder(w).Encode(ComposeResponse{
		AgentCode:  code,
		Dockerfile: dockerfile,
	})
}

func deployAgent(w http.ResponseWriter, r *http.Request) {
	if !requirePOST(w, r) {
		return
	}
	var req DeployRequest
	if !decodeJSONBody(w, r, &req) {
		return
	}

	if req.ProjectID == "" || req.Region == "" || req.ServiceName == "" {
		http.Error(w, "missing project_id, region, or service_name", http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
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

// extractJSONEnvelope returns the JSON object substring from a Gemini reply,
// tolerating: ```json fences, plain ``` fences, leading/trailing prose, and
// bare top-level objects. Returns "" if no balanced object is found.
func extractJSONEnvelope(text string) string {
	s := strings.TrimSpace(text)
	if i := strings.Index(s, "```json"); i != -1 {
		s = s[i+7:]
		if j := strings.Index(s, "```"); j != -1 {
			return strings.TrimSpace(s[:j])
		}
	}
	if i := strings.Index(s, "```"); i != -1 {
		s = s[i+3:]
		if j := strings.Index(s, "```"); j != -1 {
			candidate := strings.TrimSpace(s[:j])
			if strings.HasPrefix(candidate, "{") {
				return candidate
			}
		}
	}
	start := strings.Index(s, "{")
	if start == -1 {
		return ""
	}
	depth, inStr, esc := 0, false, false
	for i := start; i < len(s); i++ {
		c := s[i]
		if inStr {
			if esc {
				esc = false
				continue
			}
			if c == '\\' {
				esc = true
				continue
			}
			if c == '"' {
				inStr = false
			}
			continue
		}
		switch c {
		case '"':
			inStr = true
		case '{':
			depth++
		case '}':
			depth--
			if depth == 0 {
				return s[start : i+1]
			}
		}
	}
	return ""
}

func chatAgent(w http.ResponseWriter, r *http.Request) {
	if !requirePOST(w, r) {
		return
	}
	var req ChatRequest
	if !decodeJSONBody(w, r, &req) {
		return
	}

	apiKey := strings.TrimSpace(req.GeminiKey)
	if apiKey == "" {
		apiKey = os.Getenv("GEMINI_API_KEY")
	}
	if apiKey == "" {
		http.Error(w, "GEMINI_API_KEY not set (provide via server env or `gemini_key` in request)", http.StatusServiceUnavailable)
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
	url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s", model, apiKey)
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

	if jsonStr := extractJSONEnvelope(text); jsonStr != "" {
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

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(ChatResponse{
		Reply:      reply,
		Action:     action,
		ActionData: actionData,
	})
}

// ── /api/config ───────────────────────────────────────────────────────

// apiConfig advertises non-secret server capabilities to the frontend so it
// can hide developer-only UI in production (e.g. the localStorage Gemini key
// input when the server already has a key).
func apiConfig(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"server_has_gemini_key": os.Getenv("GEMINI_API_KEY") != "",
		"auth_mode":             authMode(),
		"version":               buildVersion,
		"commit":                buildCommit,
	})
}

func authMode() string {
	switch {
	case os.Getenv("OIDC_ISSUER") != "" && os.Getenv("OIDC_AUDIENCE") != "":
		return "oidc"
	case os.Getenv("AUTH_TOKEN") != "":
		return "bearer"
	default:
		return "none"
	}
}

// ── Health probes ─────────────────────────────────────────────────────

// healthz is a liveness probe — succeeds if the process is responsive.
// It never depends on external services.
func healthz(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"status":  "ok",
		"version": buildVersion,
		"commit":  buildCommit,
	})
}

// readyz is a readiness probe — succeeds once startup completes AND the
// Gemini API key is configured. Use in K8s/Cloud Run for traffic gating.
func readyz(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if !ready.Load() {
		w.WriteHeader(http.StatusServiceUnavailable)
		_ = json.NewEncoder(w).Encode(map[string]any{"status": "starting"})
		return
	}
	if os.Getenv("GEMINI_API_KEY") == "" {
		w.WriteHeader(http.StatusServiceUnavailable)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"status": "degraded",
			"reason": "GEMINI_API_KEY not set",
		})
		return
	}
	_ = json.NewEncoder(w).Encode(map[string]any{"status": "ready"})
}

// ── Server bootstrap ─────────────────────────────────────────────────

// envInt parses a positive int env var with a default if unset/invalid.
func envInt(key string, def int) int {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			return n
		}
	}
	return def
}

// envFloat parses a positive float env var with a default if unset/invalid.
func envFloat(key string, def float64) float64 {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		if n, err := strconv.ParseFloat(v, 64); err == nil && n > 0 {
			return n
		}
	}
	return def
}

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}))
	slog.SetDefault(logger)

	port := strings.TrimSpace(os.Getenv("PORT"))
	if port == "" {
		port = "8080" // Cloud Run convention; override via $PORT.
	}
	authToken := os.Getenv("AUTH_TOKEN")
	oidcIssuer := strings.TrimSpace(os.Getenv("OIDC_ISSUER"))
	oidcAudience := strings.TrimSpace(os.Getenv("OIDC_AUDIENCE"))
	var oidcMW func(http.Handler) http.Handler
	if oidcIssuer != "" && oidcAudience != "" {
		v, err := oidc.NewVerifier(oidc.Config{Issuer: oidcIssuer, Audience: oidcAudience})
		if err != nil {
			logger.Error("oidc verifier init failed", slog.String("error", err.Error()))
			os.Exit(1)
		}
		oidcMW = middleware.OIDCAuth(oidcAdapter{v: v}, "/healthz", "/readyz")
		logger.Info("OIDC enabled", slog.String("issuer", oidcIssuer), slog.String("audience", oidcAudience))
	}
	corsAllowlist := []string{}
	if raw := strings.TrimSpace(os.Getenv("CORS_ALLOWED_ORIGINS")); raw != "" {
		corsAllowlist = strings.Split(raw, ",")
	}
	maxBody := int64(envInt("MAX_BODY_BYTES", 1<<20))
	rlBurst := envFloat("RATE_LIMIT_BURST", 60)
	rlRate := envFloat("RATE_LIMIT_PER_SEC", 10)

	if authToken == "" {
		logger.Warn("AUTH_TOKEN is empty — /api/* endpoints are unauthenticated (dev mode)")
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", healthz)
	mux.HandleFunc("/readyz", readyz)

	apiMux := http.NewServeMux()
	apiMux.HandleFunc("/api/templates", listTemplates)
	apiMux.HandleFunc("/api/config", apiConfig)
	apiMux.Handle("/api/compose", middleware.MaxBody(maxBody)(http.HandlerFunc(composeAgent)))
	apiMux.Handle("/api/deploy", middleware.MaxBody(maxBody)(http.HandlerFunc(deployAgent)))
	apiMux.Handle("/api/chat", middleware.MaxBody(maxBody)(http.HandlerFunc(chatAgent)))

	fs := http.FileServer(http.Dir("./static"))
	rl := middleware.NewRateLimiter(rlBurst, rlRate)

	// Auth precedence: OIDC > Bearer > none (dev).
	authMW := middleware.BearerAuth(authToken, "/healthz", "/readyz")
	if oidcMW != nil {
		authMW = oidcMW
	}
	mux.Handle("/api/", middleware.Chain(
		apiMux,
		authMW,
		rl.Middleware,
	))
	mux.Handle("/", fs)

	handler := middleware.Chain(
		mux,
		middleware.WithRequestID,
		middleware.AccessLog(logger),
		middleware.Recover(logger),
		middleware.SecurityHeaders,
		middleware.CORS(corsAllowlist),
	)

	srv := &http.Server{
		Addr:              ":" + port,
		Handler:           handler,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      90 * time.Second,
		IdleTimeout:       120 * time.Second,
		MaxHeaderBytes:    1 << 14,
	}

	ready.Store(true)
	logger.Info("server starting",
		slog.String("port", port),
		slog.String("version", buildVersion),
		slog.String("commit", buildCommit),
		slog.Bool("auth_enabled", authToken != ""),
		slog.Int("cors_origins", len(corsAllowlist)),
	)
	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		logger.Error("server failed", slog.String("error", err.Error()))
		os.Exit(1)
	}
}
