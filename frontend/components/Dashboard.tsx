"use client";

import { useEffect, useState } from "react";
import type { ContradictionEntry, IndexEntry, TaskEntry, VaultEvent } from "@session-vault/shared";
import {
  fetchContradictions,
  fetchLogs,
  fetchMemory,
  fetchSnapshot,
  fetchTasks,
  resolveContradiction,
  saveTasks,
  searchMemoryWithFilters
} from "../lib/api";
import { useUiStore } from "../store/ui";
import { SectionCard } from "./SectionCard";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "logs", label: "Logs" },
  { id: "memory", label: "Memory" },
  { id: "tasks", label: "Tasks" },
  { id: "contradictions", label: "Contradictions" }
] as const;

export function Dashboard() {
  const { tab, setTab, logsDate, logsType, setLogsDate, setLogsType, memoryType, setMemoryType } = useUiStore();
  const [tasks, setTasks] = useState<TaskEntry[]>([]);
  const [snapshot, setSnapshot] = useState("Loading...");
  const [memoryResults, setMemoryResults] = useState<IndexEntry[]>([]);
  const [logs, setLogs] = useState<VaultEvent[]>([]);
  const [memory, setMemory] = useState<Record<string, unknown>>({});
  const [contradictions, setContradictions] = useState<ContradictionEntry[]>([]);
  const [loadingError, setLoadingError] = useState("");

  useEffect(() => {
    const load = async () => {
      const [taskData, snapshotData, searchData, logsData, memoryData, contradictionData] = await Promise.all([
        fetchTasks(),
        fetchSnapshot(),
        searchMemoryWithFilters({ q: "fact decision preference" }),
        fetchLogs(),
        fetchMemory(),
        fetchContradictions()
      ]);
      setTasks(taskData);
      setSnapshot(snapshotData);
      setMemoryResults(searchData.results.slice(0, 25));
      setLogs(logsData.slice(-50).reverse());
      setMemory(memoryData);
      setContradictions(contradictionData);
    };
    load().catch((error) => {
      setLoadingError(String(error));
    });
  }, []);

  const updateTaskStatus = async (task: TaskEntry, status: TaskEntry["status"]) => {
    const updatedTask: TaskEntry = { ...task, status, updated_at: new Date().toISOString() };
    const updatedTasks = tasks.map((item) => (item.task_id === task.task_id ? updatedTask : item));
    setTasks(updatedTasks);
    await saveTasks(updatedTasks);
  };

  const reloadLogs = async () => {
    const nextLogs = await fetchLogs({
      date: logsDate || undefined,
      type: (logsType as VaultEvent["type"]) || undefined
    });
    setLogs(nextLogs.slice(-100).reverse());
  };

  const reloadMemory = async () => {
    const memoryData = await fetchMemory(memoryType || undefined);
    setMemory(memoryData);
    const typeMap: Record<string, IndexEntry["type"]> = {
      facts: "fact",
      preferences: "preference",
      decisions: "decision",
      tasks: "task"
    };
    const searchData = await searchMemoryWithFilters({
      q: "fact decision preference task",
      type: memoryType ? typeMap[memoryType] : undefined
    });
    setMemoryResults(searchData.results.slice(0, 50));
  };

  const submitResolution = async (entry: ContradictionEntry) => {
    await resolveContradiction(entry.contradiction_id, "Resolved from dashboard");
    const refreshed = await fetchContradictions();
    setContradictions(refreshed);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {TABS.map((current) => (
          <button
            className={`rounded-md px-4 py-2 text-sm ${
              tab === current.id ? "bg-emerald-500 text-black" : "bg-slate-800 text-slate-200"
            }`}
            key={current.id}
            onClick={() => setTab(current.id)}
            type="button"
          >
            {current.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <SectionCard title="Overview Dashboard">
          <p className="text-slate-300">Open tasks: {tasks.filter((task) => task.status !== "done").length}</p>
          <p className="text-slate-300">Unresolved contradictions: {contradictions.filter((item) => item.status === "active").length}</p>
          {loadingError ? <p className="mt-2 text-sm text-rose-300">Failed to load dashboard data: {loadingError}</p> : null}
          <pre className="mt-3 whitespace-pre-wrap rounded bg-slate-950 p-3 text-xs text-slate-300">{snapshot}</pre>
        </SectionCard>
      )}

      {tab === "logs" && (
        <SectionCard title="Logs Viewer">
          <div className="mb-3 flex flex-wrap items-end gap-2">
            <label className="text-xs text-slate-400">
              Date
              <input
                className="ml-2 rounded bg-slate-950 px-2 py-1 text-slate-200"
                onChange={(event) => setLogsDate(event.target.value)}
                type="date"
                value={logsDate}
              />
            </label>
            <label className="text-xs text-slate-400">
              Type
              <select
                className="ml-2 rounded bg-slate-950 px-2 py-1 text-slate-200"
                onChange={(event) => setLogsType(event.target.value)}
                value={logsType}
              >
                <option value="">all</option>
                {["message", "summary", "fact", "preference", "decision", "task", "contradiction", "checkpoint"].map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <button className="rounded bg-emerald-500 px-3 py-1 text-sm text-black" onClick={() => reloadLogs().catch(() => {})} type="button">
              Apply
            </button>
          </div>
          <ul className="space-y-2 text-sm">
            {logs.map((entry) => (
              <li className="rounded bg-slate-950 p-3" key={`${entry.event_id}-${entry.timestamp}`}>
                <p className="text-emerald-300">{entry.type}</p>
                <p className="text-slate-300">{entry.title}</p>
                <p className="text-xs text-slate-400">{entry.timestamp}</p>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {tab === "memory" && (
        <SectionCard title="Memory Explorer">
          <div className="mb-3 flex flex-wrap items-end gap-2">
            <label className="text-xs text-slate-400">
              Type
              <select
                className="ml-2 rounded bg-slate-950 px-2 py-1 text-slate-200"
                onChange={(event) => setMemoryType(event.target.value)}
                value={memoryType}
              >
                <option value="">all</option>
                {["facts", "preferences", "decisions", "tasks", "contradictions"].map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <button className="rounded bg-emerald-500 px-3 py-1 text-sm text-black" onClick={() => reloadMemory().catch(() => {})} type="button">
              Apply
            </button>
          </div>
          <ul className="space-y-2 text-sm">
            {memoryResults.map((result) => (
              <li className="rounded bg-slate-950 p-3" key={result.id}>
                <p className="font-medium text-emerald-300">{result.type}</p>
                <p className="text-slate-300">{result.keywords.join(", ")}</p>
                <p className="text-xs text-slate-500">{result.tags.join(", ") || "no tags"}</p>
              </li>
            ))}
          </ul>
          <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap rounded bg-slate-950 p-3 text-xs text-slate-400">
            {JSON.stringify(memory, null, 2)}
          </pre>
        </SectionCard>
      )}

      {tab === "tasks" && (
        <SectionCard title="Task Manager">
          <div className="grid gap-3 md:grid-cols-4">
            {["open", "in_progress", "blocked", "done"].map((status) => (
              <div className="rounded bg-slate-950 p-3" key={status}>
                <h3 className="mb-2 text-sm font-semibold uppercase text-slate-400">{status.replace("_", " ")}</h3>
                <ul className="space-y-2">
                  {tasks
                    .filter((task) => task.status === status)
                    .map((task) => (
                      <li className="rounded border border-slate-800 p-2 text-sm" key={task.task_id}>
                        <p>{task.title}</p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {["open", "in_progress", "blocked", "done"].map((nextStatus) => (
                            <button
                              className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-200"
                              key={nextStatus}
                              onClick={() => updateTaskStatus(task, nextStatus as TaskEntry["status"]).catch(() => {})}
                              type="button"
                            >
                              {nextStatus}
                            </button>
                          ))}
                        </div>
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {tab === "contradictions" && (
        <SectionCard title="Contradiction Center">
          <ul className="space-y-2">
            {contradictions.map((item) => (
              <li className="rounded bg-slate-950 p-3 text-sm" key={item.contradiction_id}>
                <p className="text-emerald-300">{item.title || "Contradiction"}</p>
                <p className="text-slate-300">{item.content}</p>
                <p className="text-xs text-slate-400">status: {item.status}</p>
                <p className="text-xs text-slate-500">sources: {item.sources.join(", ") || "none"}</p>
                {item.status === "active" ? (
                  <button
                    className="mt-2 rounded bg-emerald-500 px-3 py-1 text-xs text-black"
                    onClick={() => submitResolution(item).catch(() => {})}
                    type="button"
                  >
                    Resolve
                  </button>
                ) : (
                  <p className="mt-2 text-xs text-emerald-400">{item.resolution || "resolved"}</p>
                )}
              </li>
            ))}
          </ul>
        </SectionCard>
      )}
    </div>
  );
}
