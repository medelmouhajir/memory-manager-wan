import { cp, mkdir } from "node:fs/promises";
import path from "node:path";

const source = process.env.VAULT_SOURCE ?? path.resolve(process.cwd(), "vault");
const backupsRoot = process.env.VAULT_BACKUPS_ROOT ?? path.resolve(process.cwd(), "vault-backups");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const destination = process.env.VAULT_BACKUP_DESTINATION ?? path.join(backupsRoot, `vault-${stamp}`);

await mkdir(backupsRoot, { recursive: true });
await cp(source, destination, { recursive: true, force: false, errorOnExist: true });

console.log(
  JSON.stringify({
    ok: true,
    action: "backup",
    source,
    destination,
    timestamp: new Date().toISOString()
  })
);
