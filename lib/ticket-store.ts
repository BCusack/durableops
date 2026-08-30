import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

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

const STORE_PATH = path.join(process.cwd(), ".durableops", "tickets.json");

async function readTickets(): Promise<Ticket[]> {
  await mkdir(path.dirname(STORE_PATH), { recursive: true });
  try {
    return JSON.parse(await readFile(STORE_PATH, "utf8")) as Ticket[];
  } catch {
    return [];
  }
}

async function writeTickets(tickets: Ticket[]) {
  await mkdir(path.dirname(STORE_PATH), { recursive: true });
  await writeFile(STORE_PATH, JSON.stringify(tickets, null, 2), "utf8");
}

export async function createTicket(ticket: Ticket) {
  const tickets = await readTickets();
  tickets.push(ticket);
  await writeTickets(tickets);
  return ticket;
}

export async function listTicketsForUser(userId: string, role: TicketRole) {
  const tickets = await readTickets();
  const visible = role === "requester" ? tickets.filter((ticket) => ticket.userId === userId) : tickets;
  return visible.sort((a, b) => new Date(b.updatedAt ?? b.createdAt).getTime() - new Date(a.updatedAt ?? a.createdAt).getTime());
}

export async function listAllTickets() {
  const tickets = await readTickets();
  return tickets.sort((a, b) => new Date(b.updatedAt ?? b.createdAt).getTime() - new Date(a.updatedAt ?? a.createdAt).getTime());
}

export async function getTicketById(id: string) {
  const tickets = await readTickets();
  return tickets.find((ticket) => ticket.id === id) ?? null;
}

export async function updateTicket(id: string, updates: Partial<Ticket>) {
  const tickets = await readTickets();
  const index = tickets.findIndex((ticket) => ticket.id === id);
  if (index < 0) return null;
  const next: Ticket = {
    ...tickets[index],
    ...updates,
    updatedAt: updates.updatedAt ?? new Date().toISOString(),
  };
  tickets[index] = next;
  await writeTickets(tickets);
  return next;
}

export async function listTicketQueue() {
  const tickets = await readTickets();
  return tickets
    .filter((ticket) => ticket.status !== "closed")
    .sort((a, b) => new Date(b.updatedAt ?? b.createdAt).getTime() - new Date(a.updatedAt ?? a.createdAt).getTime());
}
