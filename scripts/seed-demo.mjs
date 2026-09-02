#!/usr/bin/env node

import path from "node:path";
import { loadProjectEnv } from "./lib/load-env.mjs";

await loadProjectEnv(process.cwd());

async function seed() {
  const rootDir = process.cwd();
  
  // 1. Seed demo users into auth store
  const { createUser, authenticate } = await import(path.join(rootDir, "lib", "auth-store.ts"));
  
  const seedUsers = [
    { username: "demorequester", password: "Requester123!", role: "requester" },
    { username: "demotech", password: "Tech123!", role: "tech" },
  ];

  const createdUserIds = {};

  for (const userSpec of seedUsers) {
    try {
      const created = await createUser(userSpec.username, userSpec.password, userSpec.role);
      createdUserIds[userSpec.username] = created.id;
      console.log(`✓ Seed user created: ${userSpec.username} (${userSpec.role})`);
    } catch (error) {
      if (error instanceof Error && error.message.includes("already registered")) {
        const authed = await authenticate(userSpec.username, userSpec.password);
        if (authed) {
          createdUserIds[userSpec.username] = authed.id;
        } else {
          // In case user exists with different password, try getting store directly or reuse ID format
          createdUserIds[userSpec.username] = `user_${userSpec.username}`;
        }
        console.log(`ℹ Seed user already exists: ${userSpec.username}`);
      } else {
        throw error;
      }
    }
  }

  // 2. Seed demo tickets into Postgres
  let existing = [];
  try {
    const { listAllTickets } = await import(path.join(rootDir, "lib", "ticket-store.ts"));
    existing = await listAllTickets();
  } catch {
    console.log("⚠️ Could not connect to Postgres database. Demo users seeded, but tickets skipped.");
    console.log("   Start Postgres with `npm run db:up` and run `npm run db:seed` again.");
    console.log("\n🎉 Demo auth users successfully seeded!");
    return;
  }

  if (existing.length > 0) {
    console.log(`ℹ Database already contains ${existing.length} ticket(s). Skipping ticket seeding.`);
    return;
  }

  const requesterId = createdUserIds["demorequester"] ?? "user_demorequester";
  const now = new Date();

  const sampleTickets = [
    {
      id: "tkt_demo_01",
      userId: requesterId,
      createdByRole: "requester",
      subject: "Database connection timeout during peak hours",
      description: "App pool latency spikes above 2000ms every day at 14:00 UTC. Need query performance analysis.",
      priority: "high",
      category: "sensitive",
      status: "awaiting approval",
      assignee: "demotech",
      notes: "High impact production database ticket queued for technical review.",
      approvalDecision: "pending",
      createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 3).toISOString(),
      updatedAt: new Date(now.getTime() - 1000 * 60 * 60 * 3).toISOString(),
    },
    {
      id: "tkt_demo_02",
      userId: requesterId,
      createdByRole: "requester",
      subject: "Requesting additional storage volume allocation",
      description: "Need an extra 200GB attached to worker node pool B for workflow execution state cache.",
      priority: "medium",
      category: "standard",
      status: "in progress",
      assignee: "demotech",
      notes: "Tech operator demotech has assigned this ticket and begun provision request.",
      createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 24).toISOString(),
      updatedAt: new Date(now.getTime() - 1000 * 60 * 60 * 2).toISOString(),
    },
    {
      id: "tkt_demo_03",
      userId: requesterId,
      createdByRole: "requester",
      subject: "SSL Certificate renewal for API gateway",
      description: "Wildcard certificate expires in 7 days. Need rotation completed across edge routers.",
      priority: "low",
      category: "standard",
      status: "resolved",
      assignee: "demotech",
      notes: "Certificate updated and verified across all edge ingress paths.",
      createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 48).toISOString(),
      updatedAt: new Date(now.getTime() - 1000 * 60 * 60 * 12).toISOString(),
    },
  ];

  for (const ticketSpec of sampleTickets) {
    await createTicket(ticketSpec);
    console.log(`✓ Seed ticket created: [${ticketSpec.status}] ${ticketSpec.subject}`);
  }

  console.log("\n🎉 Demo database successfully seeded!");
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
