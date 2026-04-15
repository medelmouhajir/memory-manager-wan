🧠 Session Vault — Full System Documentation
1. Overview

Session Vault is a persistent memory system for OpenClaw that:

Stores all session activity (logs, summaries, decisions, tasks, preferences)
Maintains structured long-term memory
Handles contradictions safely
Enables fast retrieval and clean session recovery
Provides a UI dashboard for inspection, debugging, and control
2. System Architecture
High-Level Components
[ OpenClaw Agent ]
        │
        ▼
[ Skill Layer (session-vault YAML) ]
        │
        ▼
[ Memory Engine API (Backend) ]
        │
 ┌──────┼──────────────┬──────────────┐
 ▼      ▼              ▼              ▼
Logs   Memory         Index        Snapshots
(NDJSON) (MD/JSON)    (JSON)       (MD)
        │
        ▼
[ Storage Layer (File System or DB) ]

        ▼
[ UI Dashboard (Frontend) ]
3. Tech Stack Recommendation
Backend
Node.js (TypeScript) or Python (FastAPI)
File-based storage (v1), optional DB later
Optional: SQLite for indexing
Optional: Vector DB (future phase)
Frontend
React + Next.js
TailwindCSS
Zustand or Redux for state
Monaco Editor (for file viewing/editing)
DevOps
Dockerized services
Local-first design
Optional cloud sync later
4. Storage Design
Directory Structure
/vault
  /logs/YYYY-MM-DD/<session-id>.ndjson
  /history/YYYY-MM-DD.md
  /memory/
      facts.md
      preferences.md
      decisions.md
      tasks.md
      contradictions.md
      index.json
  /snapshots/
      latest.md
      <session-id>.md
5. Data Models
5.1 Event Schema
{
  "event_id": "uuid",
  "session_id": "string",
  "timestamp": "ISO-8601",
  "type": "message | summary | fact | preference | decision | task | contradiction | checkpoint",
  "title": "string",
  "content": "string",
  "tags": ["string"],
  "sources": ["string"],
  "confidence": 0.0,
  "freshness": "low | medium | high",
  "status": "active | resolved | superseded"
}
5.2 Task Model
{
  "task_id": "uuid",
  "title": "string",
  "status": "open | in_progress | blocked | done",
  "priority": "low | medium | high",
  "created_at": "ISO",
  "updated_at": "ISO",
  "source_session": "string"
}
5.3 Decision Model
{
  "decision_id": "uuid",
  "title": "string",
  "decision": "string",
  "rationale": "string",
  "alternatives": ["string"],
  "status": "active | deprecated",
  "timestamp": "ISO"
}
5.4 Index Model
{
  "entries": [
    {
      "id": "uuid",
      "type": "fact | task | decision | preference",
      "tags": ["string"],
      "keywords": ["string"],
      "file": "path",
      "line": 0,
      "timestamp": "ISO"
    }
  ]
}
6. Backend API Specification
Base URL
/api/v1/vault
6.1 Append Event

POST /events

{
  "session_id": "string",
  "event": { ...EventSchema }
}

Behavior:

Append to NDJSON log
Update index (optional async)
6.2 Write Summary

POST /summary

{
  "session_id": "string",
  "summary": "string"
}
6.3 Update Memory

POST /memory

{
  "type": "facts | preferences | decisions | tasks | contradictions",
  "entries": [ ... ]
}
6.4 Get Snapshot

GET /snapshot/latest

Returns:

{
  "content": "string"
}
6.5 Build Snapshot

POST /snapshot/build

{
  "session_id": "string"
}
6.6 Search Memory

GET /search?q=...

Returns:

{
  "results": [ ... ]
}
6.7 Get Tasks

GET /tasks

6.8 Update Tasks

POST /tasks

6.9 Resolve Contradiction

POST /contradictions/resolve

6.10 Compaction

POST /compact

7. Core Engine Logic
7.1 Write Pipeline
Receive event
Validate schema
Append to log
Extract memory atoms
Update memory files
Update index
7.2 Conflict Detection

Trigger when:

Same entity + different values

Store both:

Add to contradictions.md
Mark with sources
7.3 Snapshot Builder

Aggregates:

Active tasks
Key decisions
Preferences
Critical facts

Outputs:

Clean startup context
7.4 Compaction Rules
Merge duplicate facts
Keep latest decisions active
Archive old logs
NEVER delete contradictions
8. UI Dashboard Specification
Pages
8.1 Overview Dashboard

Displays:

Active session
Recent activity
Open tasks
Recent decisions
8.2 Logs Viewer
Timeline view
Filter by session/date/type
Expand JSON events
8.3 Memory Explorer

Tabs:

Facts
Preferences
Decisions
Tasks
Contradictions

Features:

Inline editing
Source tracing
Confidence indicators
8.4 Task Manager
Kanban (Open / In Progress / Blocked / Done)
Priority filters
Link to sessions
8.5 Decision Tracker
Timeline of decisions
View rationale
Mark deprecated
8.6 Snapshot Viewer
View latest.md
Compare previous snapshots
Restore context
8.7 Search Interface
Full-text search
Filter by:
type
date
tags
Highlight matches
8.8 Contradiction Center
List unresolved conflicts
Show both sides
Resolve button
9. UI Components
Event Timeline
Memory Card
Task Card
Decision Panel
Snapshot Diff Viewer
Search Bar with filters
10. Security Rules
Redact secrets automatically:
API keys
tokens
passwords
No raw sensitive data in logs
11. Performance Considerations
NDJSON for append speed
Lazy index updates
Snapshot caching
Optional background compaction
12. Future Enhancements
Vector search (semantic retrieval)
Multi-user support
Cloud sync
Role-based access
AI-assisted summarization refinement
13. Deliverables

Developer must provide:

Backend
Fully working API
Storage engine
Compaction system
Conflict handler
Frontend
Full dashboard UI
Search + filters
Editable memory
Integration
OpenClaw-compatible endpoints
Skill integration support
14. Success Criteria

System is considered complete when:

Sessions restore perfectly after restart
No data loss across sessions
Tasks and decisions persist reliably
Contradictions are never silently lost
UI allows full inspection and control
Retrieval is fast and accurate
Final Note

This is not a “feature.”
This is a core memory infrastructure layer.

If built correctly, it becomes:

your second brain
your debugging system
your audit log
your decision history

15. Backend Operational Notes
Required Environment
PORT (optional, defaults to 4000)
VAULT_ROOT (optional, defaults to ../vault from backend cwd)
Storage Assumptions
File-based storage is authoritative for v1.
Mutable files (memory markdown, index, latest snapshot) use atomic replacement writes.
Malformed memory/log entries fail fast and return explicit server errors.
Recovery Assumptions
Snapshots are restorable from /snapshots/*.md.
latest.md is the active startup context pointer.
Compaction is safe to run repeatedly and should be treated as an idempotent maintenance task.

16. Production Readiness Verification Checklist
API write paths survive repeated writes without index drift.
Search results remain consistent after compaction and memory rewrites.
Contradiction history preserves active/resolved/superseded states.
Snapshot list/diff/restore flows return deterministic results.
Validation errors return 400 with issue details for malformed requests.
Corrupted persisted records fail loudly (no silent skipping of invalid lines).
Archive task moves logs older than retention window into history/archive.
Backend test suite is green before release candidate cut.

17. Deferred Next-Phase Backlog
DB-backed index store (SQLite or equivalent) for stronger query guarantees. (Implemented as optional SQLite mirror with parity checks.)
Structured observability (metrics + traces) across write/search/compaction operations. (Metrics route implemented; traces still deferred.)
Background job scheduler for compaction and archive cadence controls. (Interval scheduler implemented via `COMPACTION_INTERVAL_MS`.)
Role-based access controls and audit policy controls for multi-user deployment. (API key RBAC + audit logging implemented for backend API.)