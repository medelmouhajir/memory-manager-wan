# Session Vault Release Checklist

This checklist maps directly to `docs/projects.md` sections 14 and 16.

## Gate A: Automated Checks

- [x] `npm run lint`
- [x] `npm run test`
- [x] `npm run build`
- [x] `npm run skill:check`
- [x] `npm run smoke`

## Gate B: Section 16 Production Verification

- [x] API write paths survive repeated writes without index drift.
- [x] Search results remain consistent after compaction and memory rewrites.
- [x] Contradiction history preserves active/resolved/superseded states.
- [x] Snapshot list/diff/restore flows return deterministic results.
- [x] Validation errors return 400 with issue details for malformed requests.
- [x] Corrupted persisted records fail loudly (no silent skipping of invalid lines).
- [x] Archive task moves logs older than retention window into `history/archive`.
- [x] Backend test suite is green before release candidate cut.

## Gate C: Section 14 Success Criteria

- [x] Sessions restore correctly after restart.
- [x] No data loss observed across repeated sessions.
- [x] Tasks and decisions persist reliably.
- [x] Contradictions are never silently lost.
- [x] UI supports inspection and control for logs/memory/tasks/decisions/search/snapshots/contradictions.
- [x] Retrieval remains fast and accurate under expected load.

## Gate D: External Production Hardening

- [x] Production SLOs and release acceptance gates are defined in `docs/production-slos.md`.
- [x] Optional auth/RBAC controls are implemented and role boundaries are tested.
- [x] Audit trail for authenticated operations is persisted to `history/audit.ndjson`.
- [x] SQLite index mirror + parity checks are available (`INDEX_DB_PATH`) and covered by tests.
- [x] Metrics endpoint (`/metrics`) and scheduled compaction (`COMPACTION_INTERVAL_MS`) are implemented.
- [x] Environment and compose defaults are reconciled with documented runtime behavior.
- [x] OpenClaw skill manifest import and local acceptance check pass (`skills/openclaw/session-vault.skill.yaml`, `npm run skill:check`).

## Go/No-Go Record

- Date: 2026-04-15
- Commit/Tag: N/A (workspace is not a git repository)
- Environment: Windows 10 (PowerShell), backend on `http://localhost:4312`, vault root `x:\Projects\Memory_Manager_WAN\vault`
- Result: GO
- Notes: Re-ran `npm ci`, `npm run release:gate`, smoke, backup/restore, archive retention drill, and restart persistence checks during closeout.
