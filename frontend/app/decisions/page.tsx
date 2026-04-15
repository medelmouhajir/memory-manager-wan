"use client";

import { useEffect, useState } from "react";
import { fetchMemory, saveMemory } from "../../lib/api";
import { SectionCard } from "../../components/SectionCard";

interface DecisionLike {
  id?: string;
  decision_id?: string;
  title?: string;
  decision?: string;
  rationale?: string;
  status?: string;
  timestamp?: string;
  content?: string;
}

export default function DecisionsPage() {
  const [decisions, setDecisions] = useState<DecisionLike[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const reload = () => {
    setLoading(true);
    setError("");
    setMessage("");
    return fetchMemory("decisions")
      .then((payload) => setDecisions((payload.decisions as DecisionLike[]) ?? []))
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Failed to load decisions"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reload().catch(() => {});
  }, []);

  const markDeprecated = async (targetId: string) => {
    setSavingId(targetId);
    setError("");
    setMessage("");
    try {
      const next = decisions.map((entry) => {
        const entryId = String(entry.decision_id ?? entry.id ?? "");
        if (entryId !== targetId) {
          return entry;
        }
        return {
          ...entry,
          status: "deprecated"
        };
      });
      await saveMemory("decisions", next);
      setDecisions(next);
      setMessage(`Marked ${targetId} as deprecated.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to update decision status");
      await reload();
    } finally {
      setSavingId("");
    }
  };

  return (
    <SectionCard title="Decision Tracker">
      <ul className="space-y-2 text-sm">
        {error ? <li className="rounded bg-rose-950 p-3 text-rose-200">{error}</li> : null}
        {message ? <li className="rounded bg-emerald-950 p-3 text-emerald-200">{message}</li> : null}
        {loading ? <li className="rounded bg-slate-950 p-3 text-slate-400">Loading decisions...</li> : null}
        {!loading && decisions.length === 0 ? <li className="rounded bg-slate-950 p-3 text-slate-400">No decisions found.</li> : null}
        {decisions.map((entry, idx) => (
          <li className="rounded bg-slate-950 p-3" key={`${entry.decision_id ?? entry.id ?? idx}`}>
            <p className="text-emerald-300">{entry.title ?? "Decision"}</p>
            <p className="text-slate-300">{entry.decision ?? entry.content ?? "-"}</p>
            <p className="text-xs text-slate-400">{entry.rationale ?? "No rationale provided."}</p>
            <p className="text-xs text-slate-500">
              {entry.status ?? "active"} | {entry.timestamp ?? "unknown time"}
            </p>
            {(entry.status ?? "active") !== "deprecated" ? (
              <button
                className="mt-2 rounded bg-slate-800 px-2 py-1 text-xs text-slate-200 disabled:opacity-50"
                disabled={savingId === String(entry.decision_id ?? entry.id ?? "")}
                onClick={() => markDeprecated(String(entry.decision_id ?? entry.id ?? "")).catch(() => {})}
                type="button"
              >
                {savingId === String(entry.decision_id ?? entry.id ?? "") ? "Updating..." : "Mark deprecated"}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
