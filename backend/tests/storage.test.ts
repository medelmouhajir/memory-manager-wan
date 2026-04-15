import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { VaultStorage } from "../src/services/storage.js";

describe("VaultStorage retention and archive", () => {
  it("archives logs older than retention window during compaction", async () => {
    const tmp = await mkdtemp(path.join(os.tmpdir(), "vault-storage-"));
    const storage = new VaultStorage(tmp);
    await storage.ensureStructure();

    const oldDate = "2000-01-01";
    const recentDate = new Date().toISOString().slice(0, 10);
    const oldDir = path.join(tmp, "logs", oldDate);
    const recentDir = path.join(tmp, "logs", recentDate);
    await mkdir(oldDir, { recursive: true });
    await mkdir(recentDir, { recursive: true });
    await writeFile(path.join(oldDir, "archivable.ndjson"), "{\"event_id\":\"old\"}\n", "utf8");
    await writeFile(path.join(recentDir, "keep.ndjson"), "{\"event_id\":\"new\"}\n", "utf8");

    await storage.compactMemory();

    const archivedPath = path.join(tmp, "history", "archive", `${oldDate}.logs`, "archivable.ndjson");
    const archived = await readFile(archivedPath, "utf8");
    expect(archived).toContain("\"event_id\":\"old\"");
    await expect(stat(path.join(oldDir, "archivable.ndjson"))).rejects.toThrow();
    const kept = await readFile(path.join(recentDir, "keep.ndjson"), "utf8");
    expect(kept).toContain("\"event_id\":\"new\"");

    await rm(tmp, { recursive: true, force: true });
  });

  it("keeps archive compaction idempotent on repeated runs", async () => {
    const tmp = await mkdtemp(path.join(os.tmpdir(), "vault-storage-"));
    const storage = new VaultStorage(tmp);
    await storage.ensureStructure();

    const oldDate = "2001-01-01";
    const oldDir = path.join(tmp, "logs", oldDate);
    await mkdir(oldDir, { recursive: true });
    await writeFile(path.join(oldDir, "stable.ndjson"), "{\"event_id\":\"stable\"}\n", "utf8");

    await storage.compactMemory();
    await storage.compactMemory();

    const archivedPath = path.join(tmp, "history", "archive", `${oldDate}.logs`, "stable.ndjson");
    const archived = await readFile(archivedPath, "utf8");
    expect(archived).toContain("\"event_id\":\"stable\"");
    await expect(stat(path.join(tmp, "logs", oldDate))).rejects.toThrow();
    await rm(tmp, { recursive: true, force: true });
  });

  it("keeps sqlite index mirror in parity with file index", async () => {
    const tmp = await mkdtemp(path.join(os.tmpdir(), "vault-storage-"));
    const sqlitePath = path.join(tmp, "index.db");
    const storage = new VaultStorage(tmp, { indexDbPath: sqlitePath });
    await storage.ensureStructure();

    await storage.setIndex({
      entries: [
        {
          id: "idx-1",
          session_id: "s-1",
          type: "fact",
          tags: ["db"],
          keywords: ["sqlite", "mirror"],
          file: "memory/facts.md",
          line: 0,
          timestamp: "2026-04-15T00:00:00.000Z"
        },
        {
          id: "idx-2",
          session_id: "s-2",
          type: "decision",
          tags: ["release"],
          keywords: ["go", "decision"],
          file: "memory/decisions.md",
          line: 0,
          timestamp: "2026-04-15T01:00:00.000Z"
        }
      ]
    });

    const index = await storage.getIndex();
    expect(index.entries.length).toBe(2);
    expect(index.entries.map((entry) => entry.id).sort()).toEqual(["idx-1", "idx-2"]);
    storage.close();
    await rm(tmp, { recursive: true, force: true });
  });
});
