import type { ContradictionEntry, IndexEntry, MemoryType, SnapshotSummary, TaskEntry, VaultEvent } from "@session-vault/shared";

const API_BASE = process.env.NEXT_PUBLIC_VAULT_API_BASE ?? "http://localhost:4000/api/v1/vault";
const API_ORIGIN = API_BASE.replace(/\/api\/v1\/vault$/, "");
const API_KEY = process.env.NEXT_PUBLIC_VAULT_API_KEY ?? "";

export class APIError extends Error {
  status: number;
  code?: string;
  details?: unknown;

  constructor(status: number, message: string, options?: { code?: string; details?: unknown }) {
    super(message);
    this.status = status;
    this.name = "APIError";
    this.code = options?.code;
    this.details = options?.details;
  }
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(API_KEY ? { "x-api-key": API_KEY } : {}),
      ...(init?.headers ?? {})
    },
    cache: "no-store"
  });
  if (!response.ok) {
    let message = `API request failed: ${response.status}`;
    let code: string | undefined;
    let details: unknown;
    try {
      const errorData = (await response.json()) as { code?: string; error?: string; details?: unknown };
      code = errorData.code;
      details = errorData.details;
      if (errorData.error) {
        message = errorData.error;
      }
    } catch {
      // Keep fallback message if response is not JSON.
    }
    throw new APIError(response.status, message, { code, details });
  }
  return (await response.json()) as T;
}

export async function fetchTasks(): Promise<TaskEntry[]> {
  const data = await apiRequest<{ tasks: TaskEntry[] }>("/tasks");
  return data.tasks;
}

export async function saveTasks(tasks: TaskEntry[]): Promise<TaskEntry[]> {
  const data = await apiRequest<{ tasks: TaskEntry[] }>("/tasks", {
    method: "POST",
    body: JSON.stringify({ tasks })
  });
  return data.tasks;
}

export async function fetchSnapshot(): Promise<string> {
  const data = await apiRequest<{ content: string }>("/snapshot/latest");
  return data.content;
}

export async function searchMemory(query: string) {
  return apiRequest<{ results: Array<{ id: string; type: string; keywords: string[] }> }>(`/search?q=${encodeURIComponent(query)}`);
}

export interface SearchMemoryParams {
  q: string;
  type?: IndexEntry["type"];
  tag?: string;
  from?: string;
  to?: string;
  session_id?: string;
}

export function buildQueryString(params: Record<string, unknown>): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string" && value) {
      searchParams.set(key, value);
    }
  }
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

export async function searchMemoryWithFilters(params: SearchMemoryParams): Promise<{ results: IndexEntry[] }> {
  return apiRequest<{ results: IndexEntry[] }>(`/search${buildQueryString({ ...params })}`);
}

export async function fetchLogs(params?: {
  session_id?: string;
  date?: string;
  type?: VaultEvent["type"];
}): Promise<VaultEvent[]> {
  const data = await apiRequest<{ logs: VaultEvent[] }>(`/logs${buildQueryString(params ?? {})}`);
  return data.logs;
}

export async function fetchMemory(type?: string): Promise<Record<string, unknown>> {
  const data = await apiRequest<{ memory: Record<string, unknown> }>(`/memory${buildQueryString({ type })}`);
  return data.memory;
}

export async function saveMemory(type: MemoryType, entries: unknown[]): Promise<void> {
  await apiRequest<{ ok: boolean }>("/memory", {
    method: "POST",
    body: JSON.stringify({ type, entries })
  });
}

export async function fetchContradictions(): Promise<ContradictionEntry[]> {
  const data = await apiRequest<{ contradictions: ContradictionEntry[] }>("/contradictions");
  return data.contradictions;
}

export async function resolveContradiction(id: string, resolution: string): Promise<void> {
  await apiRequest<{ ok: boolean }>("/contradictions/resolve", {
    method: "POST",
    body: JSON.stringify({ id, resolution })
  });
}

export async function fetchSnapshots(): Promise<SnapshotSummary[]> {
  const data = await apiRequest<{ snapshots: SnapshotSummary[] }>("/snapshots");
  return data.snapshots;
}

export async function fetchSnapshotDiff(left: string, right: string): Promise<{ left: string; right: string; changed: boolean }> {
  return apiRequest<{ left: string; right: string; changed: boolean }>(
    `/snapshot/diff${buildQueryString({ left, right })}`
  );
}

export async function restoreSnapshot(id: string): Promise<void> {
  await apiRequest<{ ok: boolean }>("/snapshot/restore", {
    method: "POST",
    body: JSON.stringify({ id })
  });
}

export interface SystemHealth {
  ok: boolean;
  timestamp?: string;
  service?: string;
  env?: string;
}

export async function fetchSystemHealth(): Promise<SystemHealth> {
  const response = await fetch(`${API_ORIGIN}/health`, { cache: "no-store" });
  if (!response.ok) {
    throw new APIError(response.status, `Health check failed: ${response.status}`);
  }
  return (await response.json()) as SystemHealth;
}
