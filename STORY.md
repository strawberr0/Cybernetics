# Cybernetics — Composable Meta-MCP for Google Cloud Agents

> **▶ Live demo:** https://cybernetics.sh
> **Repo:** https://gitlab.com/strawberryfield/cybernetics

## Inspiration

Every team we talked to had the same problem: their agents could *talk* about
work but couldn't actually *do* it. The bottleneck wasn't the model — Gemini 3
reasons just fine. The bottleneck was the **glue**. Every new tool meant a new
MCP server, a new auth surface, a new failure mode, a new audit blind spot.
Nobody wants to bolt 20 separate stdio servers onto Claude / Cursor / Vertex
just to get an agent that can read Postgres, ship a GitLab MR, page Dynatrace,
and post to Slack.

We wanted **one control plane**. One bearer token. One audit log. One catalog
that an agent — or a human — could compose against. That's Cybernetics.

## What it does

Cybernetics is a **composable Model Context Protocol (MCP) meta-broker** for
Google Cloud agent stacks. It does three things:

1. **Aggregates 56 third-party MCP servers** (GitLab, Elastic, MongoDB,
   Dynatrace, Fivetran, Arize, Postgres, Stripe, AWS, Cloudflare, Playwright,
   …) into one stdio MCP peer. Drop `cybernetics-mcp` into any MCP client and
   you instantly get every tool the broker advertises — under one auth token,
   one circuit-breaker layer, one audit trail.
2. **Composer service** — a Go (stdlib-only) HTTP backend + React 19 / Vite UI
   that lets you pick adapters, describe a goal in natural language, and have
   **Gemini 3** generate a runnable Python agent (Google ADK / Vertex AI) that
   wires those adapters into a multi-phase plan.
3. **Agent templates** — Sentinel, DeployAgent, FinanceAgent, InfraAgent —
   prebuilt multi-step missions that demonstrate "agent, not chatbot": plan,
   call tools, observe, replan, finish.

**Track: GitLab.** Our flagship demo is a DevSecOps agent that ingests a
signal from the **Google Observability MCP** (Cloud Logging + Error
Reporting), uses **Gemini 3** to synthesize a root-cause patch, opens a
**GitLab MR** with the fix, runs the GitLab pipeline, and on green deploys
the patched service via the **Google Cloud Run MCP** — entirely under human
approval gates. One control plane. One audit trail. One bearer token.

## How we built it

**Stack**

- **Backend:** Go 1.22, **stdlib only** (no third-party deps, no `go.sum`).
  Custom middleware chain: `WithRequestID` → `AccessLog` → `Recover` →
  `SecurityHeaders` → `CORS` → auth (OIDC RS256 with JWKS cache *or* static
  bearer) → token-bucket rate limit → `MaxBody`.
- **Agent runtime:** Python 3.11, FastAPI broker, async adapter layer,
  per-adapter circuit breakers, Sentinel pipeline (`Auditor.before/after`,
  `Guard` for sensitive-key blocking), `auto_discover()` for zero-config
  adapter registration.
- **LLM:** Gemini 3 via Google Cloud Agent Builder for code generation, plan
  synthesis, and LLM-as-a-Judge evaluation in tests.
- **Frontend:** React 19, Vite 6, TypeScript strict, Tailwind, retro-token
  design system (`retro-button` / `retro-input` / `retro-card` / `retro-chip`).
- **Deploy:** Distroless container, signed in CI with cosign keyless, syft
  SBOM attestations, Cloud Run + Cloud SQL + Secret Manager, VPC-SC compatible.
- **Security CI gates:** `go vet`, `go test -race -cover`, `golangci-lint`,
  `gosec`, `govulncheck`, `trivy fs` — all green or no merge.

**Architecture choices that mattered**

- **Stdlib-only Go.** No surprise CVEs, no supply-chain debt, no `go.sum`
  churn. Every byte of dependency we ship is auditable.
- **Env-only config.** Ports, secrets, CORS allowlist, rate limits — never
  hardcoded. The same image runs on a laptop, Cloud Run, or VPC-SC.
- **One MCP peer, many adapters.** An agent or IDE only ever sees *one*
  server. Adding a new partner = appending one entry to the `adapters` slice
  and (optionally) a 100-line Python adapter class.
- **STRIDE threat model + 38 NIST 800-53 controls** documented in
  `docs/THREAT_MODEL.md` and `docs/CONTROLS_NIST_800_53.md`. Every
  control-affecting change must update both.

## Challenges we ran into

- **MCP fan-out.** Routing one stdio session to 56 downstream servers without
  blocking required a per-adapter circuit breaker and a non-trivial async
  dispatcher. The first cut deadlocked under concurrent tool calls; we fixed
  it by isolating each adapter on its own goroutine-per-call with bounded
  concurrency.
- **Auth that doesn't suck.** We needed both a dev-mode static bearer *and*
  production OIDC with JWKS rotation. Building the verifier from stdlib
  (`crypto/rsa`, `encoding/json`, `net/http`) instead of pulling a JWT
  library was painful but kept our supply chain clean.
- **Gemini codegen drift.** Early prompts produced Python that imported
  packages that didn't exist. We fixed this by grounding the generation on
  the *actual* adapter catalog returned by `/api/templates` and constraining
  the output schema. LLM-as-a-Judge (also Gemini) scores every generated
  agent before it's persisted.
- **Frontend / backend port discipline.** Vite on `:4000`, Go on `:4001`,
  Docker Compose serving both behind one port — all driven by `$PORT`,
  `$BACKEND_URL`, `$COMPOSER_PORT`. No literals anywhere. This sounds easy.
  It isn't.
- **Time.** Six partner tracks, 56 adapters, full security pipeline, two
  languages, one weekend. We cut scope hard: shipped the GitLab + Dynatrace
  + Elastic flow as the headliner and left the other partner adapters as
  catalog entries with documented MCP URLs.

## What we learned

- **Composability beats features.** A meta-broker that does *one* thing —
  unify MCP — is more useful than another all-in-one agent platform.
- **Stdlib Go is a superpower for security work.** Zero supply-chain
  surface, zero version pinning drama, every line traceable.
- **Agents need rails, not cages.** Sentinel middleware, circuit breakers,
  approval gates, audit logs — these are what turn a "cool demo" into
  something a Fortune 10 SRE team will actually run in prod.
- **Gemini 3.5 is genuinely good at codegen** when you give it a constrained
  catalog and a strict output schema. Hallucinations collapse.

## What's next

- Light up the remaining five partner tracks as first-class flows
  (Arize evaluations, Fivetran ingestion, MongoDB retrieval, Elastic search,
  Dynatrace observability) with template agents per track.
- ERC-8004 / A2A interop: agents discover and pay each other on-chain via
  the existing TBA + PaymentSplitter integration.
- Open the catalog to community-contributed adapters with signed manifests.

## Proof it actually works

End-to-end live integration test (`tests/test_mcp_server.py` + harness in
`/tmp/live_e2e.py`) — **12/12 passing against real APIs**:

- **MCP handshake** — protocol version `2024-11-05`, server identifies as
  `cybernetics`, advertises `tools` capability.
- **38 tools across 9 adapters** registered automatically (arize, cloudflare,
  dynatrace, fivetran, github, **gitlab**, stripe, supabase, vercel).
- **Real GitLab API call** — `gitlab_get_file` pulled 46 KB of
  `README.md@master` from `strawberryfield/cybernetics` through the broker.
- **Live mutation** — `gitlab_create_issue` opened
  [issue #2](https://gitlab.com/strawberryfield/cybernetics/-/issues/2) in the
  hackathon repo, tagged `e2e` / `hackathon` / `cybernetics-mcp`.
- **Gemini 3 selects the right partners autonomously** — `/api/chat` with
  the prompt *"use gitlab and google-cloud-run to ship a fix from a Cloud
  Logging alert"* returns `action: "compose"` with
  `adapters: ["gitlab", "google-cloud-run", "google-observability"]`. No
  prompt-engineering tricks; the model reads the live adapter catalog and
  picks the GitLab-track narrative on its own.

While building the e2e harness we caught and root-caused **5 real bugs** in
the MCP server (stdout-corrupting logger, missing `auto_discover()` call,
two field-name mismatches between server and registry, and unserialised
`ToolResult` dataclasses). All shipped in commit `a2f2f48`.

## Links

- **Repo:** https://gitlab.com/strawberryfield/cybernetics (AGPL-3.0)
- **GitHub mirror:** https://github.com/strawberryfields/Cybernetics
- **Live demo issue:** https://gitlab.com/strawberryfield/cybernetics/-/issues/2
- **Live composer:** https://cybernetics.sh
- **Docs:** `docs/THREAT_MODEL.md`, `docs/CONTROLS_NIST_800_53.md`
- **Track:** GitLab
