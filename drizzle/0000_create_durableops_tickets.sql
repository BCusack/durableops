CREATE TABLE IF NOT EXISTS "durableops_tickets" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL,
  "created_by_role" text NOT NULL CHECK ("created_by_role" IN ('requester', 'tech', 'admin')),
  "subject" text NOT NULL,
  "description" text NOT NULL,
  "priority" text NOT NULL CHECK ("priority" IN ('low', 'medium', 'high')),
  "category" text NOT NULL CHECK ("category" IN ('standard', 'sensitive', 'high-impact')),
  "status" text NOT NULL CHECK ("status" IN ('submitted', 'triage', 'awaiting approval', 'in progress', 'resolved', 'closed')),
  "assignee" text,
  "reviewer" text,
  "notes" text,
  "approval_decision" text CHECK ("approval_decision" IN ('pending', 'approved', 'rejected')),
  "workflow_run_id" text,
  "created_at" timestamptz NOT NULL,
  "updated_at" timestamptz NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "durableops_tickets_user_id_idx" ON "durableops_tickets" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "durableops_tickets_updated_at_idx" ON "durableops_tickets" ("updated_at" DESC);
