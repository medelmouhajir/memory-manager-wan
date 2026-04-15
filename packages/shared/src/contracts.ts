export type EventType =
  | "message"
  | "summary"
  | "fact"
  | "preference"
  | "decision"
  | "task"
  | "contradiction"
  | "checkpoint";

export type Freshness = "low" | "medium" | "high";
export type Status = "active" | "resolved" | "superseded";

export interface VaultEvent {
  event_id: string;
  session_id: string;
  timestamp: string;
  type: EventType;
  title: string;
  content: string;
  tags: string[];
  sources: string[];
  confidence: number;
  freshness: Freshness;
  status: Status;
}

export type TaskStatus = "open" | "in_progress" | "blocked" | "done";
export type Priority = "low" | "medium" | "high";

export interface TaskEntry {
  task_id: string;
  title: string;
  status: TaskStatus;
  priority: Priority;
  created_at: string;
  updated_at: string;
  source_session: string;
}

export type DecisionStatus = "active" | "deprecated";

export interface DecisionEntry {
  decision_id: string;
  title: string;
  decision: string;
  rationale: string;
  alternatives: string[];
  status: DecisionStatus;
  timestamp: string;
}

export interface IndexEntry {
  id: string;
  session_id?: string;
  type: "fact" | "task" | "decision" | "preference";
  tags: string[];
  keywords: string[];
  file: string;
  line: number;
  timestamp: string;
}

export interface VaultIndex {
  entries: IndexEntry[];
}

export type MemoryType = "facts" | "preferences" | "decisions" | "tasks" | "contradictions";

export interface MemoryRecord {
  id: string;
  title: string;
  content: string;
  session_id: string;
  timestamp: string;
  tags: string[];
  sources: string[];
  confidence: number;
  freshness: Freshness;
  status: Status;
}

export type ContradictionStatus = "active" | "resolved";

export interface ContradictionEntry {
  contradiction_id: string;
  event_id: string;
  entity: string;
  field: string;
  current_value: string;
  conflicting_value: string;
  current_fact_id: string;
  conflicting_fact_ids: string[];
  title: string;
  content: string;
  tags: string[];
  sources: string[];
  status: ContradictionStatus | "superseded";
  detected_at: string;
  superseded_at?: string;
  resolved_at?: string;
  resolution?: string;
}

export interface SearchFilters {
  q: string;
  type?: IndexEntry["type"];
  tag?: string;
  from?: string;
  to?: string;
  session_id?: string;
}

export interface LogsQuery {
  session_id?: string;
  date?: string;
  type?: EventType;
}

export interface SnapshotSummary {
  id: string;
  session_id: string;
  created_at: string;
  path: string;
}
