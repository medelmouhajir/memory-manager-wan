import type { NextFunction, Request, Response } from "express";
import { VaultStorageError } from "../services/storage.js";
import { ZodError } from "zod";

export function errorMiddleware(error: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (error instanceof ZodError) {
    res.status(400).json({
      code: "VALIDATION_ERROR",
      error: "Validation error",
      details: error.issues
    });
    return;
  }

  if (error instanceof VaultStorageError) {
    res.status(500).json({
      code: error.code,
      error: error.message
    });
    return;
  }

  const message = error instanceof Error ? error.message : "Unknown error";
  res.status(500).json({
    code: "INTERNAL_ERROR",
    error: message
  });
}
