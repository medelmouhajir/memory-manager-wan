import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv";
import { parse as parseYaml } from "yaml";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "..");

const skillFile = process.env.OPENCLAW_SKILL_FILE ?? path.join(repoRoot, "skills/openclaw/session-vault.skill.yaml");
const schemaFile = process.env.OPENCLAW_SKILL_SCHEMA ?? path.join(repoRoot, "schemas/session-vault.skill.schema.json");

const shouldProbeApi = (process.env.SKILL_PROBE_API ?? "false").toLowerCase() === "true";
const apiBase = process.env.VAULT_API_BASE ?? "http://localhost:4000/api/v1/vault";
const healthUrl = process.env.VAULT_HEALTH_URL ?? "http://localhost:4000/health";
const readyUrl = process.env.VAULT_READY_URL ?? "http://localhost:4000/ready";
const apiKey = process.env.VAULT_API_KEY ?? "";

/** Every path that must appear at least once under `capabilities`. */
const requiredCapabilityPaths = [
  "/events",
  "/summary",
  "/memory",
  "/snapshot/build",
  "/snapshots",
  "/snapshot/restore",
  "/search",
  "/tasks",
  "/contradictions/resolve",
  "/compact"
];

async function loadValidatedManifest() {
  const [yamlText, schemaJson] = await Promise.all([readFile(skillFile, "utf8"), readFile(schemaFile, "utf8")]);
  let data;
  try {
    data = parseYaml(yamlText);
  } catch (err) {
    throw new Error(`Invalid YAML in ${skillFile}: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (data === null || typeof data !== "object") {
    throw new Error(`Expected YAML document to be an object in ${skillFile}`);
  }

  const schema = JSON.parse(schemaJson);
  const ajv = new Ajv({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);
  if (!validate(data)) {
    const msg = ajv.errorsText(validate.errors, { separator: "\n" });
    throw new Error(`Skill manifest failed JSON Schema validation (${schemaFile}):\n${msg}`);
  }

  const paths = new Set(
    Array.isArray(data.capabilities) ? data.capabilities.map((c) => c?.path).filter((p) => typeof p === "string") : []
  );
  const missing = requiredCapabilityPaths.filter((p) => !paths.has(p));
  if (missing.length > 0) {
    throw new Error(`Skill manifest missing capability path(s): ${missing.join(", ")}`);
  }

  return data;
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

await loadValidatedManifest();

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
      schemaFile,
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
      skillFile,
      schemaFile
    })
  );
}
