"use client";

import { useEffect, useMemo, useState } from "react";
import type { MemoryType } from "@session-vault/shared";
import { fetchMemory, saveMemory } from "../../lib/api";
import { SectionCard } from "../../components/SectionCard";

const TYPES: MemoryType[] = ["facts", "preferences", "decisions", "tasks", "contradictions"];

export default function MemoryPage() {
  const [type, setType] = useState<MemoryType>("facts");
  const [raw, setRaw] = useState("[]");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = async (selectedType: MemoryType) => {
    setLoading(true);
    setError("");
    try {
      const payload = await fetchMemory(selectedType);
      setRaw(JSON.stringify(payload[selectedType] ?? [], null, 2));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load memory");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload(type).catch(() => {});
  }, [type]);

  const save = async () => {
    try {
      const parsed = JSON.parse(raw) as unknown[];
      await saveMemory(type, parsed);
      setStatus("Saved");
      setError("");
    } catch (saveError) {
      setStatus("");
      setError(saveError instanceof Error ? saveError.message : "Invalid JSON or schema validation failed");
    }
  };

  const preview = useMemo(() => {
    try {
      const parsed = JSON.parse(raw) as Array<Record<string, unknown>>;
      return {
        entries: Array.isArray(parsed) ? parsed : [],
        error: ""
      };
    } catch {
      return {
        entries: [] as Array<Record<string, unknown>>,
        error: "Preview unavailable due to invalid JSON."
      };
    }
  }, [raw]);

  return (
    <SectionCard title="Memory Explorer">
      <div className="mb-2 flex flex-wrap gap-2">
        <select className="rounded bg-slate-950 px-2 py-1 text-slate-200" onChange={(e) => setType(e.target.value as MemoryType)} value={type}>
          {TYPES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <button className="rounded bg-emerald-500 px-3 py-1 text-sm text-black" onClick={() => reload(type).catch(() => {})} type="button">
          Reload
        </button>
        <button className="rounded bg-emerald-500 px-3 py-1 text-sm text-black" onClick={() => save().catch(() => {})} type="button">
          Save
        </button>
        <p className="text-xs text-slate-400">{status}</p>
      </div>
      {error ? <p className="mb-2 rounded bg-rose-950 p-2 text-sm text-rose-200">{error}</p> : null}
      {loading ? <p className="mb-2 text-sm text-slate-400">Loading memory...</p> : null}
      <p className="mb-2 text-xs text-slate-400">Inline editing enabled via JSON editor. Include sources and confidence fields to preserve traceability.</p>
      {preview.error ? <p className="mb-2 rounded bg-amber-950 p-2 text-xs text-amber-200">{preview.error}</p> : null}
      {!preview.error && preview.entries.length > 0 ? (
        <div className="mb-2 max-h-36 space-y-1 overflow-auto rounded bg-slate-950 p-2 text-xs text-slate-300">
          {preview.entries.slice(0, 5).map((entry, idx) => (
            <p key={String(entry.id ?? idx)}>
              {String(entry.title ?? entry.entity ?? "entry")} | confidence: {String(entry.confidence ?? "n/a")} | sources:{" "}
              {Array.isArray(entry.sources) && entry.sources.length > 0 ? entry.sources.join(", ") : "none"}
            </p>
          ))}
        </div>
      ) : null}
      <textarea
        className="min-h-[420px] w-full rounded bg-slate-950 p-3 font-mono text-xs text-slate-200"
        onChange={(e) => setRaw(e.target.value)}
        value={raw}
      />
    </SectionCard>
  );
}
