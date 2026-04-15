import { afterEach, describe, expect, it, vi } from "vitest";
import { APIError, buildQueryString, fetchSnapshotDiff, resolveContradiction, restoreSnapshot, searchMemoryWithFilters } from "../lib/api";

describe("buildQueryString", () => {
  it("serializes only defined values", () => {
    const query = buildQueryString({
      q: "memory facts",
      type: "fact",
      tag: "",
      from: undefined
    });

    expect(query).toBe("?q=memory+facts&type=fact");
  });

  it("includes session filter when provided", () => {
    const query = buildQueryString({
      q: "runtime",
      session_id: "session-1"
    });
    expect(query).toBe("?q=runtime&session_id=session-1");
  });

  it("includes optional date boundaries when provided", () => {
    const query = buildQueryString({
      q: "timeout",
      from: "2026-04-01T00:00:00.000Z",
      to: "2026-04-30T23:59:59.999Z"
    });
    expect(query).toBe("?q=timeout&from=2026-04-01T00%3A00%3A00.000Z&to=2026-04-30T23%3A59%3A59.999Z");
  });
});

describe("api client error handling", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("throws APIError with backend message", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ code: "VALIDATION_ERROR", error: "Validation error", details: [{ message: "bad payload" }] })
    } as Response);

    const failure = resolveContradiction("cid-1", "resolved");
    await expect(failure).rejects.toMatchObject({
      name: "APIError",
      status: 400,
      message: "Validation error"
    } satisfies Partial<APIError>);
    await expect(failure).rejects.toMatchObject({
      code: "VALIDATION_ERROR"
    });
  });

  it("serializes snapshot diff IDs into query string", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ left: "L", right: "R", changed: true })
    } as Response);

    await fetchSnapshotDiff("left-snapshot", "right-snapshot");
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "http://localhost:4000/api/v1/vault/snapshot/diff?left=left-snapshot&right=right-snapshot",
      expect.objectContaining({ cache: "no-store" })
    );
  });

  it("serializes search filters including from/to and session", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ results: [] })
    } as Response);

    await searchMemoryWithFilters({
      q: "timeout",
      type: "fact",
      tag: "network",
      from: "2026-04-01T00:00:00.000Z",
      to: "2026-04-30T23:59:59.999Z",
      session_id: "session-2"
    });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "http://localhost:4000/api/v1/vault/search?q=timeout&type=fact&tag=network&from=2026-04-01T00%3A00%3A00.000Z&to=2026-04-30T23%3A59%3A59.999Z&session_id=session-2",
      expect.objectContaining({ cache: "no-store" })
    );
  });

  it("calls snapshot restore endpoint with POST body", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ ok: true })
    } as Response);

    await restoreSnapshot("snapshot-1");
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "http://localhost:4000/api/v1/vault/snapshot/restore",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ id: "snapshot-1" })
      })
    );
  });
});
