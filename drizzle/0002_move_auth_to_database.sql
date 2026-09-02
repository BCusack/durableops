CREATE TABLE IF NOT EXISTS "durableops_users" (
  "id" text PRIMARY KEY,
  "username" text NOT NULL UNIQUE,
  "password_hash" text NOT NULL,
  "role" text NOT NULL CHECK ("role" IN ('requester', 'tech')),
  "created_at" timestamptz NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "durableops_sessions" (
  "token_hash" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "durableops_users"("id") ON DELETE CASCADE,
  "expires_at" timestamptz NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "durableops_sessions_expires_at_idx" ON "durableops_sessions" ("expires_at");
