import { z } from "zod";

const isoDate = z.string().datetime({ offset: true });

export const eventSchema = z.object({
  event_id: z.string().min(1).optional(),
  session_id: z.string().min(1),
  timestamp: isoDate,
  type: z.enum([
    "message",
    "summary",
    "fact",
    "preference",
    "decision",
    "task",
    "contradiction",
    "checkpoint"
  ]),
  title: z.string().min(1),
  content: z.string().min(1),
  tags: z.array(z.string()).default([]),
  sources: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1),
  freshness: z.enum(["low", "medium", "high"]),
  status: z.enum(["active", "resolved", "superseded"])
});

export const appendEventSchema = z.object({
  session_id: z.string().min(1),
  event: eventSchema
});

export const summarySchema = z.object({
  session_id: z.string().min(1),
  summary: z.string().min(1)
});

export const memorySchema = z.object({
  type: z.enum(["facts", "preferences", "decisions", "tasks", "contradictions"]),
  entries: z.array(z.unknown())
});

const memoryRecordSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  content: z.string().min(1),
  session_id: z.string().min(1),
  timestamp: isoDate,
  tags: z.array(z.string()).default([]),
  sources: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1),
  freshness: z.enum(["low", "medium", "high"]),
  status: z.enum(["active", "resolved", "superseded"])
});

const decisionEntrySchema = z.object({
  decision_id: z.string().min(1),
  title: z.string().min(1),
  decision: z.string().min(1),
  rationale: z.string().min(1),
  alternatives: z.array(z.string()),
  status: z.enum(["active", "deprecated"]),
  timestamp: isoDate
});

export const taskSchema = z.object({
  task_id: z.string().min(1),
  title: z.string().min(1),
  status: z.enum(["open", "in_progress", "blocked", "done"]),
  priority: z.enum(["low", "medium", "high"]),
  created_at: isoDate,
  updated_at: isoDate,
  source_session: z.string().min(1)
});

const contradictionSchema = z.object({
  contradiction_id: z.string().min(1),
  event_id: z.string().min(1),
  entity: z.string().min(1),
  field: z.string().min(1),
  current_value: z.string().min(1),
  conflicting_value: z.string().min(1),
  current_fact_id: z.string().min(1),
  conflicting_fact_ids: z.array(z.string().min(1)).min(1),
  title: z.string().min(1),
  content: z.string().min(1),
  tags: z.array(z.string()),
  sources: z.array(z.string()),
  status: z.enum(["active", "resolved", "superseded"]),
  detected_at: isoDate,
  superseded_at: isoDate.optional(),
  resolved_at: isoDate.optional(),
  resolution: z.string().min(1).optional()
});

export const strictMemorySchema = z
  .object({
    type: z.enum(["facts", "preferences", "decisions", "tasks", "contradictions"]),
    entries: z.array(z.unknown())
  })
  .superRefine((payload, ctx) => {
    const schemas = {
      facts: memoryRecordSchema,
      preferences: memoryRecordSchema,
      decisions: z.union([memoryRecordSchema, decisionEntrySchema]),
      tasks: taskSchema,
      contradictions: contradictionSchema
    } as const;
    const parser = schemas[payload.type];
    payload.entries.forEach((entry, idx) => {
      const parsed = parser.safeParse(entry);
      if (!parsed.success) {
        parsed.error.issues.forEach((issue) => {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `${payload.type}[${idx}]: ${issue.message}`,
            path: ["entries", idx, ...issue.path]
          });
        });
      }
    });
  });

export const taskUpsertSchema = z.object({
  tasks: z.array(taskSchema)
});

export const snapshotBuildSchema = z.object({
  session_id: z.string().min(1)
});

export const searchQuerySchema = z.object({
  q: z.string().min(1),
  type: z.enum(["fact", "task", "decision", "preference"]).optional(),
  tag: z.string().min(1).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  session_id: z.string().min(1).optional()
});

export const logsQuerySchema = z.object({
  session_id: z.string().min(1).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  type: z
    .enum(["message", "summary", "fact", "preference", "decision", "task", "contradiction", "checkpoint"])
    .optional()
});

export const memoryReadSchema = z.object({
  type: z.enum(["facts", "preferences", "decisions", "tasks", "contradictions"]).optional()
});

export const contradictionResolveSchema = z.object({
  id: z.string().min(1),
  resolution: z.string().min(1)
});

export const snapshotDiffSchema = z.object({
  left: z.string().min(1),
  right: z.string().min(1)
});

export const snapshotRestoreSchema = z.object({
  id: z.string().min(1)
});
