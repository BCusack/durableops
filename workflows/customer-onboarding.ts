import { defineHook, FatalError, getWorkflowMetadata, sleep } from "workflow";
import { z } from "zod";

export const onboardingSchema = z.object({
  customerId: z.string().min(3),
  company: z.string().min(2),
  email: z.string().email(),
  region: z.string().min(2),
  owner: z.string().min(2).default("ops-admin"),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;

export const customerApprovalHook = defineHook({
  schema: z.object({
    approved: z.boolean(),
    reviewer: z.string().min(1),
    reason: z.string().optional().default(""),
  }),
});

export async function handleCustomerOnboarding(input: OnboardingInput) {
  "use workflow";

  const payload = onboardingSchema.parse(input);
  const { workflowRunId } = getWorkflowMetadata();

  const customer = await createCustomerRecord(payload);
  await validateCompliance(customer);

  await sleep("5s");

  const approvalToken = customerApprovalHook.create({ token: workflowRunId });
  const decision = await approvalToken;

  if (!decision.approved) {
    await recordRejection(customer.id, decision.reason || "No reason supplied");
    throw new FatalError(
      `Customer onboarding rejected for ${customer.email}: ${decision.reason || "No reason supplied"}`
    );
  }

  const finalResult = await finalizeOnboarding(customer.id, decision.reviewer);

  return {
    runId: workflowRunId,
    status: "approved",
    customerId: customer.id,
    company: customer.company,
    region: customer.region,
    environment: finalResult.environment,
    approvedBy: decision.reviewer,
  };
}

async function createCustomerRecord(input: OnboardingInput) {
  "use step";

  const customer = {
    id: `cust-${crypto.randomUUID().slice(0, 8)}`,
    customerId: input.customerId,
    company: input.company,
    email: input.email,
    region: input.region,
    owner: input.owner,
    createdAt: new Date().toISOString(),
  };

  console.log(`[workflow] created customer record`, customer);
  return customer;
}

async function validateCompliance(customer: {
  id: string;
  email: string;
  company: string;
  region: string;
}) {
  "use step";

  const checks = {
    emailValidated: customer.email.includes("@"),
    regionApproved: customer.region.length > 1,
    companyReady: customer.company.length > 1,
  };

  if (!checks.emailValidated || !checks.regionApproved || !checks.companyReady) {
    throw new FatalError(`Compliance validation failed for ${customer.id}`);
  }

  console.log(`[workflow] passed compliance checks`, checks);
}

async function recordRejection(customerId: string, reason: string) {
  "use step";

  console.log(`[workflow] rejected onboarding ${customerId}: ${reason}`);
}

async function finalizeOnboarding(customerId: string, reviewer: string) {
  "use step";

  const environment = "prod";
  console.log(`[workflow] finalized onboarding for ${customerId} by ${reviewer} in ${environment}`);

  return { environment };
}
