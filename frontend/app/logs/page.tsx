"use client";

import { useEffect, useState } from "react";
import type { VaultEvent } from "@session-vault/shared";
import { fetchLogs } from "../../lib/api";
import { SectionCard } from "../../components/SectionCard";

export default function LogsPage() {
  const [date, setDate] = useState("");
  const [type, setType] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [logs, setLogs] = useState<VaultEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = async () => {
    setLoading(true);
    setError("");
    try {
      const next = await fetchLogs({
        date: date || undefined,
        type: (type as VaultEvent["type"]) || undefined,
        session_id: sessionId || undefined
      });
      setLogs(next.slice(-100).reverse());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload().catch(() => {});
  }, []);

  return (
    <SectionCard title="Logs Viewer">
      <div className="mb-3 flex flex-wrap gap-2">
        <input className="rounded bg-slate-950 px-2 py-1 text-slate-200" onChange={(e) => setSessionId(e.target.value)} placeholder="session_id" value={sessionId} />
        <input className="rounded bg-slate-950 px-2 py-1 text-slate-200" onChange={(e) => setDate(e.target.value)} type="date" value={date} />
        <select className="rounded bg-slate-950 px-2 py-1 text-slate-200" onChange={(e) => setType(e.target.value)} value={type}>
          <option value="">all types</option>
          {["message", "summary", "fact", "preference", "decision", "task", "contradiction", "checkpoint"].map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <button className="rounded bg-emerald-500 px-3 py-1 text-sm text-black" onClick={() => reload().catch(() => {})} type="button">
          Apply
        </button>
      </div>
      <ul className="space-y-2 text-sm">
        {error ? <li className="rounded bg-rose-950 p-3 text-rose-200">{error}</li> : null}
        {loading ? <li className="rounded bg-slate-950 p-3 text-slate-400">Loading logs...</li> : null}
        {!loading && logs.length === 0 ? <li className="rounded bg-slate-950 p-3 text-slate-400">No logs match current filters.</li> : null}
        {logs.map((entry) => (
          <li className="rounded bg-slate-950 p-3" key={`${entry.event_id}-${entry.timestamp}`}>
            <p className="text-emerald-300">{entry.type}</p>
            <p className="text-slate-300">{entry.title}</p>
            <p className="text-xs text-slate-500">{entry.session_id}</p>
            <p className="text-xs text-slate-400">{entry.timestamp}</p>
            <details className="mt-2 text-xs">
              <summary className="cursor-pointer text-slate-400">Expand event JSON</summary>
              <pre className="mt-2 overflow-auto rounded bg-slate-900 p-2 text-slate-300">
                {JSON.stringify(entry, null, 2)}
              </pre>
            </details>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
