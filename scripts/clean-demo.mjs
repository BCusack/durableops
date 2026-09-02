#!/usr/bin/env node

import { Pool } from "pg";
import { loadProjectEnv } from "./lib/load-env.mjs";

await loadProjectEnv(process.cwd());

async function clean() {
  console.log("🧹 Cleaning demo data...");

  const connectionString =
    process.env.WORKFLOW_POSTGRES_URL ??
    process.env.DATABASE_URL ??
    `postgresql://${process.env.POSTGRES_USER ?? "durableops"}:${process.env.POSTGRES_PASSWORD ?? "durableops"}@localhost:15432/${process.env.POSTGRES_DB ?? "durableops"}`;

  const pool = new Pool({ connectionString });
  try {
    await pool.query("TRUNCATE TABLE durableops_tickets, durableops_sessions, durableops_users CASCADE;");
    console.log("✓ Cleared tickets, users, and sessions from Postgres");
  } catch {
    console.log("ℹ Could not clear demo tables (run `npm run db:migrate` first).");
  } finally {
    await pool.end();
  }

  console.log("\n✨ Demo environment cleaned!");
}

clean().catch((err) => {
  console.error("❌ Clean failed:", err);
  process.exit(1);
});
