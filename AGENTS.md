# AGENTS.md

Instructions for AI coding agents (Codex, Cascade, Cursor, Claude Code, etc.)
working on this repository. Read this first before making changes.

## Project at a glance

Cybernetics is a **composable MCP meta-broker for Google Cloud agents**. The
repo ships:

- A **Go HTTP composer service** (`cmd/composer/`) that serves the agent
  catalog API + a Gemini-backed chat/compose flow.
- A **Python framework** (`cybernetics/`) defining adapters, agents, registry,
  broker, and sentinels (referenced by composed agent code).
- A **React/Vite frontend** (`frontend/`) — the Agent Composer UI.

## Directory layout

```
cmd/composer/           Go HTTP service entry point
internal/middleware/    auth, ratelimit, CORS, logging (stdlib-only)
internal/oidc/          stdlib RS256 JWT verifier with JWKS cache
cybernetics/            Python framework (broker, adapters, agents, ...)
frontend/               React 19 + Vite 6 + Tailwind UI
templates/              Agent template scaffolding (deploy/, agent-scaffolding/)
docs/                   THREAT_MODEL.md, CONTROLS_NIST_800_53.md
.github/workflows/      CI pipelines (composer-security.yml is the hardening gate)
hackathon/              Reference hackathon implementation
```

## Build & run

### Backend (Go)

```bash
go build ./...
go test -race -count=1 ./...
PORT=4001 go run ./cmd/composer    # default :8080, override with $PORT
```

### Frontend

```bash
cd frontend
npm install
PORT=4000 npm run dev              # proxies /api -> $BACKEND_URL (default :4001)
npm run build                      # outputs frontend/dist
```

### Full image (production)

```bash
docker compose up --build
# OR
docker build -t cybernetics:dev .
```

## Conventions

- **Go**: stdlib-only. No third-party deps. Keep `go.mod` minimal.
- **Ports**: never hardcode. Always honour `$PORT` / `$BACKEND_URL` / `$COMPOSER_PORT`.
- **Secrets**: never log, never echo to clients. `AUTH_TOKEN`, `GEMINI_API_KEY`,
  `OIDC_*` come from env only.
- **Logging**: `slog` JSON, with `X-Request-ID` correlation. No `fmt.Println`.
- **Errors**: return generic messages to clients; log full detail server-side.
- **Tests**: every middleware and handler change ships with a unit test.
  `go test -race` must stay green.
- **Lint**: `golangci-lint` config is `.golangci.yml`. Fix lints; don't suppress.
- **Frontend**: TypeScript strict. Tailwind utilities. The retro design tokens
  (`retro-button`, `retro-input`, `retro-card`, `retro-chip`) are the canonical
  components — use them, don't reinvent.

## What NOT to touch without explicit direction

- `LICENSE` (AGPL-3.0)
- `cmd/composer/main.go` template & adapter constants — these are the public
  catalog and changes are user-facing.
- The security middleware chain order in `main.go` — `WithRequestID` MUST be
  first so all downstream logs carry the correlation ID.

## Environment variables

| Var | Default | Purpose |
|-----|---------|---------|
| `PORT` | `8080` | Listen port |
| `GEMINI_API_KEY` | _(none)_ | Server-side Gemini key |
| `AUTH_TOKEN` | _(none)_ | Static bearer token (dev mode) |
| `OIDC_ISSUER` | _(none)_ | OIDC issuer for JWT auth |
| `OIDC_AUDIENCE` | _(none)_ | Expected `aud` claim |
| `CORS_ALLOWED_ORIGINS` | _(none)_ | Comma-separated allowlist (no wildcard) |
| `MAX_BODY_BYTES` | `1048576` | Per-request body cap |
| `RATE_LIMIT_BURST` | `60` | Token-bucket burst |
| `RATE_LIMIT_PER_SEC` | `10` | Token-bucket refill rate |
| `TRUST_PROXY` | `0` | Honour `X-Forwarded-For` (only behind a trusted LB) |

## Adding an MCP adapter

1. Append a `Adapter{...}` entry in `cmd/composer/main.go` (alphabetical
   inside its group). Each adapter MUST have a `Source` pointing to the
   upstream's official MCP server repo.
2. Add the required env keys to `envMap` in
   `frontend/src/components/Composer.tsx`.
3. (Optional) Implement the Python-side adapter in `cybernetics/adapters/`
   following the existing pattern (see `cybernetics/adapters/slack.py`).

## Security must-haves for any change

- Every new endpoint must be added behind the auth + rate-limit chain in
  `cmd/composer/main.go` (`apiMux.Handle("/api/x", middleware.MaxBody(...)(...))`).
- Health probes (`/healthz`, `/readyz`) stay unauthenticated.
- No new third-party Go deps without justification + license + SBOM impact.
- `docs/THREAT_MODEL.md` and `docs/CONTROLS_NIST_800_53.md` MUST be updated
  for any control-affecting change.

## CI gates (must pass before merge)

`.github/workflows/composer-security.yml`:

- `go vet`, `go test -race -cover`
- `golangci-lint` (14 linters incl. gosec, bodyclose, noctx)
- `gosec` (SARIF → code scanning)
- `govulncheck`
- `trivy fs` (CRITICAL/HIGH, fail on unfixed)
- image build + cosign keyless sign + SBOM attest
