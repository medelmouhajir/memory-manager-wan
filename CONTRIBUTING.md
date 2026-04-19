# Contributing

Thank you for helping improve Session Vault.

## Development setup

1. Use **Node.js 22** (see [.github/workflows/ci.yml](.github/workflows/ci.yml)).
2. Copy [.env.example](.env.example) to `.env` and configure `VAULT_ROOT`, API base URLs, and optional auth keys for your environment.
3. Install dependencies: `npm ci`

## Before you open a pull request

Run the same checks CI runs:

```bash
npm run release:gate
```

That runs `lint`, `test`, `build`, and `skill:check` across workspaces.

Useful additional commands:

- `npm run smoke` — end-to-end smoke script
- `npm run backup:vault` / `npm run restore:vault` — when testing vault lifecycle locally

## Pull requests

- Keep changes focused on a single concern when possible.
- Describe what changed and why in the PR description.
- If you change behavior visible to operators or integrators, update the relevant doc under [docs/](docs/) or the root [README.md](README.md).

## OpenClaw skill artifacts (version sync)

When you change operator-facing skill content or the HTTP skill contract, bump **`version`** in both places together so they stay aligned:

- Root [SKILL.md](SKILL.md) frontmatter
- [skills/openclaw/session-vault.skill.yaml](skills/openclaw/session-vault.skill.yaml)

Also update [docs/openclaw-skill-integration.md](docs/openclaw-skill-integration.md), [schemas/session-vault.skill.schema.json](schemas/session-vault.skill.schema.json), and [scripts/skill-acceptance.mjs](scripts/skill-acceptance.mjs) if routes, env vars, or manifest shape change. Run `npm run skill:check` before merging.

If you publish or sync this repo to **ClawHub**, the root [`.clawhubignore`](.clawhubignore) reduces bundle noise (`node_modules`, build dirs, local `vault/`, etc.). ClawHub still enforces text-file allowlists and size limits server-side.

## Security

See [SECURITY.md](SECURITY.md) for reporting vulnerabilities.
