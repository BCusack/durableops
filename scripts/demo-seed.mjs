#!/usr/bin/env node
// Seeds demo accounts and support tickets for the DurableOps demo.
// Safe to re-run: existing demo accounts and tickets are left untouched
// and only missing demo data is created.

import path from "node:path";
import { loadProjectEnv } from "./lib/load-env.mjs";

const rootDir = process.cwd();
await loadProjectEnv(rootDir);

const { createUser } = await import(path.join(rootDir, "lib", "auth-store.ts"));
const { createTicket, listAllTickets } = await import(path.join(rootDir, "lib", "ticket-store.ts"));

const DEMO_PASSWORD = "demo-pass-123";

const demoUsers = [
  { username: "demo-requester", role: "requester" },
  { username: "demo-requester-2", role: "requester" },
  { username: "demo-tech", role: "tech" },
];

const demoTicketsByRequester = [
  {
    subject: "Cannot access shared reporting dashboard",
    description: "Getting a 403 error when opening the quarterly reporting dashboard since this morning.",
    priority: "medium",
    category: "standard",
    status: "submitted",
    notes: "Ticket submitted and queued for triage.",
  },
  {
    subject: "Request to export customer PII for audit",
    description: "Compliance needs a one-time export of customer contact records for the annual audit.",
    priority: "high",
    category: "sensitive",
    status: "awaiting approval",
    notes: "Flagged as sensitive; waiting for tech approval before export begins.",
    approvalDecision: "pending",
  },
  {
    subject: "Production billing job failing nightly",
    description: "The nightly billing reconciliation job has failed for the last three nights with a timeout.",
    priority: "high",
    category: "high-impact",
    status: "in progress",
    notes: "Approved for high-impact remediation; engineering is investigating the timeout.",
    approvalDecision: "approved",
    assignee: "demo-tech",
  },
  {
    subject: "Update office wifi guest password",
    description: "Please rotate the guest wifi password for the downtown office as scheduled.",
    priority: "low",
    category: "standard",
    status: "resolved",
    notes: "Password rotated and shared with office admin.",
    assignee: "demo-tech",
  },
];

async function ensureUser(username, role) {
  try {
    const user = await createUser(username, DEMO_PASSWORD, role);
    console.log(`Created demo user "${username}" (${role}).`);
    return user;
  } catch (error) {
    if (error instanceof Error && /already registered/i.test(error.message)) {
      console.log(`Demo user "${username}" already exists, skipping.`);
      return null;
    }
    throw error;
  }
}

async function main() {
  console.log("Seeding DurableOps demo data...\n");

  const createdUsers = {};
  for (const demoUser of demoUsers) {
    const created = await ensureUser(demoUser.username, demoUser.role);
    if (created) {
      createdUsers[demoUser.username] = created;
    }
  }

  const existingTickets = await listAllTickets();
  const primaryRequester = createdUsers["demo-requester"];

  if (!primaryRequester) {
    console.log(
      "\nSkipping ticket seeding because demo-requester already existed; re-run `npm run demo:clean` first if you want fresh demo tickets."
    );
  } else if (existingTickets.length > 0) {
    console.log(`\nFound ${existingTickets.length} existing ticket(s); skipping ticket seed to avoid duplicates.`);
  } else {
    let seeded = 0;
    for (const ticket of demoTicketsByRequester) {
      const now = new Date().toISOString();
      await createTicket({
        id: `tkt_demo_${seeded + 1}_${Math.random().toString(16).slice(2, 8)}`,
        userId: primaryRequester.id,
        createdByRole: "requester",
        subject: ticket.subject,
        description: ticket.description,
        priority: ticket.priority,
        category: ticket.category,
        status: ticket.status,
        assignee: ticket.assignee,
        notes: ticket.notes,
        approvalDecision: ticket.approvalDecision ?? "pending",
        createdAt: now,
        updatedAt: now,
      });
      seeded += 1;
    }
    console.log(`Seeded ${seeded} demo ticket(s) for demo-requester.`);
  }

  console.log("\nDemo logins:");
  console.log(`  requester: demo-requester / ${DEMO_PASSWORD}`);
  console.log(`  requester: demo-requester-2 / ${DEMO_PASSWORD}`);
  console.log(`  tech:      demo-tech / ${DEMO_PASSWORD}`);
  console.log("\nDone.");
  process.exit(0);
}

await main();
