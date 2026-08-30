import { cookies } from "next/headers";
import { z } from "zod";
import { getUserFromSession, sessionCookieName } from "@/lib/auth-store";
import { getTicketById, listAllTickets, updateTicket } from "@/lib/ticket-store";

const updateSchema = z
  .object({
    status: z.enum(["submitted", "triage", "awaiting approval", "in progress", "resolved", "closed"]).optional(),
    assignee: z.string().trim().max(64).optional(),
    notes: z.string().trim().max(500).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.status !== undefined && (!value.notes || value.notes.trim().length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["notes"],
        message: "A note is required whenever a status is updated.",
      });
    }
  });

async function currentUser() {
  return getUserFromSession((await cookies()).get(sessionCookieName())?.value);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return Response.json({ ok: false, message: "Authentication required" }, { status: 401 });

  const { id } = await params;
  const ticket = await getTicketById(id);
  if (!ticket) return Response.json({ ok: false, message: "Ticket not found" }, { status: 404 });

  if (user.role === "requester") {
    return Response.json({ ok: false, message: "Requesters can only view their own tickets" }, { status: 403 });
  }

  try {
    const input = updateSchema.parse(await request.json());
    const updated = await updateTicket(id, {
      ...input,
      updatedAt: new Date().toISOString(),
    });

    if (!updated) {
      return Response.json({ ok: false, message: "Ticket update failed" }, { status: 404 });
    }

    return Response.json({ ok: true, ticket: updated, queue: await listAllTickets() });
  } catch (error) {
    return Response.json({ ok: false, message: error instanceof Error ? error.message : "Ticket update failed" }, { status: 400 });
  }
}
