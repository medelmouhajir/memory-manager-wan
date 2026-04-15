"use client";

import { useEffect, useState } from "react";
import { fetchLogs, fetchMemory, fetchSystemHealth } from "../lib/api";

export default function HomePage() {
  const [reachable, setReachable] = useState<boolean | null>(null);
  const [lastSuccessAt, setLastSuccessAt] = useState("");
  const [lastAttemptAt, setLastAttemptAt] = useState("");
  const [recentActivity, setRecentActivity] = useState<Array<{ id: string; title: string; timestamp: string }>>([]);
  const [recentDecisions, setRecentDecisions] = useState<Array<{ id: string; title: string; status: string }>>([]);

  useEffect(() => {
    let active = true;
    const check = async () => {
      setLastAttemptAt(new Date().toISOString());
      try {
        const health = await fetchSystemHealth();
        if (!active) {
          return;
        }
        setReachable(Boolean(health.ok));
        if (health.ok) {
          setLastSuccessAt(new Date().toISOString());
        }
        const [logs, memory] = await Promise.all([fetchLogs(), fetchMemory("decisions")]);
        if (!active) {
          return;
        }
        setRecentActivity(
          logs
            .slice(-5)
            .reverse()
            .map((entry) => ({
              id: entry.event_id,
              title: entry.title,
              timestamp: entry.timestamp
            }))
        );
        const decisions = ((memory.decisions as Array<Record<string, unknown>>) ?? []).slice(-5).reverse();
        setRecentDecisions(
          decisions.map((entry, idx) => ({
            id: String(entry.decision_id ?? entry.id ?? `decision-${idx}`),
            title: String(entry.title ?? entry.decision ?? "Decision"),
            status: String(entry.status ?? "active")
          }))
        );
      } catch {
        if (!active) {
          return;
        }
        setReachable(false);
      }
    };
    check().catch(() => undefined);
    const timer = setInterval(() => {
      check().catch(() => undefined);
    }, 30000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <h2 className="mb-3 text-lg font-semibold text-emerald-300">Overview Dashboard</h2>
      <p className="text-slate-300">
        Use the navigation tabs to inspect logs, manage memory, track tasks and decisions, resolve contradictions, and restore snapshots.
      </p>
      <div className="mt-4 rounded bg-slate-950 p-3 text-sm text-slate-300">
        <p className="font-semibold text-emerald-300">System Status</p>
        <p>API reachability: {reachable === null ? "checking..." : reachable ? "reachable" : "unreachable"}</p>
        <p>Last successful fetch: {lastSuccessAt ? new Date(lastSuccessAt).toLocaleString() : "none"}</p>
        <p>Last fetch attempt: {lastAttemptAt ? new Date(lastAttemptAt).toLocaleString() : "none"}</p>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded bg-slate-950 p-3 text-sm text-slate-300">
          <p className="mb-2 font-semibold text-emerald-300">Recent Activity</p>
          {recentActivity.length === 0 ? <p className="text-slate-400">No activity yet.</p> : null}
          <ul className="space-y-1">
            {recentActivity.map((entry) => (
              <li key={entry.id}>
                {entry.title} <span className="text-xs text-slate-500">({new Date(entry.timestamp).toLocaleString()})</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded bg-slate-950 p-3 text-sm text-slate-300">
          <p className="mb-2 font-semibold text-emerald-300">Recent Decisions</p>
          {recentDecisions.length === 0 ? <p className="text-slate-400">No decisions yet.</p> : null}
          <ul className="space-y-1">
            {recentDecisions.map((entry) => (
              <li key={entry.id}>
                {entry.title} <span className="text-xs text-slate-500">({entry.status})</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
