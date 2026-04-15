import cors from "cors";
import express from "express";
import { promises as fs } from "node:fs";
import { performance } from "node:perf_hooks";
import path from "node:path";
import { env } from "./config/env.js";
import { createAuthMiddleware } from "./middleware/auth.js";
import { errorMiddleware } from "./middleware/errors.js";
import { createVaultRouter } from "./routes/vault.js";
import { VaultEngine } from "./services/engine.js";
import { MetricsRegistry } from "./services/metrics.js";
import { VaultStorage } from "./services/storage.js";

export async function createApp() {
  const storage = new VaultStorage(env.vaultRoot, { indexDbPath: env.indexDbPath });
  await storage.ensureStructure();
  const engine = new VaultEngine(storage);
  const metrics = new MetricsRegistry();

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));
  app.use(createAuthMiddleware({ enabled: env.authEnabled, apiKeys: env.apiKeys }));

  app.use(async (req, res, next) => {
    const startedAt = performance.now();
    res.on("finish", async () => {
      const durationMs = performance.now() - startedAt;
      const routeKey = `${req.method} ${req.path}`;
      metrics.observe(routeKey, res.statusCode, durationMs);
      if (!env.authEnabled) {
        return;
      }
      await storage
        .appendAuditEvent({
          timestamp: new Date().toISOString(),
          actor_role: req.vaultRole ?? "unknown",
          actor_id: req.vaultApiKeyId ?? "unknown",
          method: req.method,
          path: req.path,
          status: res.statusCode,
          duration_ms: Number(durationMs.toFixed(2))
        })
        .catch(() => undefined);
    });
    next();
  });

  app.get("/health", (_req, res) => {
    res.json({
      ok: true,
      service: "session-vault-backend",
      timestamp: new Date().toISOString(),
      env: env.nodeEnv
    });
  });

  app.get("/ready", async (_req, res) => {
    try {
      const memoryDir = path.join(env.vaultRoot, "memory");
      const indexPath = path.join(memoryDir, "index.json");
      await fs.access(env.vaultRoot);
      await fs.access(memoryDir);
      await fs.access(indexPath);
      res.json({
        ok: true,
        vaultRoot: env.vaultRoot,
        checks: {
          vaultRootAccessible: true,
          memoryAccessible: true,
          indexPresent: true
        }
      });
    } catch (error) {
      res.status(503).json({
        ok: false,
        error: error instanceof Error ? error.message : "Readiness check failed"
      });
    }
  });

  app.get("/metrics", (_req, res) => {
    res.json(metrics.snapshot());
  });

  app.use(env.apiBase, createVaultRouter(engine));
  app.use(errorMiddleware);

  if (env.compactionIntervalMs > 0) {
    const handle = setInterval(() => {
      engine.compact().catch(() => undefined);
    }, env.compactionIntervalMs);
    handle.unref();
  }

  return app;
}
