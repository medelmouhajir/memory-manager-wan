import { promises as fs } from "node:fs";

const skillFile = process.env.OPENCLAW_SKILL_FILE ?? "skills/openclaw/session-vault.skill.yaml";
const shouldProbeApi = (process.env.SKILL_PROBE_API ?? "false").toLowerCase() === "true";
const apiBase = process.env.VAULT_API_BASE ?? "http://localhost:4000/api/v1/vault";
const healthUrl = process.env.VAULT_HEALTH_URL ?? "http://localhost:4000/health";
const readyUrl = process.env.VAULT_READY_URL ?? "http://localhost:4000/ready";
const apiKey = process.env.VAULT_API_KEY ?? "";

const requiredTokens = [
  "schema_version:",
  "id: session-vault",
  "name: Session Vault Memory Manager",
  "base_url_env: VAULT_API_BASE",
  "header: x-api-key",
  "key_env: VAULT_API_KEY"
];

const requiredEndpoints = [
  "path: /events",
  "path: /summary",
  "path: /memory",
  "path: /snapshot/build",
  "path: /snapshots",
  "path: /snapshot/restore",
  "path: /search",
  "path: /tasks",
  "path: /contradictions/resolve",
  "path: /compact"
];

async function assertManifest() {
  const text = await fs.readFile(skillFile, "utf8");
  for (const token of requiredTokens) {
    if (!text.includes(token)) {
      throw new Error(`Skill manifest missing required token: ${token}`);
    }
  }
  for (const endpoint of requiredEndpoints) {
    if (!text.includes(endpoint)) {
      throw new Error(`Skill manifest missing endpoint mapping: ${endpoint}`);
    }
  }
  return text;
}

async function request(url) {
  const response = await fetch(url, {
    headers: {
      ...(apiKey ? { "x-api-key": apiKey } : {})
    }
  });
  const bodyText = await response.text();
  let body = {};
  try {
    body = bodyText ? JSON.parse(bodyText) : {};
  } catch {
    body = { raw: bodyText };
  }
  if (!response.ok) {
    throw new Error(`Probe failed for ${url}: ${response.status} ${JSON.stringify(body)}`);
  }
  return body;
}

await assertManifest();

if (shouldProbeApi) {
  const health = await request(healthUrl);
  const ready = await request(readyUrl);
  const search = await request(`${apiBase}/search?q=session&type=fact`);
  if (!Array.isArray(search.results)) {
    throw new Error("Probe failed: /search response did not include results[]");
  }
  console.log(
    JSON.stringify({
      ok: true,
      mode: "manifest+probe",
      skillFile,
      healthOk: Boolean(health.ok),
      readyOk: Boolean(ready.ok),
      searchResultCount: search.results.length
    })
  );
} else {
  console.log(
    JSON.stringify({
      ok: true,
      mode: "manifest-only",
      skillFile
    })
  );
}
