# Session Vault External Production SLOs

## Scope
These SLOs apply to external production deployments of Session Vault backend and dashboard.

## Availability and Correctness Targets
- API monthly availability: >= 99.9%.
- Readiness correctness: `/ready` returns unhealthy within 60s of critical storage/index failure.
- Data durability: no acknowledged write loss during process restart and restore drills.
- Index parity: file index and SQLite mirror remain in parity for all successful writes.

## Performance Targets
- Read endpoints (`/search`, `/tasks`, `/snapshot/latest`) p95 <= 150 ms.
- Write endpoints (`/events`, `/tasks`, `/memory`) p95 <= 250 ms.
- Compaction API (`/compact`) p95 <= 5000 ms under expected vault size.

## Security and Governance Targets
- Auth enforcement enabled in production (`AUTH_ENABLED=true`).
- Least-privilege roles active (`reader`, `operator`, `admin`).
- Auditable write/admin actions persisted in `history/audit.ndjson`.

## Release Acceptance Gates
1. `npm run release:gate` passes.
2. `npm run smoke` passes against target environment.
3. `/health`, `/ready`, `/metrics` all return successful responses.
4. Backup + restore drill passes and restored data remains queryable.
5. Retention/archive and restart persistence drills pass.
6. Auth/RBAC checks pass for reader/operator/admin boundary cases.
7. Index parity checks pass with SQLite index enabled.
