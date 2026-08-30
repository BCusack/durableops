import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type DemoApprovalState = "pending" | "approved" | "rejected";
export type DemoRunStatus =
  | "created"
  | "running"
  | "waiting-for-approval"
  | "approved"
  | "rejected"
  | "failed"
  | "cancelled"
  | "completed";

export type DemoRunPhase =
  | "queued"
  | "validating"
  | "awaiting-approval"
  | "approved"
  | "rejected"
  | "failed"
  | "completed";

export type DemoTimelineEvent = {
  id: string;
  label: string;
  detail: string;
  timestamp: string;
  state: "complete" | "current" | "pending" | "error";
};

export type DemoAuditEvent = {
  id: string;
  type: "workflow" | "step" | "approval" | "error";
  message: string;
  timestamp: string;
};

export type DemoCustomerSnapshot = {
  customerId?: string;
  company?: string;
  email?: string;
  region?: string;
  owner?: string;
};

export type DemoRunRecord = {
  runId: string;
  workflowName: string;
  phase: DemoRunPhase;
  decision: DemoApprovalState;
  customer: DemoCustomerSnapshot;
  reviewer?: string;
  reason?: string;
  approvalState: DemoApprovalState;
  status: DemoRunStatus;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  summary?: string;
  timeline: DemoTimelineEvent[];
  audit: DemoAuditEvent[];
};

const STORE_PATH = path.join(process.cwd(), ".durableops", "workflow-runs.json");

function defaultTimeline(status: DemoRunStatus, approvalState: DemoApprovalState): DemoTimelineEvent[] {
  const now = new Date().toISOString();
  const steps: DemoTimelineEvent[] = [
    {
      id: "run-created",
      label: "Run created",
      detail: "Workflow queued and persisted to the self-hosted durable store.",
      timestamp: now,
      state: "complete",
    },
    {
      id: "customer-validated",
      label: "Customer validated",
      detail: "Customer data passed record validation and compliance checks.",
      timestamp: now,
      state: status === "failed" ? "error" : "complete",
    },
  ];

  if (status === "running" || status === "waiting-for-approval" || approvalState === "pending") {
    steps.push({
      id: "waiting-for-approval",
      label: "Waiting for approval",
      detail: "Operations review is deciding whether to approve or reject the onboarding request.",
      timestamp: now,
      state: "current",
    });
  }

  if (approvalState === "approved" || status === "approved" || status === "completed") {
    steps.push({
      id: "approved",
      label: "Approved",
      detail: "Approval granted. The workflow completed and the customer was admitted.",
      timestamp: now,
      state: "complete",
    });
  }

  if (approvalState === "rejected" || status === "rejected") {
    steps.push({
      id: "rejected",
      label: "Rejected",
      detail: "Approval denied. The workflow was terminated and the onboarding request stopped.",
      timestamp: now,
      state: "error",
    });
  }

  return steps;
}

function buildDefaultAudit(): DemoAuditEvent[] {
  const now = new Date().toISOString();
  return [
    { id: "audit-queued", type: "workflow", message: "Workflow queued for durable execution.", timestamp: now },
    { id: "audit-validated", type: "step", message: "Customer record validated for onboarding.", timestamp: now },
  ];
}

async function ensureStoreFile() {
  await mkdir(path.dirname(STORE_PATH), { recursive: true });

  try {
    await readFile(STORE_PATH, "utf8");
  } catch {
    await writeFile(STORE_PATH, JSON.stringify({}, null, 2), "utf8");
  }
}

export async function readDemoRuns(): Promise<Record<string, DemoRunRecord>> {
  await ensureStoreFile();

  try {
    const raw = await readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw || "{}") as Record<string, DemoRunRecord>;
    return parsed;
  } catch {
    return {};
  }
}

export async function getDemoRun(runId: string): Promise<DemoRunRecord | null> {
  const storedRuns = await readDemoRuns();
  return storedRuns[runId] ?? null;
}

export async function listDemoRuns(limit = 12): Promise<DemoRunRecord[]> {
  const storedRuns = await readDemoRuns();
  return Object.values(storedRuns)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, limit);
}

export async function upsertDemoRun(
  runId: string,
  updates: Partial<DemoRunRecord> & {
    workflowName?: string;
    customer?: DemoCustomerSnapshot;
    customerId?: string;
    company?: string;
    email?: string;
    region?: string;
    owner?: string;
    reviewer?: string;
    reason?: string;
    approvalState?: DemoApprovalState;
    status?: DemoRunStatus;
    phase?: DemoRunPhase;
    decision?: DemoApprovalState;
    createdAt?: string;
    startedAt?: string;
    completedAt?: string;
    summary?: string;
    timeline?: DemoTimelineEvent[];
    audit?: DemoAuditEvent[];
  }
): Promise<DemoRunRecord> {
  const storedRuns = await readDemoRuns();
  const existing = storedRuns[runId] ?? null;
  const now = new Date().toISOString();
  const approvalState = updates.approvalState ?? existing?.approvalState ?? "pending";
  const status = updates.status ?? existing?.status ?? "created";
  const phase =
    updates.phase ??
    existing?.phase ??
    (status === "waiting-for-approval" ? "awaiting-approval" : status === "approved" ? "approved" : status === "rejected" ? "rejected" : status === "completed" ? "completed" : status === "running" ? "validating" : "queued");
  const decision = updates.decision ?? existing?.decision ?? approvalState;
  const customer = updates.customer ?? {
    customerId: updates.customerId ?? existing?.customer?.customerId,
    company: updates.company ?? existing?.customer?.company,
    email: updates.email ?? existing?.customer?.email,
    region: updates.region ?? existing?.customer?.region,
    owner: updates.owner ?? existing?.customer?.owner,
  };

  const nextRecord: DemoRunRecord = {
    runId,
    workflowName: updates.workflowName ?? existing?.workflowName ?? "customer-onboarding",
    phase,
    decision,
    customer,
    reviewer: updates.reviewer ?? existing?.reviewer,
    reason: updates.reason ?? existing?.reason,
    approvalState,
    status,
    createdAt: updates.createdAt ?? existing?.createdAt ?? now,
    updatedAt: now,
    startedAt: updates.startedAt ?? existing?.startedAt,
    completedAt: updates.completedAt ?? existing?.completedAt,
    summary: updates.summary ?? existing?.summary,
    timeline: updates.timeline ?? existing?.timeline ?? defaultTimeline(status, approvalState),
    audit: updates.audit ?? existing?.audit ?? buildDefaultAudit(),
  };

  if (!nextRecord.timeline.length) {
    nextRecord.timeline = defaultTimeline(nextRecord.status, nextRecord.approvalState);
  }

  if (!nextRecord.audit.length) {
    nextRecord.audit = buildDefaultAudit();
  }

  storedRuns[runId] = nextRecord;
  await writeFile(STORE_PATH, JSON.stringify(storedRuns, null, 2), "utf8");
  return nextRecord;
}

export function buildDemoTimeline(options: {
  status?: DemoRunStatus;
  approvalState?: DemoApprovalState;
  company?: string;
  reviewer?: string;
  reason?: string;
} = {}): DemoTimelineEvent[] {
  const status = options.status ?? "running";
  const approvalState = options.approvalState ?? "pending";
  const events = defaultTimeline(status, approvalState);

  if (options.company) {
    events[1].detail = `${options.company} passed validation and is ready for final review.`;
  }

  if (options.reviewer && (approvalState === "approved" || approvalState === "rejected")) {
    const lastIndex = Math.max(0, events.length - 1);
    events[lastIndex].detail = `${options.reviewer} ${approvalState === "approved" ? "approved" : "rejected"} the onboarding request${options.reason ? `: ${options.reason}` : "."}`;
  }

  return events;
}
