import { Router } from "express";
import { randomUUID } from "node:crypto";
import { requireRole } from "../middleware/auth.js";
import { VaultEngine } from "../services/engine.js";
import {
  appendEventSchema,
  contradictionResolveSchema,
  logsQuerySchema,
  memoryReadSchema,
  snapshotDiffSchema,
  snapshotRestoreSchema,
  searchQuerySchema,
  snapshotBuildSchema,
  strictMemorySchema,
  summarySchema,
  taskUpsertSchema
} from "../services/schemas.js";

export function createVaultRouter(engine: VaultEngine): Router {
  const router = Router();

  router.post("/events", requireRole("operator"), async (req, res, next) => {
    try {
      const payload = appendEventSchema.parse(req.body);
      await engine.appendEvent({
        ...payload.event,
        session_id: payload.session_id,
        event_id: payload.event.event_id || randomUUID()
      });
      res.status(201).json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  router.post("/summary", requireRole("operator"), async (req, res, next) => {
    try {
      const payload = summarySchema.parse(req.body);
      await engine.writeSummary(payload.session_id, payload.summary);
      res.status(201).json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  router.post("/memory", requireRole("operator"), async (req, res, next) => {
    try {
      const strictPayload = strictMemorySchema.parse(req.body);
      await engine.updateMemory(strictPayload.type, strictPayload.entries);
      res.status(201).json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  router.get("/snapshot/latest", async (_req, res, next) => {
    try {
      const content = await engine.getLatestSnapshot();
      res.json({ content });
    } catch (error) {
      next(error);
    }
  });

  router.post("/snapshot/build", requireRole("operator"), async (req, res, next) => {
    try {
      const payload = snapshotBuildSchema.parse(req.body);
      const content = await engine.buildSnapshot(payload.session_id);
      res.status(201).json({ content });
    } catch (error) {
      next(error);
    }
  });

  router.get("/snapshots", async (_req, res, next) => {
    try {
      const snapshots = await engine.listSnapshots();
      res.json({ snapshots });
    } catch (error) {
      next(error);
    }
  });

  router.get("/snapshot/diff", async (req, res, next) => {
    try {
      const query = snapshotDiffSchema.parse(req.query);
      const diff = await engine.diffSnapshots(query.left, query.right);
      res.json(diff);
    } catch (error) {
      next(error);
    }
  });

  router.post("/snapshot/restore", requireRole("admin"), async (req, res, next) => {
    try {
      const body = snapshotRestoreSchema.parse(req.body);
      await engine.restoreSnapshot(body.id);
      res.status(201).json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  router.get("/search", async (req, res, next) => {
    try {
      const query = searchQuerySchema.parse(req.query);
      const results = await engine.searchWithFilters(query);
      res.json({ results });
    } catch (error) {
      next(error);
    }
  });

  router.get("/logs", async (req, res, next) => {
    try {
      const query = logsQuerySchema.parse(req.query);
      const logs = await engine.listLogs(query);
      res.json({ logs });
    } catch (error) {
      next(error);
    }
  });

  router.get("/memory", async (req, res, next) => {
    try {
      const query = memoryReadSchema.parse(req.query);
      const memory = await engine.listMemory(query.type);
      res.json({ memory });
    } catch (error) {
      next(error);
    }
  });

  router.get("/tasks", async (_req, res, next) => {
    try {
      const results = await engine.listTasks();
      res.json({
        tasks: results
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/tasks", requireRole("operator"), async (req, res, next) => {
    try {
      const payload = taskUpsertSchema.parse(req.body);
      const tasks = await engine.upsertTasks(payload.tasks);
      res.status(201).json({ tasks });
    } catch (error) {
      next(error);
    }
  });

  router.post("/contradictions/resolve", requireRole("operator"), async (req, res, next) => {
    try {
      const body = contradictionResolveSchema.parse(req.body);
      await engine.resolveContradiction(body.id, body.resolution);
      res.status(201).json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  router.get("/contradictions", async (_req, res, next) => {
    try {
      const contradictions = await engine.listContradictions();
      res.json({ contradictions });
    } catch (error) {
      next(error);
    }
  });

  router.post("/compact", requireRole("admin"), async (_req, res, next) => {
    try {
      await engine.compact();
      res.status(201).json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
