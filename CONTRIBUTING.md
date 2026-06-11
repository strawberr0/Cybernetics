# Contributing

## Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| **Go** | 1.22+ | Composer service is stdlib-only — no `go.sum` to manage. |
| **Node.js** | 20+ | Frontend (Vite 6, React 19, TypeScript strict). |
| **Python** | 3.11+ | Cybernetics framework (broker, adapters, agents). |
| **Docker** | 24+ | Local container builds (distroless base). |
| **Git** | any | Standard. |

## Local setup

```bash
git clone git@github.com:strawberryfield/Cybernetics.git
cd Cybernetics

# Backend
go build ./...
go test -race ./...

# Frontend
cd frontend && npm install && npm run dev
```

## Branching & PRs

- Branch from `master`, push your branch, open a PR against `master`.
- One logical change per PR. Keep it < 400 LoC where possible.
- CI must pass: `go vet`, `go test -race`, `golangci-lint`, `gosec`,
  `govulncheck`, Trivy. See `.github/workflows/composer-security.yml`.
- `CODEOWNERS` will be requested automatically; review is required.

## Commit messages

Conventional Commits — `feat(scope):`, `fix(scope):`, `chore:`, `docs:`,
`refactor:`, `test:`. Subject in imperative mood, ≤ 72 chars.
Body wrapped at 80 cols, list bullets allowed. Reference the issue / PR.

## Code style

### Go
- Stdlib only.
- `slog` JSON logging. No `fmt.Print*` outside tests.
- Every new exported symbol has a Go doc comment.
- Tests live next to code (`foo_test.go`); use `httptest` for HTTP and
  `t.Setenv` for env-dependent tests.

### TypeScript / React
- Strict mode. No `any` except at the OS / browser boundary.
- Use the retro design tokens (`retro-button`, `retro-input`, `retro-card`,
  `retro-chip`) — do not reinvent.
- Functional components + hooks only. No class components.

### Python
- 3.11 syntax, `from __future__ import annotations` where useful.
- `ruff` for lint (config in `pyproject.toml`).

## Security disclosures

**Do not** open public issues for security bugs. Open a private advisory at
<https://github.com/strawberryfield/Cybernetics/security/advisories/new>.
See [`SECURITY.md`](SECURITY.md) for the full policy.

## License

By contributing you agree that your contribution is licensed under the
**GNU Affero General Public License v3.0** (AGPL-3.0), the same as the
project. See [`LICENSE`](LICENSE).
