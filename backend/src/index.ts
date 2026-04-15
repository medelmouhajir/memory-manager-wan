import { createApp } from "./app.js";
import { env } from "./config/env.js";

const app = await createApp();
app.listen(env.port, () => {
  const startupLog = {
    level: "info",
    event: "backend_start",
    service: "session-vault-backend",
    port: env.port,
    apiBase: env.apiBase,
    vaultRoot: env.vaultRoot,
    env: env.nodeEnv,
    logLevel: env.logLevel,
    authEnabled: env.authEnabled,
    indexDbPath: env.indexDbPath ?? null,
    compactionIntervalMs: env.compactionIntervalMs,
    timestamp: new Date().toISOString()
  };
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(startupLog));
});
