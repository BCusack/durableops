"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type UserRole = "requester" | "tech";
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
  advisorAdvice?: string;
  approvalDecision?: "pending" | "approved" | "rejected";
  workflowRunId?: string;
  createdAt: string;
  updatedAt?: string;
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
  const [statusNoteDrafts, setStatusNoteDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [actionTicketId, setActionTicketId] = useState<string | null>(null);

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
    if (!user || user.role !== "tech") {
      setTicketMessage("Only tech users can update ticket status.");
      return;
    }

    const note = (statusNoteDrafts[ticketId] ?? "").trim();
    if (!note) {
      setTicketMessage("Add a status note before updating this ticket.");
      return;
    }

    setActionTicketId(ticketId);
    try {
      const response = await fetch(`/api/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, notes: note }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message ?? "Ticket update failed");
      }
      setStatusNoteDrafts((current) => {
        const next = { ...current };
        delete next[ticketId];
        return next;
      });
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
                "Status notes",
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
                    {user.role === "tech" && ticket.advisorAdvice ? (
                      <div className="mt-3 rounded-lg border border-violet-400/30 bg-violet-500/10 p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-200">AI ticket advisor</p>
                        <p className="mt-1 text-sm text-violet-100">{ticket.advisorAdvice}</p>
                      </div>
                    ) : null}

                    {user.role === "tech" ? (
                      <div className="mt-4 space-y-3">
                        <label className="block text-sm text-slate-300">
                          Status note
                          <textarea
                            rows={2}
                            value={statusNoteDrafts[ticket.id] ?? ""}
                            onChange={(event) =>
                              setStatusNoteDrafts((current) => ({
                                ...current,
                                [ticket.id]: event.target.value,
                              }))
                            }
                            className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-teal-400"
                            placeholder="Add a brief update for this status change."
                          />
                        </label>
                      </div>
                    ) : null}

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

    </main>
  );
}
