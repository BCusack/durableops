import { drizzle } from "drizzle-orm/node-postgres";
import { desc, eq, ne } from "drizzle-orm";
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { Pool } from "pg";

export const ticketRoles = ["requester", "tech", "admin"] as const;
export type TicketRole = (typeof ticketRoles)[number];

export const ticketStatuses = [
  "submitted",
  "triage",
  "awaiting approval",
  "in progress",
  "resolved",
  "closed",
] as const;
export type TicketStatus = (typeof ticketStatuses)[number];

export const ticketCategories = ["standard", "sensitive", "high-impact"] as const;
export type TicketCategory = (typeof ticketCategories)[number];

export type Ticket = {
  id: string;
  userId: string;
  createdByRole: TicketRole;
  subject: string;
  description: string;
  priority: "low" | "medium" | "high";
  category: TicketCategory;
  status: TicketStatus;
  assignee?: string;
  reviewer?: string;
  notes?: string;
  approvalDecision?: "pending" | "approved" | "rejected";
  workflowRunId?: string;
  createdAt: string;
  updatedAt: string;
};

export const tickets = pgTable("durableops_tickets", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  createdByRole: text("created_by_role").$type<TicketRole>().notNull(),
  subject: text("subject").notNull(),
  description: text("description").notNull(),
  priority: text("priority").$type<Ticket["priority"]>().notNull(),
  category: text("category").$type<TicketCategory>().notNull(),
  status: text("status").$type<TicketStatus>().notNull(),
  assignee: text("assignee"),
  reviewer: text("reviewer"),
  notes: text("notes"),
  approvalDecision: text("approval_decision").$type<Ticket["approvalDecision"]>(),
  workflowRunId: text("workflow_run_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

const connectionString =
  process.env.WORKFLOW_POSTGRES_URL ??
  process.env.DATABASE_URL ??
  `postgresql://${process.env.POSTGRES_USER ?? "durableops"}:${process.env.POSTGRES_PASSWORD ?? "durableops"}@localhost:15432/${process.env.POSTGRES_DB ?? "durableops"}`;

const globalForDatabase = globalThis as typeof globalThis & { durableOpsTicketPool?: Pool };
const pool =
  globalForDatabase.durableOpsTicketPool ??
  new Pool({ connectionString, max: 5 });
const db = drizzle(pool);

if (process.env.NODE_ENV !== "production") {
  globalForDatabase.durableOpsTicketPool = pool;
}

function toTicket(row: typeof tickets.$inferSelect): Ticket {
  return {
    id: row.id,
    userId: row.userId,
    createdByRole: row.createdByRole,
    subject: row.subject,
    description: row.description,
    priority: row.priority,
    category: row.category,
    status: row.status,
    assignee: row.assignee ?? undefined,
    reviewer: row.reviewer ?? undefined,
    notes: row.notes ?? undefined,
    approvalDecision: row.approvalDecision ?? undefined,
    workflowRunId: row.workflowRunId ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const columns = {
  id: tickets.id,
  userId: tickets.userId,
  createdByRole: tickets.createdByRole,
  subject: tickets.subject,
  description: tickets.description,
  priority: tickets.priority,
  category: tickets.category,
  status: tickets.status,
  assignee: tickets.assignee,
  reviewer: tickets.reviewer,
  notes: tickets.notes,
  approvalDecision: tickets.approvalDecision,
  workflowRunId: tickets.workflowRunId,
  createdAt: tickets.createdAt,
  updatedAt: tickets.updatedAt,
};

export async function createTicket(ticket: Ticket) {
  const [row] = await db
    .insert(tickets)
    .values({
      id: ticket.id,
      userId: ticket.userId,
      createdByRole: ticket.createdByRole,
      subject: ticket.subject,
      description: ticket.description,
      priority: ticket.priority,
      category: ticket.category,
      status: ticket.status,
      assignee: ticket.assignee ?? null,
      reviewer: ticket.reviewer ?? null,
      notes: ticket.notes ?? null,
      approvalDecision: ticket.approvalDecision ?? null,
      workflowRunId: ticket.workflowRunId ?? null,
      createdAt: new Date(ticket.createdAt),
      updatedAt: new Date(ticket.updatedAt),
    })
    .returning();
  return toTicket(row);
}

export async function listTicketsForUser(userId: string, role: TicketRole) {
  const query = db.select(columns).from(tickets).orderBy(desc(tickets.updatedAt));
  const rows = role === "requester"
    ? await query.where(eq(tickets.userId, userId))
    : await query;
  return rows.map(toTicket);
}

export async function listAllTickets() {
  const rows = await db.select(columns).from(tickets).orderBy(desc(tickets.updatedAt));
  return rows.map(toTicket);
}

export async function getTicketById(id: string) {
  const [row] = await db.select(columns).from(tickets).where(eq(tickets.id, id)).limit(1);
  return row ? toTicket(row) : null;
}

export async function updateTicket(id: string, updates: Partial<Ticket>) {
  const values = {
    ...(updates.userId !== undefined ? { userId: updates.userId } : {}),
    ...(updates.createdByRole !== undefined ? { createdByRole: updates.createdByRole } : {}),
    ...(updates.subject !== undefined ? { subject: updates.subject } : {}),
    ...(updates.description !== undefined ? { description: updates.description } : {}),
    ...(updates.priority !== undefined ? { priority: updates.priority } : {}),
    ...(updates.category !== undefined ? { category: updates.category } : {}),
    ...(updates.status !== undefined ? { status: updates.status } : {}),
    ...(updates.assignee !== undefined ? { assignee: updates.assignee } : {}),
    ...(updates.reviewer !== undefined ? { reviewer: updates.reviewer } : {}),
    ...(updates.notes !== undefined ? { notes: updates.notes } : {}),
    ...(updates.approvalDecision !== undefined ? { approvalDecision: updates.approvalDecision } : {}),
    ...(updates.workflowRunId !== undefined ? { workflowRunId: updates.workflowRunId } : {}),
    ...(updates.createdAt !== undefined ? { createdAt: new Date(updates.createdAt) } : {}),
    updatedAt: new Date(updates.updatedAt ?? new Date().toISOString()),
  };
  const [row] = await db
    .update(tickets)
    .set(values)
    .where(eq(tickets.id, id))
    .returning();
  return row ? toTicket(row) : null;
}

export async function listTicketQueue() {
  const rows = await db
    .select(columns)
    .from(tickets)
    .where(ne(tickets.status, "closed"))
    .orderBy(desc(tickets.updatedAt));
  return rows.map(toTicket);
}
