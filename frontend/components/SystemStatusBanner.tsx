"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchSystemHealth } from "../lib/api";

interface StatusState {
  healthy: boolean;
  message: string;
  lastSuccessAt: string;
}

export function SystemStatusBanner() {
  const [state, setState] = useState<StatusState>({
    healthy: true,
    message: "Checking backend status...",
    lastSuccessAt: ""
  });

  useEffect(() => {
    let active = true;
    const check = async () => {
      try {
        const health = await fetchSystemHealth();
        if (!active) {
          return;
        }
        setState({
          healthy: Boolean(health.ok),
          message: health.ok ? "Backend reachable" : "Backend reported unhealthy",
          lastSuccessAt: new Date().toISOString()
        });
      } catch (error) {
        if (!active) {
          return;
        }
        setState((prev) => ({
          healthy: false,
          message: error instanceof Error ? error.message : "Backend unreachable",
          lastSuccessAt: prev.lastSuccessAt
        }));
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

  const lastSuccessLabel = useMemo(() => {
    if (!state.lastSuccessAt) {
      return "none";
    }
    return new Date(state.lastSuccessAt).toLocaleString();
  }, [state.lastSuccessAt]);

  if (state.healthy) {
    return (
      <div className="mb-4 rounded border border-emerald-900 bg-emerald-950/40 p-2 text-xs text-emerald-200">
        <span className="font-semibold">System status:</span> healthy. Last successful check: {lastSuccessLabel}.
      </div>
    );
  }

  return (
    <div className="mb-4 rounded border border-rose-900 bg-rose-950/50 p-2 text-xs text-rose-200">
      <span className="font-semibold">Degraded mode:</span> backend unreachable. Some dashboard actions may fail. Last successful check:{" "}
      {lastSuccessLabel}. Details: {state.message}
    </div>
  );
}
