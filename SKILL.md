---
name: session-vault
description: Persistent session memory for OpenClaw agents via the Session Vault HTTP API (events, summaries, memory, tasks, snapshots, search).
version: "0.1.0"
metadata:
  openclaw:
    requires:
      env:
        - VAULT_API_BASE
        - VAULT_API_KEY
      bins:
        - curl
    primaryEnv: VAULT_API_BASE
    homepage: https://github.com/medelmouhajir/memory-manager-wan
---

# Session Vault (OpenClaw)

This skill targets a **running Session Vault server**. Installing this folder gives you the project source, the OpenClaw HTTP manifest, and documentation; it does **not** start the API by itself.

## What to configure

- **`VAULT_API_BASE`** — Base URL for the vault API (for example `http://localhost:4000/api/v1/vault`). Must match where the backend is reachable from the agent.
- **`VAULT_API_KEY`** — Sent as the `x-api-key` header. **Required only when the server has `AUTH_ENABLED=true`.** If auth is off, the header can be omitted (see [docs/openclaw-skill-integration.md](docs/openclaw-skill-integration.md)).

Optional overrides: `VAULT_HEALTH_URL`, `VAULT_READY_URL` (defaults in the manifest).

## HTTP manifest

OpenClaw transport and capability mapping live in:

`skills/openclaw/session-vault.skill.yaml`

Import that file in tooling or “add skill from URL” flows that expect YAML. Raw URL (default branch `main`):

`https://raw.githubusercontent.com/medelmouhajir/memory-manager-wan/main/skills/openclaw/session-vault.skill.yaml`

## Run the server

Use [README.md](README.md): Docker Compose (`docker compose up --build`) or local `npm ci` / `npm run dev`. After the API is up, point `VAULT_API_BASE` at it and set `VAULT_API_KEY` when auth is enabled.

## Reference

- [docs/openclaw-skill-integration.md](docs/openclaw-skill-integration.md) — roles, route mapping, curl examples
- [README.md](README.md) — full stack overview and configuration
