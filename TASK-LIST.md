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

## B. Green CI — build & test  ✅ ALL GREEN (run 3, `2d37564`)
| # | Item | Owner | Status |
|---|---|---|---|
| B1 | First CI run on `merge-prep-dev` push — review job results | JS_ | ✅ (run 1 surfaced 2 dep bugs) |
| B2 | `python-tests` install fixed: declared `boto3`+`motor` in pyproject (eager broker imports), dropped non-existent `dynatrace-opentelemetry` pin, CI installs `-e ".[dev]"` only | JS_ | ✅ |
| B2b | Tier tests: unit job runs all except `test_composer_e2e.py`; new `e2e-tests` job builds frontend + installs Chromium then runs it | JS_ | ✅ |
| B3 | `frontend-build`: `npm ci && npm run build` (tsc + vite) → green | JS_ | ✅ |
| B3b | `e2e-tests`: Playwright browser test green with prerequisites | JS_ | ✅ |
| B4 | Fix failures surfaced by CI (no deleting/skipping tests — repo rule) | JS_ | ✅ |
| B5 | Verify clean-clone `npm install` works (confirms node_modules untrack is safe) | JS_ | 🔲 |

---

## C. Cloud deploy — security fix (the "c" item) + blockers
| # | Item | Detail | Owner | Status |
|---|---|---|---|---|
| C1 | **Fix `cloudbuild.yaml` `--allow-unauthenticated`** | Switch to `--no-allow-unauthenticated` + IAP to match README Zero-Trust claim — OR consciously downgrade the README. Decide deliberately; it affects whether the demo endpoint is public. | Sebuh | ⚠️ 🔲 |
| C2 | ✅ **Dockerfile fixed** | Was building a non-existent `backend/` Go server. Resolved: the real server **is** `cmd/composer/main.go` (serves `/api/*` Gemini endpoints + static frontend). Dockerfile now builds `./cmd/composer` from the root module and copies `frontend/dist`→`./static`. | Roy | ✅ |
| C3 | ✅ **Deploy artifact identified** | `cmd/composer` (Go) is the web server; the FastAPI broker is a separate MCP API. No architecture change needed — the original Go+static design was correct, just mis-wired. | Roy | ✅ |
| C4 | ✅ `docker-build` CI job added (`docker build .`) | proves the image builds on every push | JS_ | ✅ reconfirm green |
| C5 | Stand up Cloud Run instance + capture public URL (submission) | needs GCP `$PROJECT_ID` + creds (not in CI) | Sebuh | 🔲 |
| C6 | Verify green deployment (merge gate) | run `cloudbuild.yaml` against the project | Sebuh | 🔲 |

---

## D. Repo correctness / consistency
| # | Item | Detail | Owner | Status |
|---|---|---|---|---|
| D1 | ✅ **License unified to Apache-2.0** | Was 3-way conflict: `LICENSE` file was inherited AIWG **MIT** (© Joe Magly), README badge said Apache, README footer + pyproject said AGPL. Now consistent: full Apache-2.0 `LICENSE` (© 2026 strawberr0/Cybernetics team), new `NOTICE` retaining AIWG MIT attribution, README footer + `pyproject` = Apache-2.0. GitHub "About" will now detect Apache-2.0. | Roy | ✅ |
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
