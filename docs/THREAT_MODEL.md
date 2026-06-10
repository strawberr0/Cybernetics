# Composer Service — Threat Model (STRIDE)

Scope: the `cmd/composer` Go service and its HTTP surface.
Out of scope: the broader Cybernetics broker (covered in its own document),
third-party MCP adapter endpoints (covered by their respective vendors).

## 1. System overview

```
 ┌──────────┐   HTTPS   ┌──────────────────────┐   HTTPS   ┌──────────────┐
 │ Browser  │ ────────▶ │  Composer (Go HTTP)  │ ────────▶ │  Gemini API  │
 │  (Vite)  │           │  · /api/templates    │           │  (Google)    │
 └──────────┘           │  · /api/compose      │           └──────────────┘
                        │  · /api/chat         │
                        │  · /api/deploy       │
                        │  · /healthz, /readyz │
                        └──────────┬───────────┘
                                   │ slog JSON
                                   ▼
                              stdout (collected
                              by Cloud Run / GKE)
```

Trust boundaries:

- **TB1**: Browser ↔ Composer (untrusted client, transit over HTTPS).
- **TB2**: Composer ↔ Gemini (egress to a trusted SaaS; key is a secret).
- **TB3**: Composer ↔ orchestrator (probes, logging, secrets).

## 2. Assets

| Asset | Sensitivity | Where |
|-------|-------------|-------|
| `GEMINI_API_KEY` | high — billing + content access | env var, never logged |
| `AUTH_TOKEN` | high — full API auth | env var, never logged |
| Composed agent code | medium — may contain user prompts | response body |
| Access logs | low — already structured, no secrets | stdout |
| Customer prompts in chat | medium — may contain proprietary info | transit only, not persisted |

## 3. STRIDE analysis

### S — Spoofing
| Threat | Mitigation | Verified |
|--------|------------|----------|
| Anonymous caller hitting `/api/*` | `BearerAuth` middleware, constant-time compare | `TestBearerAuth_*` |
| Forged `X-Forwarded-For` for rate-limit evasion | `TRUST_PROXY` opt-in env; defaults to `RemoteAddr` | unit test pending |
| CSRF from a hostile origin | strict CORS allowlist (`CORS` middleware) — no wildcard echoed | `TestCORS_AllowlistOnly` |

### T — Tampering
| Threat | Mitigation | Verified |
|--------|------------|----------|
| Body-size DoS (huge JSON) | `MaxBody` (1 MiB default) | `TestMaxBody_Enforces413OnOversize` |
| Header-size DoS | `http.Server.MaxHeaderBytes = 16 KiB` | code review |
| Slowloris / read-timeout DoS | `ReadHeaderTimeout`, `ReadTimeout`, `IdleTimeout` set | code review |
| Image-content tampering in supply chain | distroless base, cosign keyless signature, SBOM attest | CI pipeline |

### R — Repudiation
| Threat | Mitigation | Verified |
|--------|------------|----------|
| Action without audit trail | `AccessLog` middleware emits structured JSON per request | `TestWithRequestID_*` |
| Lost correlation across services | echoed `X-Request-ID` (client- or server-generated) | `TestWithRequestID_*` |

### I — Information disclosure
| Threat | Mitigation | Verified |
|--------|------------|----------|
| Panic stack trace leaked to client | `Recover` middleware returns generic 500 | `TestRecover_TurnsPanicInto500` |
| Secrets in logs | slog handlers do not log env vars; `GEMINI_API_KEY` only used in URL path → never logged (URL not in access log fields) | code review |
| API key in browser localStorage | **known posture gap** — see `SECURITY.md`; production deployments should serve `GEMINI_API_KEY` from Secret Manager and disable the UI input | tracked |
| MIME sniffing / clickjacking | `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` | `SecurityHeaders` middleware |

### D — Denial of service
| Threat | Mitigation | Verified |
|--------|------------|----------|
| Per-IP request flood | token-bucket `RateLimiter` (60 burst, 10/s) | `TestRateLimiter_*` |
| Long-running upstream call hanging worker | `context.WithTimeout(60s)` on compose, `30s` on chat | code review |
| Goroutine leak | response writer wrapped; no background goroutines spawned per request | code review |

### E — Elevation of privilege
| Threat | Mitigation | Verified |
|--------|------------|----------|
| Container escape | distroless `nonroot` (uid 65532), `cap_drop: ALL`, `no-new-privileges` | Dockerfile + compose |
| RW root FS | `read_only: true` in compose | compose |
| Shell injection via deploy command | `req.ServiceName`/etc. are echoed in the gcloud command string returned to the **client** for them to run locally — the server never executes them; documented behaviour | code review |

## 4. Residual risks accepted

- **No mTLS** between composer and clients. Mitigated by deploying behind a
  TLS-terminating ingress (Cloud Run / Cloud Load Balancing).
- **Bearer-token model is opaque** (no scopes, no expiry). Acceptable for v0;
  upgrade to OIDC + IAP for any multi-tenant deployment.
- **No request signing**. Acceptable behind HTTPS + bearer auth.

## 5. Verification

Run the full security gate locally:

```bash
go vet ./...
go test -race ./...
golangci-lint run
gosec ./...
govulncheck ./...
trivy fs --severity CRITICAL,HIGH --ignore-unfixed .
```

CI runs all of the above on every push and PR — see
[`.github/workflows/composer-security.yml`](../.github/workflows/composer-security.yml).
