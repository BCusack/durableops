import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { start } from "workflow/api";
import { z } from "zod";
import { getUserFromSession, sessionCookieName } from "@/lib/auth-store";
import { createTicket, listAllTickets, listTicketsForUser } from "@/lib/ticket-store";
import { processSupportTicket } from "@/workflows/ticket-processing";

const schema = z.object({
  subject: z.string().trim().min(3).max(160),
  description: z.string().trim().min(10).max(4000),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  category: z.enum(["standard", "sensitive", "high-impact"]).default("standard"),
  assignee: z.string().trim().max(64).optional(),
});

async function currentUser() {
  return getUserFromSession((await cookies()).get(sessionCookieName())?.value);
}

export async function GET() {
  const user = await currentUser();
  if (!user) return Response.json({ ok: false, message: "Authentication required" }, { status: 401 });

  const tickets = user.role === "requester" ? await listTicketsForUser(user.id, user.role) : await listAllTickets();

  return Response.json({
    ok: true,
    role: user.role,
    tickets,
    queue: tickets,
  });
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ ok: false, message: "Authentication required" }, { status: 401 });

  try {
    const input = schema.parse(await request.json());
    const now = new Date().toISOString();
    const ticket = await createTicket({
      id: `tkt_${randomBytes(8).toString("hex")}`,
      userId: user.id,
      createdByRole: user.role,
      subject: input.subject,
      description: input.description,
      priority: input.priority,
      category: input.category,
      status: "submitted",
      assignee: input.assignee,
      approvalDecision: "pending",
      notes: "Ticket submitted and queued for triage.",
      createdAt: now,
      updatedAt: now,
    });

    try {
      const run = await start(processSupportTicket, [ticket.id]);
      const updated = await import("@/lib/ticket-store").then(({ updateTicket }) =>
        updateTicket(ticket.id, { workflowRunId: run.runId, updatedAt: new Date().toISOString() })
      );
      return Response.json({ ok: true, ticket: updated ?? ticket, warning: null }, { status: 201 });
    } catch {
      return Response.json({ ok: true, ticket, warning: "Ticket saved; workflow runtime is unavailable." }, { status: 201 });
    }
  } catch (error) {
    return Response.json({ ok: false, message: error instanceof Error ? error.message : "Invalid ticket input" }, { status: 400 });
  }
}
