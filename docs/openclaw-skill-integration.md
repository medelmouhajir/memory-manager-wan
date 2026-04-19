# OpenClaw Skill Integration Guide

## Artifacts and version sync

- **ClawHub-style instructions:** root [`SKILL.md`](../SKILL.md) (YAML frontmatter + Markdown). Keep `version` here in lockstep with the HTTP manifest below whenever you change either.
- **HTTP manifest (machine-readable):** [`skills/openclaw/session-vault.skill.yaml`](../skills/openclaw/session-vault.skill.yaml) — transport, auth, per-route roles, health URLs. Validated by `npm run skill:check` against [`schemas/session-vault.skill.schema.json`](../schemas/session-vault.skill.schema.json).

## Install (OpenClaw)

Register the skill with the OpenClaw CLI:

```bash
openclaw skills add https://github.com/medelmouhajir/memory-manager-wan.git
```

This clones the repository and installs Node workspace dependencies at the repo root; it does **not** start the Session Vault server. Set `VAULT_API_BASE` and, when the backend has `AUTH_ENABLED=true`, `VAULT_API_KEY`. Operator-facing context lives in the root [SKILL.md](../SKILL.md).

Import only the HTTP manifest by URL:

`https://raw.githubusercontent.com/medelmouhajir/memory-manager-wan/main/skills/openclaw/session-vault.skill.yaml`

**Bring up API + UI in one line** (Unix; requires Docker Compose):

```bash
git clone --depth 1 https://github.com/medelmouhajir/memory-manager-wan.git && cd memory-manager-wan && cp .env.example .env && docker compose up --build -d
```

## Skill Artifact
- Skill file: `skills/openclaw/session-vault.skill.yaml`
- Skill id: `session-vault`
- Transport: HTTP (`VAULT_API_BASE`, default `http://localhost:4000/api/v1/vault`)
- Auth header: `x-api-key` (`VAULT_API_KEY`)

### HTTP manifest shape (`schema_version` 1.0)

| Section | Purpose |
| -------- | -------- |
| `schema_version`, `id`, `name`, `version`, `description` | Identity and compatibility |
| `transport` | `type: http`, base URL from `base_url_env` / `default_base_url` |
| `authentication` | API key header, env key name, optional when auth disabled |
| `capabilities` | Named operations: HTTP method, path (relative to base), `min_role` |
| `health` | Optional health and readiness URL overrides |

Authoritative validation: [schemas/session-vault.skill.schema.json](../schemas/session-vault.skill.schema.json) (used by `npm run skill:check`).

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
4. `npm run skill:check` — validates YAML against [schemas/session-vault.skill.schema.json](../schemas/session-vault.skill.schema.json)

Optional runtime probe from skill checker:
- `set SKILL_PROBE_API=true && npm run skill:check`

**OpenClaw CLI:** This repo’s contract is enforced by `npm run skill:check`. If you use the official CLI in an OpenClaw workspace, `npx openclaw --version` confirms the install; skill readiness in that workspace is `openclaw skills check` (see [OpenClaw CLI skills docs](https://docs.openclaw.ai/cli/skills)).

## OpenClaw Import Notes
- Import the skill file from `skills/openclaw/session-vault.skill.yaml`.
- Ensure OpenClaw runtime injects `VAULT_API_BASE` and (when `AUTH_ENABLED=true`) `VAULT_API_KEY`.
- For full capability access, use an `operator` or `admin` key depending on whether restore/compact actions are needed.
