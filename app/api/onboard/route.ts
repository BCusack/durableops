import { start } from "workflow/api";
import { handleCustomerOnboarding, onboardingSchema } from "@/workflows/customer-onboarding";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const payload = onboardingSchema.parse(body);

    const run = await start(handleCustomerOnboarding, [payload]);

    return Response.json({
      ok: true,
      message: "Customer onboarding workflow started",
      runId: run.runId,
      status: run.status,
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
