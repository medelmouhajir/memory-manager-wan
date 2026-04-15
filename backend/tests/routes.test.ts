import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

describe("vault routes", () => {
  let baseUrl = "";
  let stopServer: (() => Promise<void>) | undefined;
  let vaultRoot = "";

  beforeAll(async () => {
    vaultRoot = await mkdtemp(path.join(os.tmpdir(), "vault-routes-"));
    process.env.VAULT_ROOT = vaultRoot;
    process.env.PORT = "0";
    const { createApp } = await import("../src/app.js");
    const app = await createApp();
    await new Promise<void>((resolve) => {
      const server = app.listen(0, "127.0.0.1", () => {
        const address = server.address();
        if (!address || typeof address === "string") {
          throw new Error("Failed to bind test server");
        }
        baseUrl = `http://127.0.0.1:${address.port}/api/v1/vault`;
        stopServer = async () => {
          await new Promise<void>((done, reject) => {
            server.close((error) => (error ? reject(error) : done()));
          });
        };
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (stopServer) {
      await stopServer();
    }
    delete process.env.VAULT_ROOT;
    delete process.env.PORT;
    if (vaultRoot) {
      await rm(vaultRoot, { recursive: true, force: true });
    }
  });

  it("rejects invalid task payloads with validation details", async () => {
    const response = await fetch(`${baseUrl}/tasks`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        tasks: [{ task_id: "t-1", title: "incomplete task" }]
      })
    });

    expect(response.status).toBe(400);
    const body = (await response.json()) as { code: string; error: string; details: Array<{ message: string }> };
    expect(body.code).toBe("VALIDATION_ERROR");
    expect(body.error).toBe("Validation error");
    expect(body.details.length).toBeGreaterThan(0);
  });

  it("returns server errors from malformed persisted logs", async () => {
    const eventsPayload = {
      session_id: "s-routes",
      event: {
        event_id: "evt-route",
        session_id: "s-routes",
        timestamp: "2026-04-15T00:00:00.000Z",
        type: "fact",
        title: "Route check",
        content: "runtime=node",
        tags: [],
        sources: [],
        confidence: 0.8,
        freshness: "high",
        status: "active"
      }
    };
    const createResponse = await fetch(`${baseUrl}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(eventsPayload)
    });
    expect(createResponse.status).toBe(201);

    // Corrupt logs through the public API path by overwriting memory with malformed content.
    const fs = await import("node:fs/promises");
    const logPath = path.join(vaultRoot, "logs", "2026-04-15", "s-routes.ndjson");
    await fs.writeFile(logPath, "not-json\n", "utf8");

    const response = await fetch(`${baseUrl}/logs?date=2026-04-15`, { method: "GET" });
    expect(response.status).toBe(500);
    const body = (await response.json()) as { code: string; error: string };
    expect(body.code).toBe("LOG_PARSE_ERROR");
    expect(body.error).toContain("Malformed log event");
  });

  it("preserves search result after compaction endpoint", async () => {
    const payload = {
      session_id: "s-compaction-search",
      event: {
        event_id: "evt-compaction-search",
        session_id: "s-compaction-search",
        timestamp: "2026-04-15T11:00:00.000Z",
        type: "fact",
        title: "Timeout config",
        content: "timeout=25",
        tags: ["network"],
        sources: ["session:s-compaction-search"],
        confidence: 0.8,
        freshness: "high",
        status: "active"
      }
    };
    const created = await fetch(`${baseUrl}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    expect(created.status).toBe(201);

    const before = await fetch(`${baseUrl}/search?q=timeout&type=fact&tag=network`);
    const beforeBody = (await before.json()) as { results: Array<{ id: string }> };
    expect(beforeBody.results.some((entry) => entry.id === "evt-compaction-search")).toBe(true);

    const compactResponse = await fetch(`${baseUrl}/compact`, { method: "POST" });
    expect(compactResponse.status).toBe(201);

    const after = await fetch(`${baseUrl}/search?q=timeout&type=fact&tag=network`);
    const afterBody = (await after.json()) as { results: Array<{ id: string }> };
    expect(afterBody.results.some((entry) => entry.id === "evt-compaction-search")).toBe(true);
  });

  it("reports health and readiness", async () => {
    const health = await fetch(baseUrl.replace("/api/v1/vault", "/health"));
    expect(health.status).toBe(200);
    const healthBody = (await health.json()) as { ok: boolean };
    expect(healthBody.ok).toBe(true);

    const ready = await fetch(baseUrl.replace("/api/v1/vault", "/ready"));
    expect(ready.status).toBe(200);
    const readyBody = (await ready.json()) as { ok: boolean };
    expect(readyBody.ok).toBe(true);
  });
});
