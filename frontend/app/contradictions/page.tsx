"use client";

import { useEffect, useState } from "react";
import type { ContradictionEntry } from "@session-vault/shared";
import { fetchContradictions, resolveContradiction } from "../../lib/api";
import { SectionCard } from "../../components/SectionCard";

export default function ContradictionsPage() {
  const [rows, setRows] = useState<ContradictionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState("");
  const [resolution, setResolution] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const reload = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchContradictions();
      setRows(data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load contradictions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload().catch(() => {});
  }, []);

  return (
    <SectionCard title="Contradiction Center">
      <ul className="space-y-2 text-sm">
        {error ? <li className="rounded bg-rose-950 p-3 text-rose-200">{error}</li> : null}
        {message ? <li className="rounded bg-emerald-950 p-3 text-emerald-200">{message}</li> : null}
        {loading ? <li className="rounded bg-slate-950 p-3 text-slate-400">Loading contradictions...</li> : null}
        {!loading && rows.length === 0 ? <li className="rounded bg-slate-950 p-3 text-slate-400">No contradictions found.</li> : null}
        {rows.map((item) => (
          <li className="rounded bg-slate-950 p-3" key={item.contradiction_id}>
            <p className="text-emerald-300">{item.entity}</p>
            <p className="text-slate-300">
              current: {item.current_value} | conflicting: {item.conflicting_value}
            </p>
            <p className="text-xs text-slate-400">status: {item.status}</p>
            <p className="text-xs text-slate-500">sources: {item.sources.join(", ") || "none"}</p>
            {item.status === "active" ? (
              <div className="mt-2 flex flex-wrap gap-2">
                <input
                  className="min-w-64 flex-1 rounded bg-slate-900 px-2 py-1 text-xs text-slate-200"
                  onChange={(e) => setResolution((prev) => ({ ...prev, [item.contradiction_id]: e.target.value }))}
                  placeholder="Resolution note"
                  value={resolution[item.contradiction_id] ?? ""}
                />
                <button
                  className="rounded bg-emerald-500 px-3 py-1 text-xs text-black disabled:opacity-60"
                  disabled={resolvingId === item.contradiction_id}
                  onClick={async () => {
                    setError("");
                    setMessage("");
                    setResolvingId(item.contradiction_id);
                    try {
                      await resolveContradiction(item.contradiction_id, resolution[item.contradiction_id] || "Resolved from contradiction center");
                      setMessage(`Resolved contradiction ${item.contradiction_id}.`);
                      await reload();
                    } catch (resolveError) {
                      setError(resolveError instanceof Error ? resolveError.message : "Failed to resolve contradiction");
                    } finally {
                      setResolvingId("");
                    }
                  }}
                  type="button"
                >
                  {resolvingId === item.contradiction_id ? "Resolving..." : "Resolve"}
                </button>
              </div>
            ) : (
              <p className="mt-2 text-xs text-emerald-400">{item.resolution || "resolved"}</p>
            )}
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
