import { describe, expect, it } from "vitest";
import { useUiStore } from "../store/ui";

describe("ui store", () => {
  it("tracks tab and filter state", () => {
    useUiStore.setState({
      tab: "overview",
      logsDate: "",
      logsType: "",
      memoryType: ""
    });
    useUiStore.getState().setTab("logs");
    useUiStore.getState().setLogsDate("2026-04-15");
    useUiStore.getState().setLogsType("fact");
    useUiStore.getState().setMemoryType("facts");

    const state = useUiStore.getState();
    expect(state.tab).toBe("logs");
    expect(state.logsDate).toBe("2026-04-15");
    expect(state.logsType).toBe("fact");
    expect(state.memoryType).toBe("facts");
  });
});
