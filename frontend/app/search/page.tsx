"use client";

import { useState } from "react";
import type { IndexEntry } from "@session-vault/shared";
import { searchMemoryWithFilters } from "../../lib/api";
import { SectionCard } from "../../components/SectionCard";

export default function SearchPage() {
  const [q, setQ] = useState("fact");
  const [type, setType] = useState("");
  const [tag, setTag] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [results, setResults] = useState<IndexEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  const run = async () => {
    setLoading(true);
    setError("");
    setHasSearched(true);
    try {
      const response = await searchMemoryWithFilters({
        q,
        type: (type as IndexEntry["type"]) || undefined,
        tag: tag || undefined,
        from: from ? new Date(`${from}T00:00:00.000Z`).toISOString() : undefined,
        to: to ? new Date(`${to}T23:59:59.999Z`).toISOString() : undefined,
        session_id: sessionId || undefined
      });
      setResults(response.results);
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "Search failed");
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SectionCard title="Search Interface">
      <div className="mb-3 flex flex-wrap gap-2">
        <input className="rounded bg-slate-950 px-2 py-1 text-slate-200" onChange={(e) => setQ(e.target.value)} placeholder="query" value={q} />
        <select className="rounded bg-slate-950 px-2 py-1 text-slate-200" onChange={(e) => setType(e.target.value)} value={type}>
          <option value="">all types</option>
          {["fact", "task", "decision", "preference"].map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <input className="rounded bg-slate-950 px-2 py-1 text-slate-200" onChange={(e) => setTag(e.target.value)} placeholder="tag" value={tag} />
        <input className="rounded bg-slate-950 px-2 py-1 text-slate-200" onChange={(e) => setSessionId(e.target.value)} placeholder="session_id" value={sessionId} />
        <input className="rounded bg-slate-950 px-2 py-1 text-slate-200" onChange={(e) => setFrom(e.target.value)} type="date" value={from} />
        <input className="rounded bg-slate-950 px-2 py-1 text-slate-200" onChange={(e) => setTo(e.target.value)} type="date" value={to} />
        <button className="rounded bg-emerald-500 px-3 py-1 text-sm text-black" onClick={() => run().catch(() => {})} type="button">
          Search
        </button>
      </div>
      <ul className="space-y-2 text-sm">
        {error ? <li className="rounded bg-rose-950 p-3 text-rose-200">{error}</li> : null}
        {loading ? <li className="rounded bg-slate-950 p-3 text-slate-400">Searching...</li> : null}
        {hasSearched && !loading && results.length === 0 ? <li className="rounded bg-slate-950 p-3 text-slate-400">No search results.</li> : null}
        {results.map((item) => (
          <li className="rounded bg-slate-950 p-3" key={item.id}>
            <p className="text-emerald-300">{item.type}</p>
            <p className="text-slate-300">
              {item.keywords.map((keyword) => {
                const shouldHighlight = q
                  .toLowerCase()
                  .split(/\s+/)
                  .filter(Boolean)
                  .some((token) => keyword.toLowerCase().includes(token));
                return (
                  <span className={shouldHighlight ? "mr-1 rounded bg-emerald-900 px-1 text-emerald-200" : "mr-1"} key={`${item.id}-${keyword}`}>
                    {keyword}
                  </span>
                );
              })}
            </p>
            <p className="text-xs text-slate-500">{item.tags.join(", ") || "no tags"}</p>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
