import path from "node:path";
import { z } from "zod";

const DEFAULT_VAULT_ROOT = path.resolve(process.cwd(), "..", "vault");
const DEFAULT_NODE_ENV = "development";

const envSchema = z.object({
  PORT: z.coerce.number().int().min(0).max(65535).default(4000),
  VAULT_ROOT: z.string().min(1).default(DEFAULT_VAULT_ROOT),
  API_BASE: z.string().min(1).default("/api/v1/vault"),
  NODE_ENV: z.enum(["development", "test", "production"]).default(DEFAULT_NODE_ENV),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  AUTH_ENABLED: z.coerce.boolean().default(false),
  VAULT_API_KEY_ADMIN: z.string().optional(),
  VAULT_API_KEY_OPERATOR: z.string().optional(),
  VAULT_API_KEY_READER: z.string().optional(),
  INDEX_DB_PATH: z.string().optional(),
  COMPACTION_INTERVAL_MS: z.coerce.number().int().nonnegative().default(0)
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
  throw new Error(`Invalid backend environment configuration: ${issues}`);
}

export const env = {
  port: parsed.data.PORT,
  vaultRoot: parsed.data.VAULT_ROOT,
  apiBase: parsed.data.API_BASE,
  nodeEnv: parsed.data.NODE_ENV,
  logLevel: parsed.data.LOG_LEVEL,
  authEnabled: parsed.data.AUTH_ENABLED,
  apiKeys: {
    admin: parsed.data.VAULT_API_KEY_ADMIN ?? "",
    operator: parsed.data.VAULT_API_KEY_OPERATOR ?? "",
    reader: parsed.data.VAULT_API_KEY_READER ?? ""
  },
  indexDbPath: parsed.data.INDEX_DB_PATH,
  compactionIntervalMs: parsed.data.COMPACTION_INTERVAL_MS
};

if (env.authEnabled && !env.apiKeys.admin && !env.apiKeys.operator && !env.apiKeys.reader) {
  throw new Error("AUTH_ENABLED=true requires at least one configured VAULT_API_KEY_* value.");
}
