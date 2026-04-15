# Release Gate Report

## Scope

Validation run against the production completion plan and checklist criteria in `docs/projects.md` sections 14 and 16.

## Automated Results

- `npm run -w @session-vault/backend lint` -> pass
- `npm run -w @session-vault/frontend lint` -> pass
- `npm run -w @session-vault/backend test` -> pass (21 tests)
- `npm run -w @session-vault/frontend test` -> pass (8 tests)
- `npm run build` -> pass
- `npm run skill:check` -> pass (manifest validation)
- `npm run smoke` (with `VAULT_API_BASE=http://localhost:4311/api/v1/vault`) -> pass

## Checklist Status

- API write/index drift coverage: pass (new backend test)
- Search consistency after compaction/rewrites: pass (new backend tests and route test)
- Contradiction lifecycle state retention: pass (existing + retained tests)
- Snapshot list/diff/restore deterministic flows: pass (existing + retained tests)
- Validation errors with details: pass (routes + error middleware)
- Corrupted records fail loudly: pass (routes + engine/storage tests)
- Archive logs retention task: pass (storage tests)

## Go/No-Go

- Status: GO (based on current automated evidence)
- Notes: Smoke test required explicit `VAULT_API_BASE` because local default port conflicted with another running process.

## 2026-04-15 Closeout Evidence Refresh

### Environment
- OS/Shell: Windows 10 + PowerShell
- Workspace: `x:\Projects\Memory_Manager_WAN`
- Commit/Tag: N/A (workspace is not a git repository)
- Backend runtime for drills: `http://localhost:4312`

### Re-run Results
- `npm ci` -> pass
- `npm run release:gate` -> pass
- `npm run skill:check` -> pass (manifest validation)
- `npm run smoke` (with `VAULT_API_BASE=http://localhost:4312/api/v1/vault`) -> pass
- `GET /health` -> `ok: true`
- `GET /ready` -> `ok: true` with vault/index checks passing
- `GET /metrics` -> pass (route latency/counter snapshot returned)

### Operational Drill Results
- Backup/restore:
  - `npm run backup:vault` -> pass
  - `npm run restore:vault` (using generated backup path) -> pass
- Retention/archive:
  - Created an old-dated logs folder in `vault/logs/<date>`
  - `POST /api/v1/vault/compact` archived it to `vault/history/archive/<date>.logs`
- Restart persistence:
  - Created verification fact/task/decision/contradiction entries
  - Restarted backend and re-queried all records
  - Result: all verification records remained present

### Section 14 Validation Notes
- Sessions restore correctly after restart: validated by restart persistence drill.
- No data loss across repeated sessions: smoke + restart drill both retained records.
- Tasks and decisions persist reliably: verified through API retrieval pre/post restart.
- Contradictions are never silently lost: contradiction persisted and remained queryable.
- UI supports inspection/control scope: verified by existing dashboard route coverage (`/`, `/logs`, `/memory`, `/tasks`, `/decisions`, `/search`, `/snapshot`, `/contradictions`) and successful backend reachability.
- Retrieval remains fast/accurate: sample search benchmark over 100 requests averaged ~`3.32 ms` per request.

### Final Decision
- Status: GO
- Rationale: All automated gates, operational runbook drills, and section 14/16 validation points have passing evidence in this report and linked checklist documents.

## 2026-04-15 External Production Hardening Addendum

### Scope
- Implemented plan items for production hardening beyond pilot readiness.

### Implemented Controls
- Security/governance:
  - Optional auth enablement via `AUTH_ENABLED`.
  - Role keys for `reader`, `operator`, `admin`.
  - Route-level RBAC enforcement for write/admin operations.
  - Authenticated request audit logging to `history/audit.ndjson`.
- Data/index reliability:
  - Optional SQLite index mirror via `INDEX_DB_PATH`.
  - File-to-SQLite parity assertion on every index write.
  - Startup index sync from file index into SQLite mirror.
- Observability/ops:
  - `/metrics` endpoint with per-route count/latency aggregates.
  - Optional scheduled compaction via `COMPACTION_INTERVAL_MS`.
- Release/doc alignment:
  - Compose and `.env.example` updated for auth/index/scheduler defaults.
  - Port override behavior clarified in runbook.
  - External production SLOs documented in `docs/production-slos.md`.

### Verification Results
- `npm run -w @session-vault/backend lint` -> pass
- `npm run -w @session-vault/backend test` -> pass (24 tests, includes new auth/sqlite parity coverage)
- `npm run -w @session-vault/frontend lint` -> pass
- `npm run -w @session-vault/frontend test` -> pass
- `npm run release:gate` -> pass
- `npm run smoke` with `VAULT_API_BASE=http://localhost:4312/api/v1/vault` -> pass

### Final Decision (External Production Hardening Scope)
- Status: GO
- Rationale: Security controls, index parity safeguards, observability improvements, and release-doc alignment are implemented and validated with passing automated and smoke evidence.
