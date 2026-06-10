# AGENTS.md

Instructions for AI coding agents (Codex, Cascade, Cursor, Claude Code) working
on this repo. Read before making changes.

## Project

Cybernetics — composable MCP meta-broker for Google Cloud agents.

- **`cmd/composer/`** — Go HTTP service (stdlib only). Serves agent catalog +
  Gemini-backed compose/chat/deploy.
- **`internal/middleware/`** — auth, rate limit, CORS, structured logging, panic recovery.
- **`internal/oidc/`** — RS256 JWT verifier with JWKS cache.
- **`cybernetics/`** — Python framework (broker, registry, adapters, agents).
- **`frontend/`** — React 19 + Vite 6 + Tailwind UI.
- **`docs/`** — `THREAT_MODEL.md` (STRIDE), `CONTROLS_NIST_800_53.md` (38 controls).

## Commands

```bash
# Go: build, test (race), lint, vuln scan
go build ./... && go test -race -count=1 ./...
golangci-lint run    # config: .golangci.yml
govulncheck ./...

# Frontend
cd frontend && npm install && npm run dev      # :4000, proxies /api -> :4001
cd frontend && npm run build                   # -> frontend/dist

# Full image (distroless, signed in CI)
docker compose up --build
```

## Rules

- **Go: stdlib only.** No third-party deps. No `go.sum`.
- **Ports: env-only.** Never literal. Honour `$PORT` / `$BACKEND_URL` / `$COMPOSER_PORT`.
- **Secrets: env-only.** Never log, never echo to clients. `AUTH_TOKEN`,
  `GEMINI_API_KEY`, `OIDC_*`.
- **Logging:** `slog` JSON only. No `fmt.Print*` outside tests. Every log line
  inherits `request_id` via `middleware.WithRequestID`.
- **Errors to clients:** generic. Detail goes to logs.
- **Tests:** every new handler/middleware ships a `_test.go`. `go test -race`
  stays green or the PR doesn't merge.
- **Frontend:** TypeScript strict. Use `retro-button` / `retro-input` /
  `retro-card` / `retro-chip` design tokens. No custom one-off styles.
- **Middleware chain order in `main.go`:** `WithRequestID` first, then
  `AccessLog`, `Recover`, `SecurityHeaders`, `CORS`. Do not reorder.
- **License: AGPL-3.0.** New code inherits.

## Don't touch without explicit ask

- `LICENSE` (AGPL-3.0).
- `cmd/composer/main.go` template & adapter constants — public catalog.
- Middleware chain order in `main.go`.

## Env vars

| Var | Default | Purpose |
|-----|---------|---------|
| `PORT` | `8080` | Listen port |
| `GEMINI_API_KEY` | — | Server-side Gemini key |
| `AUTH_TOKEN` | — | Static bearer (dev mode) |
| `OIDC_ISSUER` / `OIDC_AUDIENCE` | — | OIDC JWT auth (takes precedence over `AUTH_TOKEN`) |
| `CORS_ALLOWED_ORIGINS` | — | Comma-separated allowlist (no wildcard) |
| `MAX_BODY_BYTES` | `1048576` | Per-request body cap |
| `RATE_LIMIT_BURST` / `RATE_LIMIT_PER_SEC` | `60` / `10` | Token bucket |
| `TRUST_PROXY` | `0` | Honour `X-Forwarded-For` (only behind trusted LB) |

## Adding an adapter

1. Append entry to `adapters` slice in `cmd/composer/main.go` (alphabetical,
   official upstream MCP URL in `Source`).
2. Add env keys to `envMap` in `frontend/src/components/Composer.tsx`.
3. Optional Python impl in `cybernetics/adapters/<name>.py` — pattern: see
   `cybernetics/adapters/slack.py`.

## Adding an endpoint

Every new `/api/*` route must be registered on `apiMux` and wrapped with
`middleware.MaxBody(maxBody)`. Auth + rate limit are applied at the chain
level — don't duplicate.

## CI gates (must pass before merge)

`.github/workflows/composer-security.yml`:

- `go vet` · `go test -race -cover` · `golangci-lint` · `gosec` · `govulncheck` · `trivy fs`
- Image build → cosign keyless sign → syft SBOM attest

## Security must-haves for any change

- New endpoints sit behind auth + rate-limit.
- `/healthz` and `/readyz` stay unauthenticated.
- No new third-party Go deps without justification + license + SBOM impact.
- Control-affecting changes update `docs/THREAT_MODEL.md` and
  `docs/CONTROLS_NIST_800_53.md`.
