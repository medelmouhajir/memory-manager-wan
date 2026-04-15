import { cp, rm } from "node:fs/promises";
import path from "node:path";

const source = process.env.VAULT_RESTORE_SOURCE;
if (!source) {
  throw new Error("VAULT_RESTORE_SOURCE is required");
}

const destination = process.env.VAULT_RESTORE_DESTINATION ?? path.resolve(process.cwd(), "vault");
await rm(destination, { recursive: true, force: true });
await cp(source, destination, { recursive: true });

console.log(
  JSON.stringify({
    ok: true,
    action: "restore",
    source,
    destination,
    timestamp: new Date().toISOString()
  })
);
