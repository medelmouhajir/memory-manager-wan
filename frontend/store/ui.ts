"use client";

import { create } from "zustand";

type Tab = "overview" | "logs" | "memory" | "tasks" | "contradictions";

interface UiStore {
  tab: Tab;
  logsDate: string;
  logsType: string;
  memoryType: string;
  setTab: (tab: Tab) => void;
  setLogsDate: (logsDate: string) => void;
  setLogsType: (logsType: string) => void;
  setMemoryType: (memoryType: string) => void;
}

export const useUiStore = create<UiStore>((set) => ({
  tab: "overview",
  logsDate: "",
  logsType: "",
  memoryType: "",
  setTab: (tab) => set({ tab }),
  setLogsDate: (logsDate) => set({ logsDate }),
  setLogsType: (logsType) => set({ logsType }),
  setMemoryType: (memoryType) => set({ memoryType })
}));
