import { randomUUID } from "node:crypto";
import type {
  ContradictionEntry,
  IndexEntry,
  MemoryRecord,
  MemoryType,
  SearchFilters,
  SnapshotSummary,
  TaskEntry,
  VaultEvent
} from "@session-vault/shared";
import { toKeywords } from "../lib/keywords.js";
import { redactSecrets } from "../lib/redaction.js";
import { VaultStorage } from "./storage.js";

export class VaultEngine {
  constructor(private readonly storage: VaultStorage) {}

  async appendEvent(event: VaultEvent): Promise<void> {
    const safeEvent = {
      ...event,
      title: redactSecrets(event.title),
      content: redactSecrets(event.content),
      sources: event.sources.map((source) => redactSecrets(source))
    };
    await this.storage.appendEvent(safeEvent.session_id, safeEvent);
    await this.extractToMemory(safeEvent);
    await this.updateIndex(safeEvent);
  }

  async writeSummary(sessionId: string, summary: string): Promise<void> {
    await this.storage.writeSummary(sessionId, redactSecrets(summary));
  }

  async updateMemory(type: MemoryType, entries: unknown[]): Promise<void> {
    await this.storage.writeMemory(type, entries);
    await this.rebuildIndexFromMemory();
  }

  async upsertTasks(tasks: TaskEntry[]): Promise<TaskEntry[]> {
    const existing = await this.storage.readTasks();
    const byId = new Map(existing.map((task) => [task.task_id, task]));
    for (const task of tasks) {
      byId.set(task.task_id, task);
    }
    const merged = Array.from(byId.values());
    await this.storage.writeTasks(merged);
    return merged;
  }

  async listTasks(): Promise<TaskEntry[]> {
    return this.storage.readTasks();
  }

  async buildSnapshot(sessionId: string): Promise<string> {
    const tasks = await this.storage.readTasks();
    const index = await this.storage.getIndex();
    const recentDecisions = index.entries.filter((entry) => entry.type === "decision").slice(-5);
    const criticalFacts = index.entries.filter((entry) => entry.type === "fact").slice(-5);
    const content = [
      `# Snapshot: ${sessionId}`,
      "",
      "## Active Tasks",
      ...tasks.filter((task) => task.status !== "done").map((task) => `- [${task.status}] ${task.title}`),
      "",
      "## Recent Decisions",
      ...recentDecisions.map((entry) => `- ${entry.keywords.join(" ")}`),
      "",
      "## Critical Facts",
      ...criticalFacts.map((entry) => `- ${entry.keywords.join(" ")}`),
      ""
    ].join("\n");
    await this.storage.writeSnapshot(sessionId, content);
    return content;
  }

  async getLatestSnapshot(): Promise<string> {
    return this.storage.getLatestSnapshot();
  }

  async search(query: string): Promise<IndexEntry[]> {
    const keywords = toKeywords(query);
    const index = await this.storage.getIndex();
    return index.entries.filter((entry) =>
      keywords.some((keyword) => entry.keywords.some((existing) => existing.includes(keyword)))
    );
  }

  async searchWithFilters(filters: SearchFilters): Promise<IndexEntry[]> {
    const keywords = toKeywords(filters.q);
    const index = await this.storage.getIndex();
    return index.entries.filter((entry) => {
      const keywordMatch =
        keywords.length === 0 ||
        keywords.some((keyword) => entry.keywords.some((existing) => existing.includes(keyword)));
      if (!keywordMatch) {
        return false;
      }
      if (filters.type && entry.type !== filters.type) {
        return false;
      }
      if (filters.tag && !entry.tags.includes(filters.tag)) {
        return false;
      }
      if (filters.from && entry.timestamp < filters.from) {
        return false;
      }
      if (filters.to && entry.timestamp > filters.to) {
        return false;
      }
      if (filters.session_id && entry.session_id !== filters.session_id) {
        return false;
      }
      return true;
    });
  }

  async listLogs(filters: { session_id?: string; date?: string; type?: VaultEvent["type"] }): Promise<VaultEvent[]> {
    return this.storage.listEvents(filters);
  }

  async listMemory(type?: MemoryType): Promise<Record<string, unknown>> {
    if (type) {
      const entries = await this.storage.readMemory(type);
      return { [type]: entries };
    }
    const [facts, preferences, decisions, tasks, contradictions] = await Promise.all([
      this.storage.readMemory("facts"),
      this.storage.readMemory("preferences"),
      this.storage.readMemory("decisions"),
      this.storage.readMemory("tasks"),
      this.storage.readMemory("contradictions")
    ]);
    return { facts, preferences, decisions, tasks, contradictions };
  }

  async listContradictions(): Promise<ContradictionEntry[]> {
    return this.storage.readContradictions();
  }

  async resolveContradiction(id: string, resolution: string): Promise<void> {
    const contradictions = await this.storage.readContradictions();
    const now = new Date().toISOString();
    const updated = contradictions.map((entry) => {
      if (entry.contradiction_id !== id) {
        return entry;
      }
      return {
        ...entry,
        status: "resolved" as const,
        resolution,
        resolved_at: now
      };
    });
    await this.storage.writeContradictions(updated);
  }

  async compact(): Promise<void> {
    await this.storage.compactMemory();
    await this.rebuildIndexFromMemory();
  }

  async listSnapshots(): Promise<SnapshotSummary[]> {
    return this.storage.listSnapshots();
  }

  async diffSnapshots(left: string, right: string): Promise<{ left: string; right: string; changed: boolean }> {
    const [leftContent, rightContent] = await Promise.all([this.storage.getSnapshotById(left), this.storage.getSnapshotById(right)]);
    return { left: leftContent, right: rightContent, changed: leftContent !== rightContent };
  }

  async restoreSnapshot(id: string): Promise<void> {
    await this.storage.restoreSnapshot(id);
  }

  private async extractToMemory(event: VaultEvent): Promise<void> {
    if (event.type === "task") {
      const task: TaskEntry = {
        task_id: event.event_id,
        title: event.title,
        status: "open",
        priority: "medium",
        created_at: event.timestamp,
        updated_at: event.timestamp,
        source_session: event.session_id
      };
      await this.upsertTasks([task]);
      return;
    }

    const typeMap: Partial<Record<VaultEvent["type"], MemoryType>> = {
      fact: "facts",
      preference: "preferences",
      decision: "decisions",
      contradiction: "contradictions"
    };
    const memoryType = typeMap[event.type];
    if (memoryType) {
      await this.storage.appendMemory(memoryType, {
        id: event.event_id,
        title: event.title,
        content: event.content,
        session_id: event.session_id,
        timestamp: event.timestamp,
        tags: event.tags,
        sources: event.sources,
        confidence: event.confidence,
        freshness: event.freshness,
        status: event.status
      });
      if (memoryType === "facts") {
        await this.detectFactContradictions(event);
      }
    }
  }

  private async updateIndex(event: VaultEvent): Promise<void> {
    const typeMap: Partial<Record<VaultEvent["type"], IndexEntry["type"]>> = {
      fact: "fact",
      task: "task",
      decision: "decision",
      preference: "preference"
    };
    const entryType = typeMap[event.type];
    if (!entryType) {
      return;
    }

    const index = await this.storage.getIndex();
    const entry: IndexEntry = {
      id: event.event_id,
      session_id: event.session_id,
      type: entryType,
      tags: event.tags,
      keywords: toKeywords(`${event.title} ${event.content}`),
      file: `memory/${entryType}s.md`,
      line: 0,
      timestamp: event.timestamp
    };
    index.entries = index.entries.filter((existing) => existing.id !== entry.id);
    index.entries.push(entry);
    await this.storage.setIndex(index);
  }

  private async detectFactContradictions(event: VaultEvent): Promise<void> {
    const factEntries = await this.storage.readMemory<MemoryRecord>("facts");
    const currentEntry = factEntries.find((item) => item.id === event.event_id);
    const [entity, value] = this.extractFactPair(currentEntry?.content ?? event.content);
    const matches = factEntries.filter((item) => {
      if (item.id === event.event_id) {
        return false;
      }
      const [existingEntity, existingValue] = this.extractFactPair(item.content);
      return existingEntity === entity && existingValue !== value;
    });
    if (matches.length === 0) {
      return;
    }
    const sortedMatches = [...matches].sort((left, right) => {
      const byTimestamp = left.timestamp.localeCompare(right.timestamp);
      if (byTimestamp !== 0) {
        return byTimestamp;
      }
      return left.id.localeCompare(right.id);
    });
    const [firstMatch] = sortedMatches;
    if (!firstMatch) {
      return;
    }
    const [, conflictingValue] = this.extractFactPair(firstMatch.content);
    const detectedAt = new Date().toISOString();
    const priorContradictions = await this.storage.readContradictions();
    const superseded = priorContradictions.map((entry) => {
      if (entry.entity !== entity || entry.status !== "active") {
        return entry;
      }
      return { ...entry, status: "superseded" as const, superseded_at: detectedAt };
    });
    await this.storage.writeContradictions(superseded);
    await this.storage.appendMemory("contradictions", {
      contradiction_id: randomUUID(),
      event_id: event.event_id,
      entity,
      field: entity,
      current_value: value,
      conflicting_value: conflictingValue,
      current_fact_id: event.event_id,
      conflicting_fact_ids: sortedMatches.map((entry) => entry.id),
      title: event.title,
      content: currentEntry?.content ?? event.content,
      tags: event.tags,
      sources: event.sources,
      status: "active",
      detected_at: detectedAt
    } satisfies ContradictionEntry);
  }

  private extractFactPair(content: string): [string, string] {
    const normalized = content.trim();
    if (!normalized) {
      return ["fact", ""];
    }
    if (normalized.includes("=")) {
      const [entity, ...rest] = normalized.split("=");
      return [entity.trim().toLowerCase(), rest.join("=").trim().toLowerCase()];
    }
    const tokens = normalized.split(/\s+/);
    return [tokens[0]?.toLowerCase() ?? "fact", tokens.slice(1).join(" ").toLowerCase()];
  }

  private async rebuildIndexFromMemory(): Promise<void> {
    const [facts, preferences, decisions, tasks] = await Promise.all([
      this.storage.readMemory<MemoryRecord>("facts"),
      this.storage.readMemory<MemoryRecord>("preferences"),
      this.storage.readMemory<Record<string, unknown>>("decisions"),
      this.storage.readTasks()
    ]);
    const entries: IndexEntry[] = [];
    for (const record of facts) {
      entries.push(this.toMemoryIndexEntry("fact", record));
    }
    for (const record of preferences) {
      entries.push(this.toMemoryIndexEntry("preference", record));
    }
    for (const record of decisions) {
      const id = this.readString(record.id) ?? this.readString(record.decision_id);
      const timestamp = this.readString(record.timestamp);
      const title = this.readString(record.title);
      const content = this.readString(record.content) ?? this.readString(record.decision);
      if (!id || !timestamp || !title || !content) {
        continue;
      }
      entries.push({
        id,
        session_id: this.readString(record.session_id),
        type: "decision",
        tags: this.readStringList(record.tags),
        keywords: toKeywords(`${title} ${content}`),
        file: "memory/decisions.md",
        line: 0,
        timestamp
      });
    }
    for (const task of tasks) {
      entries.push({
        id: task.task_id,
        session_id: task.source_session,
        type: "task",
        tags: [],
        keywords: toKeywords(task.title),
        file: "memory/tasks.md",
        line: 0,
        timestamp: task.updated_at
      });
    }
    const deduped = new Map<string, IndexEntry>();
    for (const entry of entries) {
      const existing = deduped.get(entry.id);
      if (!existing || existing.timestamp <= entry.timestamp) {
        deduped.set(entry.id, entry);
      }
    }
    const sorted = Array.from(deduped.values()).sort((left, right) => {
      const byTimestamp = left.timestamp.localeCompare(right.timestamp);
      if (byTimestamp !== 0) {
        return byTimestamp;
      }
      return left.id.localeCompare(right.id);
    });
    await this.storage.setIndex({ entries: sorted });
  }

  private toMemoryIndexEntry(type: IndexEntry["type"], record: MemoryRecord): IndexEntry {
    return {
      id: record.id,
      session_id: record.session_id,
      type,
      tags: record.tags,
      keywords: toKeywords(`${record.title} ${record.content}`),
      file: `memory/${type}s.md`,
      line: 0,
      timestamp: record.timestamp
    };
  }

  private readString(value: unknown): string | undefined {
    return typeof value === "string" && value.length > 0 ? value : undefined;
  }

  private readStringList(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return value.filter((item): item is string => typeof item === "string");
  }
}
