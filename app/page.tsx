"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type UserRole = "requester" | "tech" | "admin";
type TicketPriority = "low" | "medium" | "high";
type TicketCategory = "standard" | "sensitive" | "high-impact";
type TicketStatus = "submitted" | "triage" | "awaiting approval" | "in progress" | "resolved" | "closed";

type User = {
  id: string;
  username: string;
  role: UserRole;
};

type Ticket = {
  id: string;
  userId: string;
  createdByRole: UserRole;
  subject: string;
  description: string;
  priority: TicketPriority;
  category: TicketCategory;
  status: TicketStatus;
  assignee?: string;
  reviewer?: string;
  notes?: string;
  approvalDecision?: "pending" | "approved" | "rejected";
  workflowRunId?: string;
  createdAt: string;
  updatedAt?: string;
};

type CustomerForm = {
  customerId: string;
  company: string;
  email: string;
  region: string;
  owner: string;
};

type TimelineItem = {
  id: string;
  label: string;
  detail: string;
  timestamp: string;
  state: "complete" | "current" | "pending" | "error";
};

type RunRecord = {
  runId: string;
  workflowName: string;
  status: string;
  phase?: string;
  decision?: string;
  approvalState?: string;
  customer?: {
    customerId?: string;
    company?: string;
    email?: string;
    region?: string;
    owner?: string;
  };
  company?: string;
  email?: string;
  owner?: string;
  reviewer?: string;
  reason?: string;
  summary?: string;
  createdAt?: string;
  startedAt?: string;
  completedAt?: string;
  timeline: TimelineItem[];
};

const defaultForm: CustomerForm = {
  customerId: "cust-1042",
  company: "Northstar AI",
  email: "sam@northstar.ai",
  region: "us-east",
  owner: "ops-admin",
};

const defaultTicketForm = {
  subject: "",
  description: "",
  priority: "medium" as TicketPriority,
  category: "standard" as TicketCategory,
  assignee: "",
};

const roleStyles: Record<UserRole, string> = {
  requester: "border-sky-500/40 bg-sky-500/10 text-sky-200",
  tech: "border-violet-500/40 bg-violet-500/10 text-violet-200",
  admin: "border-rose-500/40 bg-rose-500/10 text-rose-200",
};

const ticketStatusStyles: Record<TicketStatus, string> = {
  submitted: "border-slate-600 bg-slate-800 text-slate-200",
  triage: "border-amber-500/40 bg-amber-500/10 text-amber-200",
  "awaiting approval": "border-orange-500/40 bg-orange-500/10 text-orange-200",
  "in progress": "border-cyan-500/40 bg-cyan-500/10 text-cyan-200",
  resolved: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
  closed: "border-slate-500/40 bg-slate-500/10 text-slate-200",
};

const categoryStyles: Record<TicketCategory, string> = {
  standard: "border-slate-600 bg-slate-800 text-slate-200",
  sensitive: "border-orange-500/40 bg-orange-500/10 text-orange-200",
  "high-impact": "border-rose-500/40 bg-rose-500/10 text-rose-200",
};

const statusStyles: Record<string, string> = {
  idle: "border-slate-700 bg-slate-800 text-slate-200",
  running: "border-sky-500/40 bg-sky-500/10 text-sky-200",
  "waiting-for-approval": "border-amber-500/40 bg-amber-500/10 text-amber-200",
  approved: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
  rejected: "border-rose-500/40 bg-rose-500/10 text-rose-200",
  failed: "border-rose-500/40 bg-rose-500/10 text-rose-200",
  completed: "border-cyan-500/40 bg-cyan-500/10 text-cyan-200",
  cancelled: "border-slate-500/40 bg-slate-500/10 text-slate-200",
};

const formatTimestamp = (value?: string) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
};

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authForm, setAuthForm] = useState({ username: "", password: "", role: "requester" as UserRole });
  const [authMessage, setAuthMessage] = useState("");
  const [ticketForm, setTicketForm] = useState(defaultTicketForm);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [ticketMessage, setTicketMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [actionTicketId, setActionTicketId] = useState<string | null>(null);

  const [form, setForm] = useState<CustomerForm>(defaultForm);
  const [runId, setRunId] = useState("");
  const [runRecord, setRunRecord] = useState<RunRecord | null>(null);
  const [recentRuns, setRecentRuns] = useState<RunRecord[]>([]);
  const [statusMessage, setStatusMessage] = useState("Ready to start a durable onboarding flow.");
  const [approvalReason, setApprovalReason] = useState(
    "Approved after validating the customer record and compliance checks."
  );

  const loadTickets = useCallback(async () => {
    const response = await fetch("/api/tickets");
    if (!response.ok) return;
    const result = await response.json();
    setTickets(result.tickets ?? []);
  }, []);

  useEffect(() => {
    void fetch("/api/auth/me")
      .then((response) => response.json())
      .then((result) => {
        if (result.user) {
          setUser(result.user);
          void loadTickets();
        }
      })
      .catch(() => undefined);
  }, [loadTickets]);

  const queueTickets = useMemo(() => {
    if (!user) return [] as Ticket[];
    if (user.role === "requester") {
      return tickets.filter((ticket) => ticket.userId === user.id);
    }
    return tickets;
  }, [tickets, user]);

  const submitAuth = async (event: React.FormEvent) => {
    event.preventDefault();
    setAuthMessage(authMode === "login" ? "Signing you in…" : "Creating your account…");

    const endpoint = authMode === "login" ? "/api/auth/login" : "/api/auth/register";
    const payload = authMode === "login" ? { username: authForm.username, password: authForm.password } : authForm;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json();

    if (!response.ok) {
      setAuthMessage(result.message ?? "Authentication failed");
      return;
    }

    setUser(result.user);
    setAuthMessage("");
    setAuthForm({ username: "", password: "", role: "requester" });
    void loadTickets();
  };

  const signOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setTickets([]);
  };

  const submitTicket = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setTicketMessage("Saving ticket and starting the durable lifecycle…");

    const response = await fetch("/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ticketForm),
    });
    const result = await response.json();

    if (!response.ok) {
      setTicketMessage(result.message ?? "Could not create ticket");
      setLoading(false);
      return;
    }

    setTicketForm({ ...defaultTicketForm });
    setTicketMessage(result.warning ?? "Ticket submitted for triage.");
    setLoading(false);
    void loadTickets();
  };

  const adjustTicketStatus = async (ticketId: string, status: TicketStatus) => {
    setActionTicketId(ticketId);
    try {
      const response = await fetch(`/api/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, notes: `Status updated to ${status} by ${user?.username ?? "operator"}.` }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message ?? "Ticket update failed");
      }
      await loadTickets();
    } catch (error) {
      setTicketMessage(error instanceof Error ? error.message : "Ticket update failed");
    } finally {
      setActionTicketId(null);
    }
  };

  const approveTicket = async (ticketId: string, approved: boolean) => {
    setActionTicketId(ticketId);
    try {
      const response = await fetch("/api/tickets/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketId,
          approved,
          reviewer: user?.username ?? "support-operator",
          reason: approved ? "Approved by the support review queue." : "Rejected by the support review queue.",
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message ?? "Approval action failed");
      }
      await loadTickets();
    } catch (error) {
      setTicketMessage(error instanceof Error ? error.message : "Approval failed");
    } finally {
      setActionTicketId(null);
    }
  };

  const currentStatus = useMemo(() => {
    if (!runRecord) return "idle";
    const normalized = runRecord.status.toLowerCase();
    if (normalized.includes("approval") || normalized === "waiting") return "waiting-for-approval";
    if (normalized === "approved") return "approved";
    if (normalized === "rejected") return "rejected";
    if (normalized === "failed") return "failed";
    if (normalized === "completed") return "completed";
    if (normalized === "cancelled") return "cancelled";
    if (normalized === "running") return "running";
    return normalized || "idle";
  }, [runRecord]);

  const updateField = (field: keyof CustomerForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const refreshRunStatus = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/runs/${id}`);
      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.message || "Unable to fetch workflow status");
      }

      const nextRun = result.run as RunRecord;
      setRunRecord(nextRun);
      setStatusMessage(nextRun.summary || "Workflow state synced from the durable store.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to read workflow state";
      setStatusMessage(message);
    }
  }, []);

  const loadRecentRuns = useCallback(async () => {
    try {
      const response = await fetch("/api/runs");
      const result = await response.json();

      if (!response.ok || !result.ok) return;
      setRecentRuns(Array.isArray(result.runs) ? result.runs : []);
    } catch {
      // Ignore recent-run fetch errors in the demo UI.
    }
  }, []);

  useEffect(() => {
    if (!runId) return;

    const intervalId = window.setInterval(() => {
      void refreshRunStatus(runId);
    }, 2000);

    return () => window.clearInterval(intervalId);
  }, [runId, refreshRunStatus]);

  const startWorkflow = async () => {
    setLoading(true);
    setStatusMessage("Starting onboarding workflow...");

    try {
      const response = await fetch("/api/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.message || "Unable to start workflow");
      }

      setRunId(result.runId);
      setStatusMessage(`Workflow started. Approval required for ${form.company}.`);
      await refreshRunStatus(result.runId);
      await loadRecentRuns();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Workflow start failed";
      setStatusMessage(message);
    } finally {
      setLoading(false);
    }
  };

  const sendApproval = async (approved: boolean) => {
    if (!runId) {
      setStatusMessage("Start the workflow before approving or rejecting it.");
      return;
    }

    setLoading(true);
    setStatusMessage(approved ? "Approving onboarding..." : "Rejecting onboarding...");

    try {
      const response = await fetch("/api/approval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runId,
          approved,
          reviewer: form.owner,
          reason: approvalReason || (approved ? "Approved by operations review" : "Rejected by operations review"),
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.message || "Approval action failed");
      }

      setStatusMessage(
        approved ? "Customer onboarding was approved and finalized." : "Customer onboarding was rejected and terminated."
      );
      await refreshRunStatus(runId);
      await loadRecentRuns();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Approval action failed";
      setStatusMessage(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-6 py-10 text-slate-100">
      <header className="flex items-center justify-between border border-slate-800 bg-slate-950/60 px-6 py-4 backdrop-blur-sm">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-teal-300">DurableOps</p>
          <h1 className="mt-2 text-3xl font-semibold">Workflow SDK demo</h1>
        </div>
        <div className="flex items-center gap-3">
          {user ? (
            <>
              <span className="text-sm text-slate-300">
                Signed in as <strong className="text-teal-200">{user.username}</strong>
              </span>
              <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${roleStyles[user.role]}`}>
                {user.role}
              </span>
              <button onClick={() => void signOut()} className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-200 hover:border-slate-500">
                Sign out
              </button>
            </>
          ) : null}
          <span className="rounded-full border border-teal-400/30 bg-teal-500/10 px-3 py-1 text-sm font-medium text-teal-200">
            Next.js 16 + Workflow v5 beta
          </span>
        </div>
      </header>

      {!user ? (
        <section className="mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-teal-500/20 bg-gradient-to-br from-teal-500/10 to-slate-900/80 p-8">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-teal-300">Operations workspace</p>
            <h2 className="mt-4 text-4xl font-semibold tracking-tight text-white">Keep every request moving.</h2>
            <p className="mt-4 max-w-lg text-slate-300">
              Create an account to submit support tickets, watch the role-aware lifecycle, and explore the onboarding approval demo.
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {[
                "Requester roles",
                "Tech queue",
                "Admin controls",
              ].map((item) => (
                <div key={item} className="rounded-xl border border-slate-700 bg-slate-950/50 p-3 text-sm text-slate-200">
                  {item}
                </div>
              ))}
            </div>
          </div>
          <form onSubmit={submitAuth} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <div className="flex gap-5 border-b border-slate-800">
              {(["login", "register"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    setAuthMode(mode);
                    setAuthMessage("");
                  }}
                  className={`border-b-2 pb-3 text-sm font-medium ${authMode === mode ? "border-teal-400 text-teal-200" : "border-transparent text-slate-400"}`}
                >
                  {mode === "login" ? "Log in" : "Create account"}
                </button>
              ))}
            </div>
            <div className="mt-6 space-y-4">
              <label className="block text-sm text-slate-300">
                Username
                <input
                  required
                  minLength={3}
                  value={authForm.username}
                  onChange={(e) => setAuthForm({ ...authForm, username: e.target.value })}
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-teal-400"
                />
              </label>
              <label className="block text-sm text-slate-300">
                Password
                <input
                  required
                  minLength={8}
                  type="password"
                  value={authForm.password}
                  onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-teal-400"
                />
              </label>
              {authMode === "register" ? (
                <>
                  <label className="block text-sm text-slate-300">
                    Account type
                    <select
                      value={authForm.role}
                      onChange={(e) => setAuthForm({ ...authForm, role: e.target.value as UserRole })}
                      className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-teal-400"
                    >
                      <option value="requester">Requester</option>
                      <option value="tech">Tech</option>
                    </select>
                  </label>
                  <p className="text-xs text-slate-400">
                    Tech accounts can view and work every ticket in the demo queue.
                  </p>
                </>
              ) : null}
              <button className="w-full rounded-xl bg-teal-400 px-4 py-2.5 font-semibold text-slate-950 hover:bg-teal-300">
                {authMode === "login" ? "Enter workspace" : "Create workspace"}
              </button>
              {authMessage ? <p className="text-sm text-rose-300">{authMessage}</p> : null}
            </div>
          </form>
        </section>
      ) : (
        <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <form onSubmit={submitTicket} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <div className="mb-5">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-teal-300">Support operations</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Submit a support ticket</h2>
            </div>
            <div className="space-y-4">
              <label className="block text-sm text-slate-300">
                Subject
                <input
                  required
                  value={ticketForm.subject}
                  onChange={(e) => setTicketForm({ ...ticketForm, subject: e.target.value })}
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-teal-400"
                  placeholder="What needs attention?"
                />
              </label>
              <label className="block text-sm text-slate-300">
                Description
                <textarea
                  required
                  rows={5}
                  value={ticketForm.description}
                  onChange={(e) => setTicketForm({ ...ticketForm, description: e.target.value })}
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-teal-400"
                  placeholder="Add impact, environment, and urgency notes."
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm text-slate-300">
                  Priority
                  <select
                    value={ticketForm.priority}
                    onChange={(e) => setTicketForm({ ...ticketForm, priority: e.target.value as TicketPriority })}
                    className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-teal-400"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </label>
                <label className="block text-sm text-slate-300">
                  Category
                  <select
                    value={ticketForm.category}
                    onChange={(e) => setTicketForm({ ...ticketForm, category: e.target.value as TicketCategory })}
                    className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-teal-400"
                  >
                    <option value="standard">Standard</option>
                    <option value="sensitive">Sensitive</option>
                    <option value="high-impact">High-impact</option>
                  </select>
                </label>
              </div>
              <label className="block text-sm text-slate-300">
                Assignee (optional)
                <input
                  value={ticketForm.assignee}
                  onChange={(e) => setTicketForm({ ...ticketForm, assignee: e.target.value })}
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-teal-400"
                  placeholder="ops-tech-1"
                />
              </label>
              <div className="flex items-center gap-3">
                <button disabled={loading} className="rounded-xl bg-teal-400 px-4 py-2.5 font-semibold text-slate-950 hover:bg-teal-300 disabled:cursor-not-allowed disabled:opacity-60">
                  {loading ? "Working..." : "Create ticket"}
                </button>
                {ticketMessage ? <p className="text-sm text-slate-300">{ticketMessage}</p> : null}
              </div>
            </div>
          </form>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                  {user.role === "requester" ? "My requests" : "Operator dashboard"}
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-white">
                  {user.role === "requester" ? "My ticket lifecycle" : "Tech team queue"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => void loadTickets()}
                className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-200 hover:border-slate-500"
              >
                Refresh
              </button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-700 bg-slate-950/70 p-3">
                <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Open</p>
                <p className="mt-2 text-2xl font-semibold text-white">
                  {queueTickets.filter((ticket) => ticket.status !== "closed").length}
                </p>
              </div>
              <div className="rounded-xl border border-slate-700 bg-slate-950/70 p-3">
                <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Approval</p>
                <p className="mt-2 text-2xl font-semibold text-white">
                  {queueTickets.filter((ticket) => ticket.status === "awaiting approval").length}
                </p>
              </div>
              <div className="rounded-xl border border-slate-700 bg-slate-950/70 p-3">
                <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Resolved</p>
                <p className="mt-2 text-2xl font-semibold text-white">
                  {queueTickets.filter((ticket) => ticket.status === "resolved" || ticket.status === "closed").length}
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {queueTickets.length === 0 ? (
                <p className="text-sm text-slate-400">No support tickets yet. Submit a new ticket to populate the queue.</p>
              ) : (
                queueTickets.map((ticket) => (
                  <div key={ticket.id} className="rounded-xl border border-slate-700 bg-slate-950/60 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-medium text-white">{ticket.subject}</h3>
                        <p className="mt-1 text-sm text-slate-400">{ticket.description}</p>
                      </div>
                      <span className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.18em] ${ticketStatusStyles[ticket.status]}`}>
                        {ticket.status}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-300">
                      <span className={`rounded-full border px-2 py-1 ${categoryStyles[ticket.category]}`}>{ticket.category}</span>
                      <span className="rounded-full border border-slate-700 bg-slate-800 px-2 py-1 capitalize">{ticket.priority} priority</span>
                      <span className="rounded-full border border-slate-700 bg-slate-800 px-2 py-1">{ticket.assignee ?? "unassigned"}</span>
                      <span className="rounded-full border border-slate-700 bg-slate-800 px-2 py-1">{formatTimestamp(ticket.updatedAt ?? ticket.createdAt)}</span>
                    </div>

                    {ticket.notes ? <p className="mt-3 text-xs text-slate-300">{ticket.notes}</p> : null}

                    {user.role !== "requester" ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {ticket.status === "awaiting approval" ? (
                          <>
                            <button
                              type="button"
                              disabled={actionTicketId === ticket.id}
                              onClick={() => void approveTicket(ticket.id, true)}
                              className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-sm text-emerald-200 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              disabled={actionTicketId === ticket.id}
                              onClick={() => void approveTicket(ticket.id, false)}
                              className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-sm text-rose-200 hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Reject
                            </button>
                          </>
                        ) : null}
                        {ticket.status !== "closed" ? (
                          <>
                            <button
                              type="button"
                              disabled={actionTicketId === ticket.id}
                              onClick={() => void adjustTicketStatus(ticket.id, "in progress")}
                              className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-1.5 text-sm text-sky-200 hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              In progress
                            </button>
                            <button
                              type="button"
                              disabled={actionTicketId === ticket.id}
                              onClick={() => void adjustTicketStatus(ticket.id, "resolved")}
                              className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-sm text-emerald-200 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Resolve
                            </button>
                            <button
                              type="button"
                              disabled={actionTicketId === ticket.id}
                              onClick={() => void adjustTicketStatus(ticket.id, "closed")}
                              className="rounded-lg border border-slate-500/40 bg-slate-500/10 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Close
                            </button>
                          </>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      )}

      {user ? <p className="text-sm uppercase tracking-[0.18em] text-slate-500">Workflow SDK onboarding playground</p> : null}
      {user ? (
        <section className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/30">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">Customer onboarding</h2>
              <span className="rounded-full border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">
                durable workflow
              </span>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm text-slate-300">
                <span>Customer ID</span>
                <input
                  value={form.customerId}
                  onChange={(event) => updateField("customerId", event.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none ring-0 transition focus:border-teal-400"
                />
              </label>

              <label className="space-y-2 text-sm text-slate-300">
                <span>Company</span>
                <input
                  value={form.company}
                  onChange={(event) => updateField("company", event.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none ring-0 transition focus:border-teal-400"
                />
              </label>

              <label className="space-y-2 text-sm text-slate-300 md:col-span-2">
                <span>Email</span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => updateField("email", event.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none ring-0 transition focus:border-teal-400"
                />
              </label>

              <label className="space-y-2 text-sm text-slate-300">
                <span>Region</span>
                <input
                  value={form.region}
                  onChange={(event) => updateField("region", event.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none ring-0 transition focus:border-teal-400"
                />
              </label>

              <label className="space-y-2 text-sm text-slate-300">
                <span>Owner</span>
                <input
                  value={form.owner}
                  onChange={(event) => updateField("owner", event.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none ring-0 transition focus:border-teal-400"
                />
              </label>
            </div>

            <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Approval note</span>
                <span className="text-xs text-slate-400">Optional reviewer note</span>
              </div>
              <textarea
                value={approvalReason}
                onChange={(event) => setApprovalReason(event.target.value)}
                rows={3}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-teal-400"
                placeholder="Describe why this customer is approved or rejected."
              />
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={startWorkflow}
                disabled={loading}
                className="rounded-xl bg-teal-500 px-4 py-2.5 font-medium text-slate-950 transition hover:bg-teal-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Working..." : "Start workflow"}
              </button>

              <button
                type="button"
                onClick={() => void sendApproval(true)}
                disabled={loading || !runId}
                className="rounded-xl border border-emerald-400/60 bg-emerald-500/10 px-4 py-2.5 font-medium text-emerald-200 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Approve
              </button>

              <button
                type="button"
                onClick={() => void sendApproval(false)}
                disabled={loading || !runId}
                className="rounded-xl border border-rose-400/60 bg-rose-500/10 px-4 py-2.5 font-medium text-rose-200 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          </div>

          <aside className="space-y-6">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
              <h3 className="text-lg font-semibold text-white">Operational status</h3>

              <div className="mt-5 space-y-5">
                <div className="rounded-xl border border-slate-700 bg-slate-950/70 p-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Workflow run</p>
                  <p className="mt-2 break-all font-mono text-sm text-teal-200">{runId || "not started"}</p>
                </div>

                <div className="rounded-xl border border-slate-700 bg-slate-950/70 p-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">State</p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium uppercase tracking-[0.18em] ${statusStyles[currentStatus]}`}>
                      {currentStatus.replace(/-/g, " ")}
                    </span>
                    <span className="text-xs text-slate-400">{runRecord?.decision ?? runRecord?.approvalState ?? "pending"}</span>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-700 bg-slate-950/70 p-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Message</p>
                  <p className="mt-2 text-sm text-slate-200">{statusMessage}</p>
                </div>

                <div className="grid gap-2 text-sm text-slate-300">
                  <div className="flex justify-between gap-3 rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2">
                    <span>Created</span>
                    <span className="text-slate-100">{formatTimestamp(runRecord?.createdAt)}</span>
                  </div>
                  <div className="flex justify-between gap-3 rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2">
                    <span>Started</span>
                    <span className="text-slate-100">{formatTimestamp(runRecord?.startedAt)}</span>
                  </div>
                  <div className="flex justify-between gap-3 rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2">
                    <span>Completed</span>
                    <span className="text-slate-100">{formatTimestamp(runRecord?.completedAt)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">Run timeline</h3>
                <span className="rounded-full border border-slate-700 bg-slate-800 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-300">
                  {runRecord?.timeline?.length ?? 0} steps
                </span>
              </div>

              <ol className="mt-5 space-y-4">
                {(runRecord?.timeline ?? []).map((entry) => (
                  <li key={entry.id} className="relative pl-6">
                    <span className="absolute left-0 top-1.5 h-3 w-3 rounded-full border border-slate-900 bg-slate-600" />
                    {entry.state === "complete" ? <span className="absolute left-0 top-1.5 h-3 w-3 rounded-full bg-emerald-400" /> : null}
                    {entry.state === "current" ? <span className="absolute left-0 top-1.5 h-3 w-3 rounded-full bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.9)]" /> : null}
                    {entry.state === "error" ? <span className="absolute left-0 top-1.5 h-3 w-3 rounded-full bg-rose-400" /> : null}
                    {entry.state === "pending" ? <span className="absolute left-0 top-1.5 h-3 w-3 rounded-full bg-slate-500" /> : null}

                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-white">{entry.label}</p>
                        <span className="text-[10px] uppercase tracking-[0.18em] text-slate-400">{formatTimestamp(entry.timestamp)}</span>
                      </div>
                      <p className="mt-2 text-sm text-slate-300">{entry.detail}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </aside>
        </section>
      ) : null}

      {user ? (
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Recent run history</h3>
            <button
              type="button"
              onClick={() => void loadRecentRuns()}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 hover:border-slate-500"
            >
              Refresh
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {recentRuns.length === 0 ? (
              <p className="text-sm text-slate-400">No run history yet — start the workflow to populate the timeline.</p>
            ) : (
              recentRuns.map((run) => (
                <button
                  key={run.runId}
                  type="button"
                  onClick={() => {
                    setRunId(run.runId);
                    void refreshRunStatus(run.runId);
                  }}
                  className="rounded-xl border border-slate-700 bg-slate-950/60 p-4 text-left transition hover:border-teal-500/60"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-white">{run.company || run.customer?.company || run.workflowName}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] ${statusStyles[run.status?.toLowerCase() || "idle"]}`}>
                      {run.status || "ready"}
                    </span>
                  </div>
                  <p className="mt-3 break-all font-mono text-[11px] text-slate-400">{run.runId}</p>
                  <p className="mt-3 text-xs text-slate-300">{run.summary || "Workflow maintained by the durable store."}</p>
                </button>
              ))
            )}
          </div>
        </section>
      ) : null}
    </main>
  );
}
