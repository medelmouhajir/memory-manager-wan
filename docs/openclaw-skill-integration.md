# OpenClaw Skill Integration Guide

## Skill Artifact
- Skill file: `skills/openclaw/session-vault.skill.yaml`
- Skill id: `session-vault`
- Transport: HTTP (`VAULT_API_BASE`, default `http://localhost:4000/api/v1/vault`)
- Auth header: `x-api-key` (`VAULT_API_KEY`)

## Required Environment Variables
- `VAULT_API_BASE` - Base URL used by the skill.
- `VAULT_API_KEY` - API key used in `x-api-key` header (required when backend auth is enabled).

Optional health/readiness overrides:
- `VAULT_HEALTH_URL` - Health endpoint URL (default `http://localhost:4000/health`).
- `VAULT_READY_URL` - Readiness endpoint URL (default `http://localhost:4000/ready`).

## Role Mapping
- `reader`: read-only routes (`GET /search`, `GET /tasks`, `GET /snapshots`, and other reads).
- `operator`: reader + write routes (`POST /events`, `POST /tasks`, `POST /memory`, `POST /summary`, `POST /snapshot/build`, `POST /contradictions/resolve`).
- `admin`: operator + admin routes (`POST /snapshot/restore`, `POST /compact`).

## Endpoint Mapping
The OpenClaw skill manifest maps to these backend routes:
- `POST /events`
- `POST /summary`
- `POST /memory`
- `POST /snapshot/build`
- `GET /snapshots`
- `POST /snapshot/restore`
- `GET /search`
- `GET /tasks`
- `POST /tasks`
- `POST /contradictions/resolve`
- `POST /compact`

## Example Requests
Write event:
```bash
curl -X POST "$VAULT_API_BASE/events" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $VAULT_API_KEY" \
  -d '{
    "session_id":"openclaw-session-1",
    "event":{
      "event_id":"evt-openclaw-1",
      "session_id":"openclaw-session-1",
      "timestamp":"2026-01-01T00:00:00.000Z",
      "type":"fact",
      "title":"OpenClaw integration check",
      "content":"session-vault skill is wired",
      "tags":["openclaw","integration"],
      "sources":["openclaw-skill"],
      "confidence":0.9,
      "freshness":"high",
      "status":"active"
    }
  }'
```

Search:
```bash
curl "$VAULT_API_BASE/search?q=openclaw&type=fact" \
  -H "x-api-key: $VAULT_API_KEY"
```

## Local Validation Flow
From repository root:
1. `npm ci`
2. `npm run release:gate`
3. `npm run smoke` (backend must be running)
4. `npm run skill:check`

Optional runtime probe from skill checker:
- `set SKILL_PROBE_API=true && npm run skill:check`

## OpenClaw Import Notes
- Import the skill file from `skills/openclaw/session-vault.skill.yaml`.
- Ensure OpenClaw runtime injects `VAULT_API_BASE` and (when `AUTH_ENABLED=true`) `VAULT_API_KEY`.
- For full capability access, use an `operator` or `admin` key depending on whether restore/compact actions are needed.
