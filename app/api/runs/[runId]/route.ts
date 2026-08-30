import { getRun } from "workflow/api";
import { buildDemoTimeline, getDemoRun, type DemoRunStatus } from "@/lib/demo-run-store";

function normalizeRunStatus(value: string | undefined): DemoRunStatus {
  if (!value) {
    return "created";
  }

  switch (value.toLowerCase()) {
    case "waiting":
    case "waiting-for-approval":
      return "waiting-for-approval";
    case "pending":
    case "created":
      return "created";
    case "running":
      return "running";
    case "completed":
      return "completed";
    case "approved":
      return "approved";
    case "rejected":
      return "rejected";
    case "failed":
      return "failed";
    case "cancelled":
      return "cancelled";
    default:
      return "created";
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;

  try {
    const run = getRun(runId);

    if (!(await run.exists)) {
      return Response.json(
        {
          ok: false,
          message: "Workflow run not found",
        },
        { status: 404 }
      );
    }

    const [status, workflowName, createdAt, startedAt, completedAt] = await Promise.all([
      run.status,
      run.workflowName,
      run.createdAt,
      run.startedAt,
      run.completedAt,
    ]);

    const persisted = await getDemoRun(runId);
    const runStatus = normalizeRunStatus(persisted?.status ?? status);
    const approvalState = persisted?.approvalState ?? "pending";
    const customer = persisted?.customer ?? {
      customerId: undefined,
      company: undefined,
      email: undefined,
      region: undefined,
      owner: undefined,
    };

    const record = {
      runId,
      workflowName: persisted?.workflowName ?? workflowName,
      phase: persisted?.phase ?? (runStatus === "waiting-for-approval" ? "awaiting-approval" : runStatus),
      decision: persisted?.decision ?? approvalState,
      status: runStatus,
      approvalState,
      customer,
      customerId: customer.customerId,
      company: customer.company,
      email: customer.email,
      region: customer.region,
      owner: customer.owner,
      reviewer: persisted?.reviewer,
      reason: persisted?.reason,
      summary: persisted?.summary ?? "Customer onboarding is being tracked in the durable workflow store.",
      createdAt: persisted?.createdAt ?? createdAt.toISOString(),
      startedAt: persisted?.startedAt ?? startedAt?.toISOString(),
      completedAt: persisted?.completedAt ?? completedAt?.toISOString(),
      timeline: persisted?.timeline?.length
        ? persisted.timeline
        : buildDemoTimeline({
            status: runStatus,
            approvalState,
            company: customer.company,
            reviewer: persisted?.reviewer,
            reason: persisted?.reason,
          }),
    };

    return Response.json({ ok: true, run: record });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Run lookup failed";

    return Response.json(
      {
        ok: false,
        message,
      },
      { status: 404 }
    );
  }
}
