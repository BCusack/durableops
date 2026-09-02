#!/usr/bin/env node

import { rm } from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";
import { loadProjectEnv } from "./lib/load-env.mjs";

await loadProjectEnv(process.cwd());

async function clean() {
  const rootDir = process.cwd();
  console.log("🧹 Cleaning demo data...");

  // 1. Clean Postgres ticket table
  const connectionString =
    process.env.WORKFLOW_POSTGRES_URL ??
    process.env.DATABASE_URL ??
    `postgresql://${process.env.POSTGRES_USER ?? "durableops"}:${process.env.POSTGRES_PASSWORD ?? "durableops"}@localhost:15432/${process.env.POSTGRES_DB ?? "durableops"}`;

  const pool = new Pool({ connectionString });
  try {
    await pool.query("TRUNCATE TABLE durableops_tickets CASCADE;");
    console.log("✓ Cleared database table: durableops_tickets");
  } catch {
    console.log("ℹ Could not truncate durableops_tickets (table may not exist yet).");
  } finally {
    await pool.end();
  }

  // 2. Remove local .durableops directory (auth.json, history.json)
  const durableOpsDir = path.join(rootDir, ".durableops");
  try {
    await rm(durableOpsDir, { recursive: true, force: true });
    console.log("✓ Cleared local auth and session storage (.durableops)");
  } catch {
    console.log("ℹ Local storage directory was already clean.");
  }

  console.log("\n✨ Demo environment cleaned!");
}

clean().catch((err) => {
  console.error("❌ Clean failed:", err);
  process.exit(1);
});
