import { promises as fs } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type {
  ContradictionEntry,
  MemoryRecord,
  MemoryType,
  SnapshotSummary,
  TaskEntry,
  VaultEvent,
  VaultIndex
} from "@session-vault/shared";

const MEMORY_FILES = [
  "facts.md",
  "preferences.md",
  "decisions.md",
  "tasks.md",
  "contradictions.md"
] as const;

const MEMORY_FILE_BY_TYPE: Record<MemoryType, string> = {
  facts: "facts.md",
  preferences: "preferences.md",
  decisions: "decisions.md",
  tasks: "tasks.md",
  contradictions: "contradictions.md"
};

export class VaultStorageError extends Error {
  constructor(
    message: string,
    readonly code:
      | "MEMORY_PARSE_ERROR"
      | "LOG_PARSE_ERROR"
      | "IO_READ_ERROR"
      | "IO_WRITE_ERROR"
      | "IO_ARCHIVE_ERROR",
    options?: { cause?: unknown }
  ) {
    super(message, options);
    this.name = "VaultStorageError";
  }
}

export class VaultStorage {
  private indexDb?: DatabaseSync;
  private readonly indexDbPath?: string;

  constructor(vaultRoot: string, options?: { indexDbPath?: string }) {
    this.vaultRoot = vaultRoot;
    this.indexDbPath = options?.indexDbPath;
  }

  private readonly vaultRoot: string;

  async ensureStructure(): Promise<void> {
    await fs.mkdir(this.vaultRoot, { recursive: true });
    await fs.mkdir(path.join(this.vaultRoot, "logs"), { recursive: true });
    await fs.mkdir(path.join(this.vaultRoot, "history"), { recursive: true });
    await fs.mkdir(path.join(this.vaultRoot, "memory"), { recursive: true });
    await fs.mkdir(path.join(this.vaultRoot, "snapshots"), { recursive: true });

    await Promise.all(
      MEMORY_FILES.map(async (name) => {
        const filePath = path.join(this.vaultRoot, "memory", name);
        await this.ensureFile(filePath, "# Session Vault Memory\n");
      })
    );
    await this.ensureFile(path.join(this.vaultRoot, "memory", "index.json"), "{\"entries\":[]}\n");
    await this.ensureFile(path.join(this.vaultRoot, "snapshots", "latest.md"), "# Latest Snapshot\n");
    await this.ensureFile(path.join(this.vaultRoot, "history", "audit.ndjson"), "");
    this.initializeIndexDb();
    await this.syncIndexDbFromFile();
  }

  close(): void {
    this.indexDb?.close();
    this.indexDb = undefined;
  }

  async appendEvent(sessionId: string, event: VaultEvent): Promise<string> {
    const day = event.timestamp.slice(0, 10);
    const filePath = path.join(this.vaultRoot, "logs", day, `${sessionId}.ndjson`);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.appendFile(filePath, `${JSON.stringify(event)}\n`, "utf8");
    return filePath;
  }

  async writeSummary(sessionId: string, summary: string): Promise<string> {
    const day = new Date().toISOString().slice(0, 10);
    const filePath = path.join(this.vaultRoot, "history", `${day}.md`);
    await fs.appendFile(filePath, `## ${sessionId}\n\n${summary}\n\n`, "utf8");
    return filePath;
  }

  async appendMemory(type: string, entry: unknown): Promise<string> {
    const filePath = path.join(this.vaultRoot, "memory", `${type}.md`);
    await fs.appendFile(filePath, `- ${JSON.stringify(entry)}\n`, "utf8");
    return filePath;
  }

  async readMemory<T = Record<string, unknown>>(type: MemoryType): Promise<T[]> {
    const filePath = path.join(this.vaultRoot, "memory", MEMORY_FILE_BY_TYPE[type]);
    const content = await fs.readFile(filePath, "utf8");
    return this.parseMarkdownJsonLines(content, filePath) as T[];
  }

  async writeMemory(type: MemoryType, entries: unknown[]): Promise<string> {
    const filePath = path.join(this.vaultRoot, "memory", MEMORY_FILE_BY_TYPE[type]);
    const header = `# ${type[0].toUpperCase()}${type.slice(1)}`;
    const body = [header, ...entries.map((entry) => `- ${JSON.stringify(entry)}`), ""].join("\n");
    await this.atomicWriteFile(filePath, body);
    return filePath;
  }

  async readTasks(): Promise<TaskEntry[]> {
    return this.readMemory<TaskEntry>("tasks");
  }

  async writeTasks(tasks: TaskEntry[]): Promise<string> {
    return this.writeMemory("tasks", tasks);
  }

  async readContradictions(): Promise<ContradictionEntry[]> {
    return this.readMemory<ContradictionEntry>("contradictions");
  }

  async writeContradictions(entries: ContradictionEntry[]): Promise<string> {
    return this.writeMemory("contradictions", entries);
  }

  async getLatestSnapshot(): Promise<string> {
    return fs.readFile(path.join(this.vaultRoot, "snapshots", "latest.md"), "utf8");
  }

  async writeSnapshot(sessionId: string, content: string): Promise<void> {
    const latestPath = path.join(this.vaultRoot, "snapshots", "latest.md");
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const namedPath = path.join(this.vaultRoot, "snapshots", `${sessionId}__${stamp}.md`);
    await this.atomicWriteFile(latestPath, content);
    await this.atomicWriteFile(namedPath, content);
  }

  async listSnapshots(): Promise<SnapshotSummary[]> {
    const snapshotsDir = path.join(this.vaultRoot, "snapshots");
    const files = await this.listFiles(snapshotsDir, ".md");
    const summaries = await Promise.all(
      files
        .filter((name) => name !== "latest.md")
        .map(async (name) => {
          const stat = await fs.stat(path.join(snapshotsDir, name));
          const [sessionId] = name.replace(".md", "").split("__");
          return {
            id: name,
            session_id: sessionId ?? "unknown",
            created_at: stat.mtime.toISOString(),
            path: `snapshots/${name}`
          };
        })
    );
    return summaries.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  async getSnapshotById(id: string): Promise<string> {
    return fs.readFile(path.join(this.vaultRoot, "snapshots", id), "utf8");
  }

  async restoreSnapshot(id: string): Promise<void> {
    const content = await this.getSnapshotById(id);
    await this.atomicWriteFile(path.join(this.vaultRoot, "snapshots", "latest.md"), content);
  }

  async getIndex(): Promise<VaultIndex> {
    if (this.indexDb) {
      return this.getIndexFromDb();
    }
    const indexPath = path.join(this.vaultRoot, "memory", "index.json");
    try {
      const raw = await fs.readFile(indexPath, "utf8");
      return JSON.parse(raw) as VaultIndex;
    } catch (error) {
      throw new VaultStorageError(`Failed to read index: ${indexPath}`, "IO_READ_ERROR", { cause: error });
    }
  }

  async setIndex(index: VaultIndex): Promise<void> {
    const indexPath = path.join(this.vaultRoot, "memory", "index.json");
    await this.atomicWriteFile(indexPath, `${JSON.stringify(index, null, 2)}\n`);
    if (this.indexDb) {
      this.setIndexInDb(index);
      this.assertIndexParity(index);
    }
  }

  async appendAuditEvent(entry: Record<string, unknown>): Promise<void> {
    const filePath = path.join(this.vaultRoot, "history", "audit.ndjson");
    await fs.appendFile(filePath, `${JSON.stringify(entry)}\n`, "utf8");
  }

  async compactMemory(): Promise<void> {
    await this.compactMemoryType("facts");
    await this.compactMemoryType("preferences");
    await this.compactMemoryType("decisions");
    await this.compactTasks();
    await this.reconcileIndex();
    await this.archiveOldLogs(14);
  }

  async listEvents(filters: { session_id?: string; date?: string; type?: VaultEvent["type"] }): Promise<VaultEvent[]> {
    const logsRoot = path.join(this.vaultRoot, "logs");
    const dates = filters.date ? [filters.date] : await this.listDirectories(logsRoot);
    const events: VaultEvent[] = [];
    for (const date of dates) {
      const dayDir = path.join(logsRoot, date);
      const files = await this.listFiles(dayDir, ".ndjson");
      for (const file of files) {
        if (filters.session_id && path.basename(file, ".ndjson") !== filters.session_id) {
          continue;
        }
        const parsed = await this.readLogFile(path.join(dayDir, file));
        events.push(
          ...parsed.filter((event) => {
            if (filters.type && event.type !== filters.type) {
              return false;
            }
            return true;
          })
        );
      }
    }
    return events.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  private async ensureFile(filePath: string, initialContents: string): Promise<void> {
    try {
      await fs.access(filePath);
    } catch {
      await fs.writeFile(filePath, initialContents, "utf8");
    }
  }

  private parseMarkdownJsonLines(content: string, filePath: string): Array<Record<string, unknown>> {
    const items = content
      .split("\n")
      .map((line, index) => ({ line, lineNumber: index + 1 }))
      .filter((entry) => entry.line.startsWith("- "))
      .map((entry) => ({ raw: entry.line.slice(2).trim(), lineNumber: entry.lineNumber }));
    const parsed: Array<Record<string, unknown>> = [];
    for (const item of items) {
      try {
        parsed.push(JSON.parse(item.raw) as Record<string, unknown>);
      } catch (error) {
        throw new VaultStorageError(
          `Malformed memory record in ${filePath} at line ${item.lineNumber}`,
          "MEMORY_PARSE_ERROR",
          { cause: error }
        );
      }
    }
    return parsed;
  }

  private async compactMemoryType(type: "facts" | "preferences" | "decisions"): Promise<void> {
    const entries = await this.readMemory<MemoryRecord>(type);
    const deduped = new Map<string, MemoryRecord>();
    for (const entry of entries) {
      deduped.set(entry.id, entry);
    }
    await this.writeMemory(type, Array.from(deduped.values()));
  }

  private async compactTasks(): Promise<void> {
    const tasks = await this.readTasks();
    const deduped = new Map<string, TaskEntry>();
    for (const task of tasks) {
      deduped.set(task.task_id, task);
    }
    await this.writeTasks(Array.from(deduped.values()));
  }

  private async reconcileIndex(): Promise<void> {
    const facts = await this.readMemory<MemoryRecord>("facts");
    const preferences = await this.readMemory<MemoryRecord>("preferences");
    const decisions = await this.readMemory<MemoryRecord>("decisions");
    const tasks = await this.readTasks();
    const validIds = new Set<string>([
      ...facts.map((item) => item.id),
      ...preferences.map((item) => item.id),
      ...decisions.map((item) => item.id),
      ...tasks.map((item) => item.task_id)
    ]);
    const index = await this.getIndex();
    index.entries = index.entries.filter((entry) => validIds.has(entry.id));
    await this.setIndex(index);
  }

  private async archiveOldLogs(retentionDays: number): Promise<void> {
    const logsRoot = path.join(this.vaultRoot, "logs");
    const archiveRoot = path.join(this.vaultRoot, "history", "archive");
    await fs.mkdir(archiveRoot, { recursive: true });
    const dates = await this.listDirectories(logsRoot);
    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - retentionDays);
    for (const date of dates) {
      const dayStart = new Date(`${date}T00:00:00.000Z`);
      if (Number.isNaN(dayStart.getTime()) || dayStart >= cutoff) {
        continue;
      }
      const from = path.join(logsRoot, date);
      const to = path.join(archiveRoot, `${date}.logs`);
      try {
        await fs.rm(to, { recursive: true, force: true });
        await fs.rename(from, to);
      } catch (error) {
        throw new VaultStorageError(`Failed to archive logs for ${date}`, "IO_ARCHIVE_ERROR", { cause: error });
      }
    }
  }

  private async listDirectories(target: string): Promise<string[]> {
    try {
      const entries = await fs.readdir(target, { withFileTypes: true });
      return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
    } catch {
      return [];
    }
  }

  private async listFiles(target: string, extension: string): Promise<string[]> {
    try {
      const entries = await fs.readdir(target, { withFileTypes: true });
      return entries.filter((entry) => entry.isFile() && entry.name.endsWith(extension)).map((entry) => entry.name);
    } catch {
      return [];
    }
  }

  private async readLogFile(filePath: string): Promise<VaultEvent[]> {
    const content = await fs.readFile(filePath, "utf8");
    const events: VaultEvent[] = [];
    for (const [index, line] of content.split("\n").entries()) {
      if (!line.trim()) {
        continue;
      }
      try {
        events.push(JSON.parse(line) as VaultEvent);
      } catch (error) {
        throw new VaultStorageError(`Malformed log event in ${filePath} at line ${index + 1}`, "LOG_PARSE_ERROR", {
          cause: error
        });
      }
    }
    return events;
  }

  private async atomicWriteFile(filePath: string, content: string): Promise<void> {
    const dirPath = path.dirname(filePath);
    const tempPath = path.join(
      dirPath,
      `.tmp-${path.basename(filePath)}-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`
    );
    try {
      await fs.mkdir(dirPath, { recursive: true });
      await fs.writeFile(tempPath, content, "utf8");
      await fs.rename(tempPath, filePath);
    } catch (error) {
      throw new VaultStorageError(`Failed to write file atomically: ${filePath}`, "IO_WRITE_ERROR", { cause: error });
    } finally {
      await fs.rm(tempPath, { force: true }).catch(() => undefined);
    }
  }

  private initializeIndexDb(): void {
    if (!this.indexDbPath || this.indexDb) {
      return;
    }
    this.indexDb = new DatabaseSync(this.indexDbPath);
    this.indexDb.exec(`
      CREATE TABLE IF NOT EXISTS index_entries (
        id TEXT PRIMARY KEY,
        session_id TEXT,
        type TEXT NOT NULL,
        tags_json TEXT NOT NULL,
        keywords_json TEXT NOT NULL,
        file TEXT NOT NULL,
        line INTEGER NOT NULL,
        timestamp TEXT NOT NULL
      );
    `);
  }

  private async syncIndexDbFromFile(): Promise<void> {
    if (!this.indexDb) {
      return;
    }
    const fileIndexPath = path.join(this.vaultRoot, "memory", "index.json");
    const raw = await fs.readFile(fileIndexPath, "utf8");
    const fileIndex = JSON.parse(raw) as VaultIndex;
    this.setIndexInDb(fileIndex);
  }

  private getIndexFromDb(): VaultIndex {
    if (!this.indexDb) {
      return { entries: [] };
    }
    const rows = this.indexDb
      .prepare(
        "SELECT id, session_id, type, tags_json, keywords_json, file, line, timestamp FROM index_entries ORDER BY timestamp ASC, id ASC"
      )
      .all() as Array<Record<string, unknown>>;
    return {
      entries: rows.map((row) => ({
        id: String(row.id),
        session_id: typeof row.session_id === "string" ? row.session_id : undefined,
        type: String(row.type) as VaultIndex["entries"][number]["type"],
        tags: JSON.parse(String(row.tags_json)) as string[],
        keywords: JSON.parse(String(row.keywords_json)) as string[],
        file: String(row.file),
        line: Number(row.line),
        timestamp: String(row.timestamp)
      }))
    };
  }

  private setIndexInDb(index: VaultIndex): void {
    if (!this.indexDb) {
      return;
    }
    this.indexDb.exec("BEGIN");
    try {
      this.indexDb.exec("DELETE FROM index_entries");
      const stmt = this.indexDb.prepare(
        "INSERT INTO index_entries (id, session_id, type, tags_json, keywords_json, file, line, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      );
      for (const entry of index.entries) {
        stmt.run(
          entry.id,
          entry.session_id ?? null,
          entry.type,
          JSON.stringify(entry.tags),
          JSON.stringify(entry.keywords),
          entry.file,
          entry.line,
          entry.timestamp
        );
      }
      this.indexDb.exec("COMMIT");
    } catch (error) {
      this.indexDb.exec("ROLLBACK");
      throw new VaultStorageError("Failed writing index database", "IO_WRITE_ERROR", { cause: error });
    }
  }

  private assertIndexParity(fileIndex: VaultIndex): void {
    const dbIndex = this.getIndexFromDb();
    const toSignature = (index: VaultIndex) => index.entries.map((entry) => `${entry.id}|${entry.timestamp}|${entry.type}`).sort();
    const fileSig = toSignature(fileIndex);
    const dbSig = toSignature(dbIndex);
    if (fileSig.length !== dbSig.length) {
      throw new VaultStorageError("Index parity mismatch between file and sqlite store", "IO_WRITE_ERROR");
    }
    for (let idx = 0; idx < fileSig.length; idx += 1) {
      if (fileSig[idx] !== dbSig[idx]) {
        throw new VaultStorageError("Index parity mismatch between file and sqlite store", "IO_WRITE_ERROR");
      }
    }
  }
}
