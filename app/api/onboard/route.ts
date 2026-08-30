import { start } from "workflow/api";
import { buildDemoTimeline, upsertDemoRun } from "@/lib/demo-run-store";
import { handleCustomerOnboarding, onboardingSchema } from "@/workflows/customer-onboarding";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const payload = onboardingSchema.parse(body);

    const run = await start(handleCustomerOnboarding, [payload]);
    const startedAt = new Date().toISOString();

    await upsertDemoRun(run.runId, {
      workflowName: "customer-onboarding",
      phase: "awaiting-approval",
      decision: "pending",
      customer: {
        customerId: payload.customerId,
        company: payload.company,
        email: payload.email,
        region: payload.region,
        owner: payload.owner,
      },
      approvalState: "pending",
      status: "running",
      createdAt: startedAt,
      startedAt,
      summary: `Running compliance checks for ${payload.company}. Awaiting operations approval.`,
      timeline: buildDemoTimeline({
        status: "running",
        approvalState: "pending",
        company: payload.company,
      }),
    });

    return Response.json({
      ok: true,
      message: "Customer onboarding workflow started",
      runId: run.runId,
      status: "running",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown validation error";

    return Response.json(
      {
        ok: false,
        message,
      },
      { status: 400 }
    );
  }
}
