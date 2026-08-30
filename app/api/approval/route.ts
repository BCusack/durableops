import { z } from "zod";
import { buildDemoTimeline, upsertDemoRun } from "@/lib/demo-run-store";
import { customerApprovalHook } from "@/workflows/customer-onboarding";

const approvalSchema = z.object({
  runId: z.string().min(1),
  approved: z.boolean(),
  reviewer: z.string().min(1).default("ops-admin"),
  reason: z.string().optional().default(""),
});

export async function POST(request: Request) {
  try {
    const body = approvalSchema.parse(await request.json());

    await customerApprovalHook.resume(body.runId, {
      approved: body.approved,
      reviewer: body.reviewer,
      reason: body.reason,
    });

    const status = body.approved ? "approved" : "rejected";
    const completedAt = new Date().toISOString();

    await upsertDemoRun(body.runId, {
      status,
      phase: body.approved ? "approved" : "rejected",
      decision: body.approved ? "approved" : "rejected",
      approvalState: body.approved ? "approved" : "rejected",
      reviewer: body.reviewer,
      reason: body.reason,
      completedAt,
      summary: body.approved
        ? `Approved by ${body.reviewer}. Customer onboarding is finalized.`
        : `Rejected by ${body.reviewer}. Customer onboarding has been terminated.`,
      timeline: buildDemoTimeline({
        status,
        approvalState: body.approved ? "approved" : "rejected",
        reviewer: body.reviewer,
        reason: body.reason,
      }),
    });

    return Response.json({
      ok: true,
      runId: body.runId,
      decision: status,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not resume approval hook";

    return Response.json(
      {
        ok: false,
        message,
      },
      { status: 400 }
    );
  }
}
