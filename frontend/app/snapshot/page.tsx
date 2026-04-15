"use client";

import { useEffect, useState } from "react";
import type { SnapshotSummary } from "@session-vault/shared";
import { fetchSnapshot, fetchSnapshotDiff, fetchSnapshots, restoreSnapshot } from "../../lib/api";
import { SectionCard } from "../../components/SectionCard";

export default function SnapshotPage() {
  const [latest, setLatest] = useState("");
  const [snapshots, setSnapshots] = useState<SnapshotSummary[]>([]);
  const [leftId, setLeftId] = useState("");
  const [rightId, setRightId] = useState("");
  const [diff, setDiff] = useState<{ left: string; right: string; changed: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [diffing, setDiffing] = useState(false);
  const [restoringId, setRestoringId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const reload = async () => {
    setLoading(true);
    setError("");
    try {
      const [latestData, snapshotData] = await Promise.all([fetchSnapshot(), fetchSnapshots()]);
      setLatest(latestData);
      setSnapshots(snapshotData);
      if (!leftId && snapshotData[0]) {
        setLeftId(snapshotData[0].id);
      }
      if (!rightId && snapshotData[1]) {
        setRightId(snapshotData[1].id);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load snapshots");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload().catch(() => {});
  }, []);

  const runDiff = async () => {
    if (!leftId || !rightId) {
      setError("Select both snapshots to compare.");
      return;
    }
    setDiffing(true);
    setError("");
    try {
      const result = await fetchSnapshotDiff(leftId, rightId);
      setDiff(result);
    } catch (diffError) {
      setError(diffError instanceof Error ? diffError.message : "Failed to compare snapshots");
    } finally {
      setDiffing(false);
    }
  };

  return (
    <SectionCard title="Snapshot Viewer">
      {error ? <p className="mb-3 rounded bg-rose-950 p-2 text-sm text-rose-200">{error}</p> : null}
      {message ? <p className="mb-3 rounded bg-emerald-950 p-2 text-sm text-emerald-200">{message}</p> : null}
      {loading ? <p className="mb-3 text-sm text-slate-400">Loading snapshots...</p> : null}
      {!loading && !latest ? <p className="mb-3 text-sm text-slate-400">No latest snapshot content available.</p> : null}
      <pre className="mb-3 max-h-52 overflow-auto whitespace-pre-wrap rounded bg-slate-950 p-3 text-xs text-slate-300">{latest}</pre>
      <div className="mb-3 flex flex-wrap gap-2">
        <select className="rounded bg-slate-950 px-2 py-1 text-slate-200" onChange={(e) => setLeftId(e.target.value)} value={leftId}>
          <option value="">left snapshot</option>
          {snapshots.map((item) => (
            <option key={item.id} value={item.id}>
              {item.id}
            </option>
          ))}
        </select>
        <select className="rounded bg-slate-950 px-2 py-1 text-slate-200" onChange={(e) => setRightId(e.target.value)} value={rightId}>
          <option value="">right snapshot</option>
          {snapshots.map((item) => (
            <option key={item.id} value={item.id}>
              {item.id}
            </option>
          ))}
        </select>
        <button className="rounded bg-emerald-500 px-3 py-1 text-sm text-black disabled:opacity-60" disabled={diffing} onClick={() => runDiff().catch(() => {})} type="button">
          {diffing ? "Comparing..." : "Compare"}
        </button>
      </div>
      {diff ? (
        <div className="grid gap-3 md:grid-cols-2">
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded bg-slate-950 p-3 text-xs text-slate-300">{diff.left}</pre>
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded bg-slate-950 p-3 text-xs text-slate-300">{diff.right}</pre>
          <p className="text-xs text-slate-400">changed: {String(diff.changed)}</p>
        </div>
      ) : null}
      <ul className="mt-3 space-y-2 text-sm">
        {!loading && snapshots.length === 0 ? <li className="rounded bg-slate-950 p-3 text-slate-400">No snapshots found yet.</li> : null}
        {snapshots.map((item) => (
          <li className="rounded bg-slate-950 p-3" key={item.id}>
            <p className="text-slate-300">{item.id}</p>
            <p className="text-xs text-slate-500">{item.created_at}</p>
            <button
              className="mt-2 rounded bg-emerald-500 px-2 py-1 text-xs text-black disabled:opacity-60"
              disabled={restoringId === item.id}
              onClick={async () => {
                setError("");
                setMessage("");
                setRestoringId(item.id);
                try {
                  await restoreSnapshot(item.id);
                  setMessage(`Restored ${item.id} as latest snapshot.`);
                  await reload();
                } catch (restoreError) {
                  setError(restoreError instanceof Error ? restoreError.message : "Failed to restore snapshot");
                } finally {
                  setRestoringId("");
                }
              }}
              type="button"
            >
              {restoringId === item.id ? "Restoring..." : "Restore latest"}
            </button>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
