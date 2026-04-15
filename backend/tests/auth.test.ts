import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

describe("auth and RBAC", () => {
  let baseUrl = "";
  let stopServer: (() => Promise<void>) | undefined;
  let vaultRoot = "";

  beforeAll(async () => {
    vaultRoot = await mkdtemp(path.join(os.tmpdir(), "vault-auth-"));
    process.env.VAULT_ROOT = vaultRoot;
    process.env.PORT = "0";
    process.env.AUTH_ENABLED = "true";
    process.env.VAULT_API_KEY_READER = "reader-key";
    process.env.VAULT_API_KEY_OPERATOR = "operator-key";
    process.env.VAULT_API_KEY_ADMIN = "admin-key";
    vi.resetModules();
    const { createApp } = await import("../src/app.js");
    const app = await createApp();
    await new Promise<void>((resolve) => {
      const server = app.listen(0, "127.0.0.1", () => {
        const address = server.address();
        if (!address || typeof address === "string") {
          throw new Error("Failed to bind auth test server");
        }
        baseUrl = `http://127.0.0.1:${address.port}/api/v1/vault`;
        stopServer = async () => {
          await new Promise<void>((done, reject) => {
            server.close((error) => (error ? reject(error) : done()));
          });
        };
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (stopServer) {
      await stopServer();
    }
    delete process.env.VAULT_ROOT;
    delete process.env.PORT;
    delete process.env.AUTH_ENABLED;
    delete process.env.VAULT_API_KEY_READER;
    delete process.env.VAULT_API_KEY_OPERATOR;
    delete process.env.VAULT_API_KEY_ADMIN;
    vi.resetModules();
    if (vaultRoot) {
      await rm(vaultRoot, { recursive: true, force: true });
    }
  });

  it("rejects requests without API key when auth is enabled", async () => {
    const response = await fetch(`${baseUrl}/tasks`);
    expect(response.status).toBe(401);
  });

  it("enforces role restrictions for admin-only operations", async () => {
    const response = await fetch(`${baseUrl}/compact`, {
      method: "POST",
      headers: {
        "x-api-key": "reader-key",
        "Content-Type": "application/json"
      },
      body: "{}"
    });
    expect(response.status).toBe(403);
  });
});
