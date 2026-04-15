"use client";

import { useEffect, useState } from "react";
import type { TaskEntry } from "@session-vault/shared";
import { fetchTasks, saveTasks } from "../../lib/api";
import { SectionCard } from "../../components/SectionCard";

const STATUSES: TaskEntry["status"][] = ["open", "in_progress", "blocked", "done"];

export default function TasksPage() {
  const [tasks, setTasks] = useState<TaskEntry[]>([]);
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<TaskEntry["priority"]>("medium");
  const [sessionId, setSessionId] = useState("manual-ui");
  const [loading, setLoading] = useState(true);
  const [savingTaskId, setSavingTaskId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<"all" | TaskEntry["priority"]>("all");

  const loadTasks = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchTasks();
      setTasks(data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks().catch(() => {});
  }, []);

  const update = async (task: TaskEntry, status: TaskEntry["status"]) => {
    setMessage("");
    setError("");
    setSavingTaskId(task.task_id);
    const next = tasks.map((entry) =>
      entry.task_id === task.task_id ? { ...entry, status, updated_at: new Date().toISOString() } : entry
    );
    setTasks(next);
    try {
      const persisted = await saveTasks(next);
      setTasks(persisted);
      setMessage(`Updated "${task.title}" to ${status.replace("_", " ")}.`);
    } catch (saveError) {
      setTasks(tasks);
      setError(saveError instanceof Error ? saveError.message : "Failed to update task");
    } finally {
      setSavingTaskId("");
    }
  };

  const createTask = async () => {
    if (!title.trim()) {
      setError("Task title is required.");
      return;
    }
    setSubmitting(true);
    setMessage("");
    setError("");
    const now = new Date().toISOString();
    const newTask: TaskEntry = {
      task_id: crypto.randomUUID(),
      title: title.trim(),
      status: "open",
      priority,
      created_at: now,
      updated_at: now,
      source_session: sessionId.trim() || "manual-ui"
    };
    const next = [...tasks, newTask];
    setTasks(next);
    try {
      const persisted = await saveTasks(next);
      setTasks(persisted);
      setTitle("");
      setMessage("Task created.");
    } catch (saveError) {
      setTasks(tasks);
      setError(saveError instanceof Error ? saveError.message : "Failed to create task");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SectionCard title="Task Manager">
      <div className="mb-3 rounded bg-slate-950 p-3">
        <p className="mb-2 text-xs text-slate-400">Create Task</p>
        <div className="flex flex-wrap gap-2">
          <input
            className="min-w-64 flex-1 rounded bg-slate-900 px-2 py-1 text-slate-200"
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Task title"
            value={title}
          />
          <select className="rounded bg-slate-900 px-2 py-1 text-slate-200" onChange={(e) => setPriority(e.target.value as TaskEntry["priority"])} value={priority}>
            {["low", "medium", "high"].map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <input
            className="rounded bg-slate-900 px-2 py-1 text-slate-200"
            onChange={(e) => setSessionId(e.target.value)}
            placeholder="source_session"
            value={sessionId}
          />
          <button className="rounded bg-emerald-500 px-3 py-1 text-sm text-black disabled:opacity-60" disabled={submitting} onClick={() => createTask().catch(() => {})} type="button">
            {submitting ? "Creating..." : "Add task"}
          </button>
          <button className="rounded bg-slate-700 px-3 py-1 text-sm text-slate-100" onClick={() => loadTasks().catch(() => {})} type="button">
            Refresh
          </button>
          <select
            className="rounded bg-slate-900 px-2 py-1 text-slate-200"
            onChange={(e) => setPriorityFilter(e.target.value as "all" | TaskEntry["priority"])}
            value={priorityFilter}
          >
            <option value="all">all priorities</option>
            <option value="low">low</option>
            <option value="medium">medium</option>
            <option value="high">high</option>
          </select>
        </div>
      </div>
      {error ? <p className="mb-3 rounded bg-rose-950 p-2 text-sm text-rose-200">{error}</p> : null}
      {message ? <p className="mb-3 rounded bg-emerald-950 p-2 text-sm text-emerald-200">{message}</p> : null}
      {loading ? <p className="text-sm text-slate-400">Loading tasks...</p> : null}
      {!loading && tasks.length === 0 ? <p className="text-sm text-slate-400">No tasks found yet.</p> : null}
      <div className="grid gap-3 md:grid-cols-4">
        {STATUSES.map((status) => (
          <div className="rounded bg-slate-950 p-3" key={status}>
            <h3 className="mb-2 text-sm font-semibold uppercase text-slate-400">{status.replace("_", " ")}</h3>
            <ul className="space-y-2">
              {tasks
                .filter((task) => task.status === status)
                .filter((task) => priorityFilter === "all" || task.priority === priorityFilter)
                .map((task) => (
                  <li className="rounded border border-slate-800 p-2 text-sm" key={task.task_id}>
                    <p>{task.title}</p>
                    <p className="text-xs text-slate-500">
                      {task.source_session} | priority: {task.priority}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {STATUSES.map((nextStatus) => (
                        <button
                          className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-200 disabled:opacity-50"
                          disabled={savingTaskId === task.task_id}
                          key={nextStatus}
                          onClick={() => update(task, nextStatus).catch(() => {})}
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
  );
}
