# TASK-LIST — Road to Green CI/CD + Upstream Merge

**Branch:** `merge-prep-dev` · **Target:** `strawberr0/Cybernetics:Dev` (note: capital **`Dev`**, no lowercase `dev` exists upstream)
**Updated:** 2026-06-03 · **Gate:** peer approval + 100% tests + verified green deploy

Status: ✅ done · 🔲 todo · ⚠️ needs team decision · 🔴 blocker

---

## A. Done
| # | Item | Status |
|---|---|---|
| A1 | Untrack committed `frontend/node_modules/` (~31 MB) + fix overbroad `.gitignore` `lib/` rule | ✅ `20426ab` |
| A2 | Push `merge-prep-dev` to fork `origin` | ✅ |
| A3 | Add `upstream` remote → `strawberr0/Cybernetics`, fetch | ✅ |
| A4 | Confirm divergence: branch is **0 behind / 1 ahead** of `upstream/Dev` (clean merge) | ✅ |
| A5 | Add CI workflow (`.github/workflows/ci.yml`: python-tests + frontend-build) | ✅ |

---

## B. Green CI — build & test (achievable now)
| # | Item | Owner | Status |
|---|---|---|---|
| B1 | First CI run on `merge-prep-dev` push — review job results | JS_ | ✅ (run 1 surfaced 2 dep bugs) |
| B2 | `python-tests` install fixed: declared `boto3`+`motor` in pyproject (eager broker imports), dropped non-existent `dynatrace-opentelemetry` pin, CI installs `-e ".[dev]"` only | JS_ | ✅ install green (run 2) |
| B2b | Tier tests: unit job runs all except `test_composer_e2e.py`; new `e2e-tests` job builds frontend + installs Chromium then runs it (run 2 failed only on the browser e2e lacking a browser) | JS_ | ✅ fix pushed; reconfirm |
| B3 | `frontend-build`: `npm ci && npm run build` (tsc + vite) → green | JS_ | ✅ run 1 |
| B4 | Fix any failures surfaced by B2/B3 (no deleting/skipping tests — repo rule) | JS_ | 🔲 |
| B5 | Verify clean-clone `npm install` works (confirms node_modules untrack is safe) | JS_ | 🔲 |

---

## C. Cloud deploy — security fix (the "c" item) + blockers
| # | Item | Detail | Owner | Status |
|---|---|---|---|---|
| C1 | **Fix `cloudbuild.yaml` `--allow-unauthenticated`** | Switch to `--no-allow-unauthenticated` + IAP to match README Zero-Trust claim — OR consciously downgrade the README. Decide deliberately; it affects whether the demo endpoint is public. | Sebuh | ⚠️ 🔲 |
| C2 | 🔴 **Dockerfile is broken** | Stage 2 does `COPY backend/go.* ./` + builds `cybernetics-server`, but **no `backend/` dir exists** and the only Go `main()` is `cmd/composer/main.go`. Build fails → deploy can never go green. | Sebuh + JS_ | 🔴 🔲 |
| C3 | ⚠️ **Decide the deploy artifact** | Tested product is the **Python FastAPI broker** (`cybernetics.broker.server:app`), not a Go server. Likely fix: Python/uvicorn image (`uvicorn cybernetics.broker.server:app --host 0.0.0.0 --port 8080`). Needs team sign-off — architecture decision for the org repo. | Roy + Sebuh | ⚠️ 🔴 🔲 |
| C4 | After C2/C3: add a `docker-build` CI job, then a gated deploy job | once buildable, wire `docker build .` into CI for a green checkmark | JS_ | 🔲 |
| C5 | Stand up Cloud Run instance + capture public URL (submission) | depends on C2/C3 | Sebuh | 🔲 |
| C6 | Verify green deployment (merge gate) | depends on C2/C3 | Sebuh | 🔲 |

---

## D. Repo correctness / consistency
| # | Item | Detail | Owner | Status |
|---|---|---|---|---|
| D1 | ⚠️ **License mismatch** | `pyproject.toml` says `AGPL-3.0-or-later`; README/About claim **Apache-2.0**. Pick one; ensure `LICENSE` + About + pyproject agree (hackathon needs a detectable OSI license). | Roy | ⚠️ 🔲 |
| D2 | `composer` (8.6 MB) is the compiled output of `cmd/composer/main.go` — consider gitignoring the binary, keep the source | JS_ | 🔲 |
| D3 | `Dev` vs `dev` branch confusion upstream — confirm canonical staging branch with team | Roy | ⚠️ 🔲 |

---

## E. Merge to upstream `Dev`
| # | Item | Command | Owner | Status |
|---|---|---|---|---|
| E1 | Open PR `royhodge812:merge-prep-dev` → `strawberr0/Cybernetics:Dev` | `gh pr create --repo strawberr0/Cybernetics --base Dev --head royhodge812:merge-prep-dev` | Roy | 🔲 |
| E2 | Peer approval (Sebuh + 1) | — | Sebuh | 🔲 |
| E3 | All CI green (B + C4) | — | JS_ | 🔲 |
| E4 | Verified green deploy (C6) | — | Sebuh | 🔲 |

---

### Blockers to clear first (in order)
1. 🔴 **C2/C3** — broken Dockerfile + deploy-artifact decision. Nothing deploys until this is resolved.
2. 🔴 **B2** — get `pytest` green (gates the whole merge).
3. ⚠️ **C1 / D1** — security flag + license: both are credibility items judges can spot.
