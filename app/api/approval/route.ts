import { cookies } from "next/headers";
import { z } from "zod";
import { getUserFromSession, sessionCookieName } from "@/lib/auth-store";
import { getTicketById, listAllTickets, updateTicket } from "@/lib/ticket-store";
import { ticketApprovalHook } from "@/workflows/ticket-processing";

const schema = z.object({
  ticketId: z.string().min(1),
  approved: z.boolean(),
  reviewer: z.string().trim().min(1).optional(),
  reason: z.string().trim().max(500).default(""),
});

async function currentUser() {
  return getUserFromSession((await cookies()).get(sessionCookieName())?.value);
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ ok: false, message: "Authentication required" }, { status: 401 });

  try {
    const input = schema.parse(await request.json());
    const ticket = await getTicketById(input.ticketId);
    if (!ticket) return Response.json({ ok: false, message: "Ticket not found" }, { status: 404 });
    if (user.role === "requester") {
      return Response.json({ ok: false, message: "Only tech users can approve tickets" }, { status: 403 });
    }
    if (!ticket.workflowRunId) {
      return Response.json({ ok: false, message: "This ticket does not have a workflow run attached" }, { status: 400 });
    }

    await ticketApprovalHook.resume(ticket.workflowRunId, {
      approved: input.approved,
      reviewer: input.reviewer ?? user.username,
      reason: input.reason,
    });

    await updateTicket(ticket.id, {
      approvalDecision: input.approved ? "approved" : "rejected",
      reviewer: input.reviewer ?? user.username,
      notes: input.reason || (input.approved ? "Approved by support review." : "Rejected by support review."),
      status: input.approved ? "in progress" : "closed",
      updatedAt: new Date().toISOString(),
    });

    return Response.json({ ok: true, decision: input.approved ? "approved" : "rejected", queue: await listAllTickets() });
  } catch (error) {
    return Response.json({ ok: false, message: error instanceof Error ? error.message : "Approval failed" }, { status: 400 });
  }
}
