import { z } from "zod";
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

    return Response.json({
      ok: true,
      runId: body.runId,
      decision: body.approved ? "approved" : "rejected",
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
