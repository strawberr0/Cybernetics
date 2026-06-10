# Changelog

All notable changes to Cybernetics are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versioning is [SemVer](https://semver.org).

## [Unreleased]

### Added
- OIDC JWT verifier (`internal/oidc/`) with JWKS cache — stdlib-only RS256.
- `middleware.OIDCAuth` — pluggable Bearer JWT auth via `TokenVerifier` interface.
- `/api/config` — non-secret server capability advertisement
  (`server_has_gemini_key`, `auth_mode`, `version`, `commit`).
- Frontend Settings panel now reflects server-managed key + auth mode.
- `docs/CONTROLS_NIST_800_53.md` — 38-control mapping (66% fully implemented).
- `docs/THREAT_MODEL.md` — STRIDE per component with verified mitigations.
- `SECURITY.md`, `CODEOWNERS`, `.golangci.yml`.
- CI: `.github/workflows/composer-security.yml` —
  vet · test -race · golangci-lint · gosec · govulncheck · Trivy · SBOM · cosign keyless sign.
- `AGENTS.md` — AI coding agent guide for this repo.

### Changed
- **Relicensed** from Apache-2.0 to **AGPL-3.0**.
- Composer service rewritten with:
  - structured JSON access logs (`slog`) + `X-Request-ID` correlation
  - panic recovery (no stack-trace leak)
  - per-IP token-bucket rate limit
  - strict CORS allowlist (no wildcard)
  - body size cap, server timeouts, header size cap
  - security headers (HSTS, nosniff, X-Frame-Options DENY, Referrer-Policy)
- Dockerfile: now distroless `static-nonroot` (uid 65532), stripped, trimpath, ldflags-stamped.
- `docker-compose.yml`: `read_only`, `cap_drop: ALL`, `no-new-privileges`.
- Frontend UX overhaul:
  - full-view panels for Templates, Adapters, Keys, Deploy, Settings
  - session history with `localStorage` persistence
  - retro design system (`retro-card`, `retro-card-selected`)
- README: AGPL badge, Docker Compose quick start.

### Removed
- All inherited AIWG project tree (`agentic/`, `plugins/`, `src/`, `tools/`,
  `test/`, `apps/web/`, `vscode-extension/`, etc.) — was vendored from a
  prior merge but unused by the composer service.
- Root-level Node app (`package.json`, `package-lock.json`, `tsconfig.json`,
  `uv.lock`) — orthogonal to the composer/frontend builds.
- `kubernetes` adapter — no official upstream MCP server.

### Fixed
- Critical: chat endpoint URL had embedded Markdown link syntax (would
  break any chat request).
- Default port collision: previous `3001` default removed.
