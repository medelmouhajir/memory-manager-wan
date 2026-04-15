# Session Vault

Persistent memory and operations dashboard for agent sessions: file-backed vault storage, optional SQLite indexing, a Next.js UI, and an HTTP API used by tools such as the OpenClaw session-vault skill.

## Install (OpenClaw)

Register the skill with the OpenClaw CLI (clones this repo into your skills area and installs workspace dependencies):

```bash
openclaw skills add https://github.com/medelmouhajir/memory-manager-wan.git
```

That installs **agent instructions and project files**; it does **not** start the Session Vault API. Configure `VAULT_API_BASE` (and `VAULT_API_KEY` when the server has `AUTH_ENABLED=true`); see [docs/openclaw-skill-integration.md](docs/openclaw-skill-integration.md).

To import only the HTTP manifest by URL (for example “Add skill from URL” in a UI):

`https://raw.githubusercontent.com/medelmouhajir/memory-manager-wan/main/skills/openclaw/session-vault.skill.yaml`

**Bring up API + UI in one line** (Unix, from an empty directory; requires Docker Compose):

```bash
git clone --depth 1 https://github.com/medelmouhajir/memory-manager-wan.git && cd memory-manager-wan && cp .env.example .env && docker compose up --build -d
```

Then open [http://localhost:3000](http://localhost:3000) and set `VAULT_API_BASE` to `http://localhost:4000/api/v1/vault` (or your deployed host) unless you already changed it in `.env`.

## Features

- Durable session activity: logs, summaries, structured memory (facts, preferences, decisions, tasks), contradictions, and snapshots
- Express backend with search, tasks, snapshots, compaction, and optional API-key auth with role separation
- Next.js dashboard for inspection and control
- Docker Compose stack for local or server deployment

## Requirements

- **Node.js 22** and npm (matches [CI](.github/workflows/ci.yml))
- **Docker** and Docker Compose (optional, for containerized runs)

## Quick start (Docker)

1. Copy environment defaults: `cp .env.example .env` and adjust values as needed.
2. Start services: `docker compose up --build`
3. Open the UI at [http://localhost:3000](http://localhost:3000). The API listens on port **4000** (e.g. [http://localhost:4000/health](http://localhost:4000/health)).

Compose mounts `./vault` into the backend as `/data/vault`. The `vault/` directory is listed in [.gitignore](.gitignore); create it automatically on first run or ensure it exists and is writable.

## Quick start (local development)

1. `cp .env.example .env` and set at least:
   - Backend: `PORT`, `VAULT_ROOT` (absolute path to a writable vault directory on your machine), `API_BASE`
   - Frontend: `NEXT_PUBLIC_VAULT_API_BASE` must point at the running API (e.g. `http://localhost:4000/api/v1/vault` as in [.env.example](.env.example))
2. Install dependencies: `npm ci`
3. Run all workspaces in dev mode: `npm run dev` (backend on `PORT`, typically **4000**; Next.js dev server on **3000** by default)

## Configuration

See [.env.example](.env.example) for variable names and defaults. Notable options:

- **`AUTH_ENABLED`**: when `true`, set `VAULT_API_KEY_ADMIN`, `VAULT_API_KEY_OPERATOR`, and/or `VAULT_API_KEY_READER` for the backend (see [docker-compose.yml](docker-compose.yml)).
- **`NEXT_PUBLIC_VAULT_API_KEY`**: only for trusted development; it is exposed to the browser. Prefer auth patterns that do not embed long-lived secrets in the client for anything internet-facing.

## Scripts and quality

| Command | Purpose |
| --- | --- |
| `npm run dev` | Run `dev` in all workspaces |
| `npm run build` | Build all workspaces |
| `npm run lint` | Typecheck-focused lint in workspaces |
| `npm run test` | Run tests in workspaces |
| `npm run check` | `lint`, `test`, then `build` |
| `npm run release:gate` | Same as CI: `check` plus `skill:check` |
| `npm run smoke` | Smoke test script |
| `npm run backup:vault` / `npm run restore:vault` | Vault backup and restore helpers |

CI runs `npm ci` and `npm run release:gate` on pushes and pull requests to `main` / `master`.

## Documentation

Project documentation lives under [docs/](docs/). Start with [docs/README.md](docs/README.md) for a full index.

- **[docs/projects.md](docs/projects.md)** — System architecture, storage layout, data models, and product specification
- **[docs/openclaw-skill-integration.md](docs/openclaw-skill-integration.md)** — OpenClaw skill wiring, env vars, roles, and example HTTP calls
- **[docs/production-runbook.md](docs/production-runbook.md)** — Operational runbook
- **[docs/production-slos.md](docs/production-slos.md)** — Production SLOs
- **[docs/release-checklist.md](docs/release-checklist.md)** — Release checklist
- **[docs/release-gate-report.md](docs/release-gate-report.md)** — Release gate report

## Repository layout

- `backend/` — Session Vault API (Express, TypeScript)
- `frontend/` — Next.js UI
- `packages/` — Shared workspace packages (for example `@session-vault/shared`)
- `docs/` — Markdown documentation
- `skills/` — Skill artifacts (for example OpenClaw YAML)

## Author

Maintained by **Mohamed Amin ELMOUHAJIR**.

## License

See [LICENSE](LICENSE).
