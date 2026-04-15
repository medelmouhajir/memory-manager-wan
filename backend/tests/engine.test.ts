import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { VaultEngine } from "../src/services/engine.js";
import { strictMemorySchema } from "../src/services/schemas.js";
import { VaultStorage } from "../src/services/storage.js";

describe("VaultEngine", () => {
  it("writes events and updates index", async () => {
    const tmp = await mkdtemp(path.join(os.tmpdir(), "vault-test-"));
    const storage = new VaultStorage(tmp);
    await storage.ensureStructure();
    const engine = new VaultEngine(storage);

    await engine.appendEvent({
      event_id: "evt-1",
      session_id: "s-1",
      timestamp: new Date().toISOString(),
      type: "fact",
      title: "Database uses sqlite",
      content: "storage=db.sqlite",
      tags: ["db"],
      sources: ["session:s-1"],
      confidence: 0.8,
      freshness: "high",
      status: "active"
    });

    const indexRaw = await readFile(path.join(tmp, "memory", "index.json"), "utf8");
    expect(indexRaw).toContain("\"id\": \"evt-1\"");
    await rm(tmp, { recursive: true, force: true });
  });

  it("redacts secret-like text before persistence", async () => {
    const tmp = await mkdtemp(path.join(os.tmpdir(), "vault-test-"));
    const storage = new VaultStorage(tmp);
    await storage.ensureStructure();
    const engine = new VaultEngine(storage);

    await engine.appendEvent({
      event_id: "evt-2",
      session_id: "s-1",
      timestamp: new Date().toISOString(),
      type: "message",
      title: "api_key: 12345",
      content: "password=abcd",
      tags: [],
      sources: [],
      confidence: 0.9,
      freshness: "medium",
      status: "active"
    });

    const day = new Date().toISOString().slice(0, 10);
    const logRaw = await readFile(path.join(tmp, "logs", day, "s-1.ndjson"), "utf8");
    expect(logRaw).not.toContain("12345");
    expect(logRaw).not.toContain("abcd");
    await rm(tmp, { recursive: true, force: true });
  });

  it("supports filtered search and log listing", async () => {
    const tmp = await mkdtemp(path.join(os.tmpdir(), "vault-test-"));
    const storage = new VaultStorage(tmp);
    await storage.ensureStructure();
    const engine = new VaultEngine(storage);
    const now = new Date().toISOString();

    await engine.appendEvent({
      event_id: "evt-3",
      session_id: "s-search",
      timestamp: now,
      type: "decision",
      title: "Use sqlite index",
      content: "Decision to use sqlite for v1",
      tags: ["db", "v1"],
      sources: ["session:s-search"],
      confidence: 0.9,
      freshness: "high",
      status: "active"
    });

    const searchResults = await engine.searchWithFilters({ q: "sqlite", type: "decision", tag: "db" });
    expect(searchResults.length).toBe(1);
    expect(searchResults[0]?.id).toBe("evt-3");

    const logs = await engine.listLogs({ session_id: "s-search", type: "decision" });
    expect(logs.length).toBe(1);
    expect(logs[0]?.event_id).toBe("evt-3");
    await rm(tmp, { recursive: true, force: true });
  });

  it("marks contradiction as resolved", async () => {
    const tmp = await mkdtemp(path.join(os.tmpdir(), "vault-test-"));
    const storage = new VaultStorage(tmp);
    await storage.ensureStructure();
    const engine = new VaultEngine(storage);
    const now = new Date().toISOString();

    await engine.appendEvent({
      event_id: "evt-4",
      session_id: "s-contradiction",
      timestamp: now,
      type: "fact",
      title: "Primary DB is sqlite",
      content: "db=sqlite",
      tags: ["db"],
      sources: ["session:s-contradiction"],
      confidence: 0.7,
      freshness: "high",
      status: "active"
    });
    await engine.appendEvent({
      event_id: "evt-5",
      session_id: "s-contradiction",
      timestamp: new Date(Date.now() + 1000).toISOString(),
      type: "fact",
      title: "Primary DB is postgres",
      content: "db=postgres",
      tags: ["db"],
      sources: ["session:s-contradiction"],
      confidence: 0.7,
      freshness: "high",
      status: "active"
    });

    const contradictions = await engine.listContradictions();
    expect(contradictions.length).toBeGreaterThan(0);
    const active = contradictions.find((item) => item.status === "active");
    expect(active).toBeTruthy();

    await engine.resolveContradiction(active!.contradiction_id, "Finalized to postgres");
    const refreshed = await engine.listContradictions();
    const resolved = refreshed.find((item) => item.contradiction_id === active!.contradiction_id);
    expect(resolved?.status).toBe("resolved");
    expect(resolved?.resolution).toContain("postgres");
    await rm(tmp, { recursive: true, force: true });
  });

  it("compacts duplicate memory entries", async () => {
    const tmp = await mkdtemp(path.join(os.tmpdir(), "vault-test-"));
    const storage = new VaultStorage(tmp);
    await storage.ensureStructure();
    const engine = new VaultEngine(storage);
    const now = new Date().toISOString();

    await engine.appendEvent({
      event_id: "evt-6",
      session_id: "s-compact",
      timestamp: now,
      type: "fact",
      title: "Server mode",
      content: "mode=prod",
      tags: ["runtime"],
      sources: ["session:s-compact"],
      confidence: 0.8,
      freshness: "medium",
      status: "active"
    });
    await engine.updateMemory("facts", [
      {
        id: "evt-6",
        title: "Server mode",
        content: "mode=prod",
        session_id: "s-compact",
        timestamp: now,
        tags: ["runtime"],
        sources: ["session:s-compact"],
        confidence: 0.8,
        freshness: "medium",
        status: "active"
      }
    ]);

    await engine.compact();
    const facts = await storage.readMemory("facts");
    const duplicates = facts.filter((entry) => entry.id === "evt-6");
    expect(duplicates.length).toBe(1);
    await rm(tmp, { recursive: true, force: true });
  });

  it("keeps contradiction history by superseding active entries", async () => {
    const tmp = await mkdtemp(path.join(os.tmpdir(), "vault-test-"));
    const storage = new VaultStorage(tmp);
    await storage.ensureStructure();
    const engine = new VaultEngine(storage);

    await engine.appendEvent({
      event_id: "evt-c1",
      session_id: "s-contradiction-history",
      timestamp: new Date().toISOString(),
      type: "fact",
      title: "Runtime",
      content: "runtime=node",
      tags: ["runtime"],
      sources: ["session:s-contradiction-history"],
      confidence: 0.8,
      freshness: "high",
      status: "active"
    });
    await engine.appendEvent({
      event_id: "evt-c2",
      session_id: "s-contradiction-history",
      timestamp: new Date(Date.now() + 1000).toISOString(),
      type: "fact",
      title: "Runtime",
      content: "runtime=python",
      tags: ["runtime"],
      sources: ["session:s-contradiction-history"],
      confidence: 0.8,
      freshness: "high",
      status: "active"
    });
    await engine.appendEvent({
      event_id: "evt-c3",
      session_id: "s-contradiction-history",
      timestamp: new Date(Date.now() + 2000).toISOString(),
      type: "fact",
      title: "Runtime",
      content: "runtime=go",
      tags: ["runtime"],
      sources: ["session:s-contradiction-history"],
      confidence: 0.8,
      freshness: "high",
      status: "active"
    });

    const contradictions = await engine.listContradictions();
    expect(contradictions.some((entry) => entry.status === "superseded")).toBe(true);
    expect(contradictions.some((entry) => entry.status === "active")).toBe(true);
    await rm(tmp, { recursive: true, force: true });
  });

  it("lists, diffs, and restores snapshots", async () => {
    const tmp = await mkdtemp(path.join(os.tmpdir(), "vault-test-"));
    const storage = new VaultStorage(tmp);
    await storage.ensureStructure();
    const engine = new VaultEngine(storage);

    const first = await engine.buildSnapshot("session-a");
    await new Promise((resolve) => setTimeout(resolve, 5));
    await engine.appendEvent({
      event_id: "evt-s1",
      session_id: "session-a",
      timestamp: new Date().toISOString(),
      type: "task",
      title: "Run snapshot test",
      content: "run tests",
      tags: ["qa"],
      sources: ["session:session-a"],
      confidence: 0.9,
      freshness: "high",
      status: "active"
    });
    const second = await engine.buildSnapshot("session-a");

    const snapshots = await engine.listSnapshots();
    expect(snapshots.length).toBeGreaterThanOrEqual(2);

    const diff = await engine.diffSnapshots(snapshots[1]!.id, snapshots[0]!.id);
    expect(diff.changed).toBe(true);
    expect(diff.left.length).toBeGreaterThan(0);
    expect(diff.right.length).toBeGreaterThan(0);

    await engine.restoreSnapshot(snapshots[1]!.id);
    const latest = await engine.getLatestSnapshot();
    expect(latest).toBe(first);
    expect(second).not.toBe(first);

    await rm(tmp, { recursive: true, force: true });
  });

  it("restores snapshots deterministically across repeated restores", async () => {
    const tmp = await mkdtemp(path.join(os.tmpdir(), "vault-test-"));
    const storage = new VaultStorage(tmp);
    await storage.ensureStructure();
    const engine = new VaultEngine(storage);

    const first = await engine.buildSnapshot("deterministic");
    await engine.appendEvent({
      event_id: "evt-det-1",
      session_id: "deterministic",
      timestamp: new Date().toISOString(),
      type: "fact",
      title: "Deterministic check",
      content: "deterministic=true",
      tags: ["test"],
      sources: ["session:deterministic"],
      confidence: 0.8,
      freshness: "high",
      status: "active"
    });
    await new Promise((resolve) => setTimeout(resolve, 5));
    await engine.buildSnapshot("deterministic");
    const snapshots = await engine.listSnapshots();
    const target = snapshots.at(-1);
    expect(target).toBeTruthy();

    await engine.restoreSnapshot(target!.id);
    const once = await engine.getLatestSnapshot();
    await engine.restoreSnapshot(target!.id);
    const twice = await engine.getLatestSnapshot();
    expect(once).toBe(first);
    expect(twice).toBe(first);

    await rm(tmp, { recursive: true, force: true });
  });

  it("keeps index stable across repeated writes and compact cycles", async () => {
    const tmp = await mkdtemp(path.join(os.tmpdir(), "vault-test-"));
    const storage = new VaultStorage(tmp);
    await storage.ensureStructure();
    const engine = new VaultEngine(storage);
    const baseTs = Date.now();

    for (let idx = 0; idx < 5; idx += 1) {
      await engine.appendEvent({
        event_id: `evt-stable-${idx}`,
        session_id: "s-stable",
        timestamp: new Date(baseTs + idx * 1000).toISOString(),
        type: idx % 2 === 0 ? "fact" : "decision",
        title: idx % 2 === 0 ? `Config ${idx}` : `Decision ${idx}`,
        content: idx % 2 === 0 ? `config_${idx}=on` : `choose option ${idx}`,
        tags: ["stable"],
        sources: ["session:s-stable"],
        confidence: 0.8,
        freshness: "high",
        status: "active"
      });
    }

    const before = await storage.getIndex();
    await engine.compact();
    await engine.compact();
    const after = await storage.getIndex();
    expect(after.entries.length).toBe(before.entries.length);
    expect(new Set(after.entries.map((entry) => entry.id)).size).toBe(after.entries.length);
    expect(after.entries.map((entry) => entry.id).sort()).toEqual(before.entries.map((entry) => entry.id).sort());
    await rm(tmp, { recursive: true, force: true });
  });

  it("keeps search behavior consistent after memory rewrite and compaction", async () => {
    const tmp = await mkdtemp(path.join(os.tmpdir(), "vault-test-"));
    const storage = new VaultStorage(tmp);
    await storage.ensureStructure();
    const engine = new VaultEngine(storage);

    const event = {
      event_id: "evt-search-stability",
      session_id: "s-search-stability",
      timestamp: "2026-04-15T10:00:00.000Z",
      type: "fact" as const,
      title: "Network timeout",
      content: "timeout=30",
      tags: ["api"],
      sources: ["session:s-search-stability"],
      confidence: 0.9,
      freshness: "high" as const,
      status: "active" as const
    };

    await engine.appendEvent(event);
    const before = await engine.searchWithFilters({ q: "timeout", type: "fact", tag: "api" });
    expect(before.some((entry) => entry.id === event.event_id)).toBe(true);

    const facts = await storage.readMemory("facts");
    await engine.updateMemory("facts", facts);
    await engine.compact();

    const after = await engine.searchWithFilters({ q: "timeout", type: "fact", tag: "api" });
    expect(after.some((entry) => entry.id === event.event_id)).toBe(true);
    expect(after.length).toBe(before.length);
    await rm(tmp, { recursive: true, force: true });
  });

  it("rejects invalid strict memory payloads", async () => {
    const parsed = strictMemorySchema.safeParse({
      type: "tasks",
      entries: [
        {
          task_id: "t-1",
          title: "Missing required status fields"
        }
      ]
    });
    expect(parsed.success).toBe(false);
  });

  it("fails fast on malformed memory entries", async () => {
    const tmp = await mkdtemp(path.join(os.tmpdir(), "vault-test-"));
    const storage = new VaultStorage(tmp);
    await storage.ensureStructure();
    await writeFile(
      path.join(tmp, "memory", "facts.md"),
      "# Facts\n- {\"id\":\"ok\",\"title\":\"t\",\"content\":\"x=y\",\"session_id\":\"s\",\"timestamp\":\"2026-01-01T00:00:00.000Z\",\"tags\":[],\"sources\":[],\"confidence\":0.8,\"freshness\":\"high\",\"status\":\"active\"}\n- {not-json}\n",
      "utf8"
    );

    await expect(storage.readMemory("facts")).rejects.toThrow(/Malformed memory record/);
    await rm(tmp, { recursive: true, force: true });
  });

  it("fails fast on malformed log lines", async () => {
    const tmp = await mkdtemp(path.join(os.tmpdir(), "vault-test-"));
    const storage = new VaultStorage(tmp);
    await storage.ensureStructure();
    const day = "2026-01-10";
    const logsDir = path.join(tmp, "logs", day);
    await mkdir(logsDir, { recursive: true });
    await writeFile(path.join(logsDir, "s-1.ndjson"), "{\"event_id\":\"ok\"}\nnot-json\n", "utf8");

    await expect(storage.listEvents({})).rejects.toThrow(/Malformed log event/);
    await rm(tmp, { recursive: true, force: true });
  });

  it("applies inclusive time boundaries in filtered search", async () => {
    const tmp = await mkdtemp(path.join(os.tmpdir(), "vault-test-"));
    const storage = new VaultStorage(tmp);
    await storage.ensureStructure();
    const engine = new VaultEngine(storage);
    const timestamp = "2026-04-15T00:00:00.000Z";

    await engine.appendEvent({
      event_id: "evt-range",
      session_id: "s-range",
      timestamp,
      type: "fact",
      title: "Api timeout",
      content: "timeout=30",
      tags: ["api"],
      sources: ["session:s-range"],
      confidence: 0.9,
      freshness: "high",
      status: "active"
    });

    const results = await engine.searchWithFilters({
      q: "timeout",
      from: timestamp,
      to: timestamp
    });
    expect(results.some((entry) => entry.id === "evt-range")).toBe(true);
    await rm(tmp, { recursive: true, force: true });
  });

  it("redacts bearer tokens and quoted secrets", async () => {
    const tmp = await mkdtemp(path.join(os.tmpdir(), "vault-test-"));
    const storage = new VaultStorage(tmp);
    await storage.ensureStructure();
    const engine = new VaultEngine(storage);

    await engine.appendEvent({
      event_id: "evt-redact-advanced",
      session_id: "s-redact-advanced",
      timestamp: new Date().toISOString(),
      type: "message",
      title: "authorization: Bearer abc123xyz",
      content: "api_key='secret-value' password=\"hidden\" token=raw-token",
      tags: [],
      sources: ["token=source-secret"],
      confidence: 0.8,
      freshness: "medium",
      status: "active"
    });

    const day = new Date().toISOString().slice(0, 10);
    const logRaw = await readFile(path.join(tmp, "logs", day, "s-redact-advanced.ndjson"), "utf8");
    expect(logRaw).toContain("authorization: Bearer [REDACTED]");
    expect(logRaw).not.toContain("abc123xyz");
    expect(logRaw).not.toContain("secret-value");
    expect(logRaw).not.toContain("hidden");
    expect(logRaw).not.toContain("raw-token");
    expect(logRaw).not.toContain("source-secret");
    await rm(tmp, { recursive: true, force: true });
  });
});
