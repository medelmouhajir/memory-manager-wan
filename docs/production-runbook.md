# Session Vault Pilot Runbook

## Scope
Trusted internal OpenClaw deployment for Session Vault backend and dashboard.

## Environment Setup
1. Copy `.env.example` to `.env` and review values.
2. Confirm persistent vault path is mounted to `./vault` (or your chosen host path).
3. Start services:
   - `docker compose up --build -d`

## Health And Readiness Checks
- Backend health: `http://localhost:4000/health`
- Backend readiness: `http://localhost:4000/ready`
- Backend metrics: `http://localhost:4000/metrics`
- Dashboard: `http://localhost:3000`

Expected result:
- `/health` returns `ok: true`
- `/ready` returns `ok: true` and storage checks pass
- `/metrics` returns route latency/counter snapshots

Port note:
- If `PORT` is overridden (for example `4312`), replace `4000` in all URLs with the configured port.

## Access Control And Roles
- Optional auth is controlled by `AUTH_ENABLED`.
- Provide one or more API keys via:
  - `VAULT_API_KEY_READER`
  - `VAULT_API_KEY_OPERATOR`
  - `VAULT_API_KEY_ADMIN`
- Pass the selected key using the `x-api-key` header.

Role permissions:
- `reader`: read-only endpoints.
- `operator`: reader + write/update endpoints.
- `admin`: operator + admin-only endpoints (`/snapshot/restore`, `/compact`).

## Release Gate Before Candidate Cut
Run from repository root:
- `npm ci`
- `npm run release:gate`
- `npm run smoke` (requires backend running)

Only cut release candidate if all commands pass.

## Backup And Restore
### Backup
- Default backup command:
  - `npm run backup:vault`
- Optional overrides:
  - `VAULT_SOURCE=<path>`
  - `VAULT_BACKUPS_ROOT=<path>`
  - `VAULT_BACKUP_DESTINATION=<path>`

### Restore
- Restore into active vault path:
  - `set VAULT_RESTORE_SOURCE=<backup-path>`
  - `npm run restore:vault`

After restore:
1. Restart backend service.
2. Verify `/ready`.
3. Open dashboard snapshot page and validate latest snapshot content.

## Retention And Archive Notes
- Compaction archives logs older than retention into `history/archive/<date>.logs`.
- Retention behavior runs during backend compaction.
- Optional scheduled compaction can be enabled with `COMPACTION_INTERVAL_MS`.
- Trigger manually via API:
  - `POST /api/v1/vault/compact`

## Incident Recovery
### Backend Unreachable
1. Check backend container logs.
2. Call `/health` and `/ready`.
3. Confirm vault path exists and is writable.
4. If vault corruption is suspected, restore from latest known-good backup.

### Data Consistency Concern
1. Run smoke flow (`npm run smoke`).
2. Validate search and snapshot flows in dashboard.
3. Run compaction and re-check search results.

## Production Checklist Sign-Off
- [x] `npm run release:gate` passes on clean clone
- [x] `npm run smoke` passes against running backend
- [x] `/health` and `/ready` return healthy
- [x] Backup created and restore drill completed
- [x] Archive/retention behavior verified
- [x] Dashboard shows healthy system status
- [x] Section 16 checks from `docs/projects.md` have evidence attached

## Latest Sign-Off Evidence (2026-04-15)
- Runtime: Windows 10 + PowerShell, backend started on port `4312`.
- Health: `/health` returned `ok: true`; `/ready` returned `ok: true` with storage checks.
- Smoke: `npm run smoke` passed with `VAULT_API_BASE=http://localhost:4312/api/v1/vault`.
- Backup/restore drill: `npm run backup:vault` then `npm run restore:vault` completed successfully.
- Retention drill: a synthetic log folder older than retention was moved to `vault/history/archive/<date>.logs` after `POST /api/v1/vault/compact`.
- Restart persistence drill: fact/task/decision/contradiction records remained queryable after backend restart.
