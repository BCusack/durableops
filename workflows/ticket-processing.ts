import { defineHook, FatalError, getWorkflowMetadata, sleep } from "workflow";
import { z } from "zod";

export const ticketApprovalHook = defineHook({
  schema: z.object({
    approved: z.boolean(),
    reviewer: z.string().min(1),
    reason: z.string().optional().default(""),
  }),
});

export async function processSupportTicket(ticketId: string) {
  "use workflow";

  const ticket = await readTicket(ticketId);
  if (!ticket) {
    throw new FatalError(`Ticket ${ticketId} was not found.`);
  }

  await transitionStatus(ticketId, "triage", "Ticket has entered triage and is being evaluated by the support team.");
  await sleep("2s");

  const approvalRequired = ticket.category === "sensitive" || ticket.category === "high-impact" || ticket.priority === "high";

  if (approvalRequired) {
    await transitionStatus(ticketId, "awaiting approval", "Sensitive work requires managerial approval before the request can proceed.");
    const decision = await ticketApprovalHook.create({ token: getWorkflowMetadata().workflowRunId });

    if (!decision.approved) {
      await transitionStatus(
        ticketId,
        "closed",
        `Approval denied by ${decision.reviewer}${decision.reason ? `: ${decision.reason}` : "."}`,
        { reviewer: decision.reviewer, notes: decision.reason, approvalDecision: "rejected" }
      );
      return { ticketId, status: "closed", outcome: "rejected" };
    }

    await transitionStatus(
      ticketId,
      "in progress",
      `Approved by ${decision.reviewer}. Technical work is now in flight.`,
      { reviewer: decision.reviewer, notes: decision.reason, approvalDecision: "approved" }
    );
  } else {
    await transitionStatus(ticketId, "in progress", "Ticket accepted by the technical queue and work has started.");
  }

  await sleep("3s");
  await transitionStatus(ticketId, "resolved", "Operational response or fix has been prepared and paired with a follow-up.");
  await sleep("1s");
  await transitionStatus(ticketId, "closed", "Case closed and archived after technical resolution.");

  return {
    ticketId,
    status: "closed",
    outcome: "completed",
  };
}

async function readTicket(ticketId: string) {
  "use step";
  const { getTicketById } = await import("@/lib/ticket-store");
  return getTicketById(ticketId);
}

async function transitionStatus(
  ticketId: string,
  status: "triage" | "awaiting approval" | "in progress" | "resolved" | "closed",
  notes: string,
  seed: Partial<{
    reviewer: string;
    notes: string;
    approvalDecision: "pending" | "approved" | "rejected";
  }> = {}
) {
  "use step";

  const { reviewer, notes: extraNotes, approvalDecision } = seed;
  const { updateTicket } = await import("@/lib/ticket-store");

  await updateTicket(ticketId, {
    status,
    reviewer: reviewer ?? undefined,
    notes: extraNotes ?? notes,
    approvalDecision: approvalDecision ?? (status === "awaiting approval" ? "pending" : undefined),
    updatedAt: new Date().toISOString(),
  });
}
