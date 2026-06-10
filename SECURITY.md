# Security Policy

## Supported versions

| Version | Supported |
|---------|-----------|
| `master` | yes — security fixes only |
| tagged releases ≤ 30 days old | yes |
| anything else | no |

## Reporting a vulnerability

**Do not** open a public GitHub issue.

1. Open a private security advisory via
   <https://github.com/strawberr0/Cybernetics/security/advisories/new>.
2. Include: a reproduction, the impacted version/commit, and an impact
   assessment (CIA, blast radius).
3. We will acknowledge within **72 hours** and provide a remediation timeline
   within **7 days**. Critical issues are handled out-of-band by direct
   contact with the maintainers.

## Coordinated disclosure

We follow a 90-day disclosure window from acknowledgement. Earlier disclosure
is possible if a patch is already public; later disclosure is possible if the
fix requires a customer migration.

## Security controls in the composer service

The composer service ships with the following controls enabled by default:

| Control | Implementation | Enabled by default |
|---------|----------------|--------------------|
| Bearer-token auth | `AUTH_TOKEN` env, constant-time compare | only if `AUTH_TOKEN` set |
| CORS allowlist | `CORS_ALLOWED_ORIGINS` env, no wildcard | only if allowlist set |
| Rate limiting | per-IP token bucket | yes (60 burst, 10/s) |
| Request size cap | `MAX_BODY_BYTES` env | yes (1 MiB) |
| Request ID | echoed `X-Request-ID` | yes |
| Structured JSON access log | slog JSON handler | yes |
| Panic recovery | converts panics to 500 without stack-trace leak | yes |
| Security headers | `nosniff`, `X-Frame-Options: DENY`, HSTS, Referrer-Policy | yes |
| Read-only root FS | distroless `nonroot` user (uid 65532) | yes |
| Drop all caps | docker-compose `cap_drop: ALL` | yes |
| No new privileges | docker-compose `no-new-privileges:true` | yes |

## Known posture gaps (tracked)

- OIDC / IAP integration is **not** in the composer yet; bearer-token auth is
  the only built-in mechanism. Deploy behind Cloud Run with `--no-allow-unauthenticated`
  or an IAP-fronted Ingress for production.
- No mTLS between services.
- The frontend currently stores user-provided Gemini keys in browser
  `localStorage` as a developer convenience. Production deployments should
  set `GEMINI_API_KEY` server-side via Secret Manager and hide the field
  from the UI.
- No formal STRIDE threat model artifact yet (in progress — see
  [`docs/THREAT_MODEL.md`](docs/THREAT_MODEL.md)).
- No formal third-party penetration test on file.
