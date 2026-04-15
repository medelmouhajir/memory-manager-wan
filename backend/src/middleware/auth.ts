import type { NextFunction, Request, Response } from "express";

export type VaultRole = "reader" | "operator" | "admin";

const roleRank: Record<VaultRole, number> = {
  reader: 1,
  operator: 2,
  admin: 3
};

declare global {
  namespace Express {
    interface Request {
      vaultRole?: VaultRole;
      vaultApiKeyId?: string;
    }
  }
}

export function createAuthMiddleware(options: {
  enabled: boolean;
  apiKeys: { admin?: string; operator?: string; reader?: string };
}) {
  if (!options.enabled) {
    return (_req: Request, _res: Response, next: NextFunction): void => {
      next();
    };
  }

  const keyToRole = new Map<string, VaultRole>();
  if (options.apiKeys.reader) {
    keyToRole.set(options.apiKeys.reader, "reader");
  }
  if (options.apiKeys.operator) {
    keyToRole.set(options.apiKeys.operator, "operator");
  }
  if (options.apiKeys.admin) {
    keyToRole.set(options.apiKeys.admin, "admin");
  }

  return (req: Request, res: Response, next: NextFunction): void => {
    const apiKey = req.header("x-api-key");
    if (!apiKey) {
      res.status(401).json({ code: "AUTH_REQUIRED", error: "Missing x-api-key header" });
      return;
    }
    const role = keyToRole.get(apiKey);
    if (!role) {
      res.status(403).json({ code: "AUTH_FORBIDDEN", error: "Invalid API key" });
      return;
    }
    req.vaultRole = role;
    req.vaultApiKeyId = `${role}:${apiKey.slice(0, 6)}`;
    next();
  };
}

export function requireRole(minRole: VaultRole) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const role = req.vaultRole ?? "admin";
    if (roleRank[role] < roleRank[minRole]) {
      res.status(403).json({
        code: "AUTH_FORBIDDEN",
        error: `Role ${role} cannot access this endpoint; requires ${minRole}`
      });
      return;
    }
    next();
  };
}
