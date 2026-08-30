"use client";

import { useState } from "react";

type CustomerForm = {
  customerId: string;
  company: string;
  email: string;
  region: string;
  owner: string;
};

const defaultForm: CustomerForm = {
  customerId: "cust-1042",
  company: "Northstar AI",
  email: "sam@northstar.ai",
  region: "us-east",
  owner: "ops-admin",
};

export default function Home() {
  const [form, setForm] = useState<CustomerForm>(defaultForm);
  const [runId, setRunId] = useState("");
  const [statusMessage, setStatusMessage] = useState("Ready to start a durable onboarding flow.");
  const [loading, setLoading] = useState(false);
  const [decision, setDecision] = useState("pending");

  const updateField = (field: keyof CustomerForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

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
      setDecision("waiting-for-approval");
      setStatusMessage(`Workflow started. Approval token: ${result.runId}`);
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
          reason: approved ? "Approved by operations review" : "Rejected by operations review",
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.message || "Approval action failed");
      }

      setDecision(approved ? "approved" : "rejected");
      setStatusMessage(
        approved ? "Customer onboarding was approved and finalized." : "Customer onboarding was rejected and terminated."
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Approval action failed";
      setStatusMessage(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-6 py-10 text-slate-100">
      <header className="flex items-center justify-between border border-slate-800 bg-slate-950/60 px-6 py-4 backdrop-blur-sm">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-teal-300">DurableOps</p>
          <h1 className="mt-2 text-3xl font-semibold">Workflow SDK demo</h1>
        </div>
        <div className="rounded-full border border-teal-400/30 bg-teal-500/10 px-3 py-1 text-sm font-medium text-teal-200">
          Next.js 16 + Workflow v5 beta
        </div>
      </header>

      <section className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/30">
          <div className="mb-6 flex items-center justify-between">
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
              onClick={() => sendApproval(true)}
              disabled={loading || !runId}
              className="rounded-xl border border-emerald-400/60 bg-emerald-500/10 px-4 py-2.5 font-medium text-emerald-200 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Approve
            </button>

            <button
              type="button"
              onClick={() => sendApproval(false)}
              disabled={loading || !runId}
              className="rounded-xl border border-rose-400/60 bg-rose-500/10 px-4 py-2.5 font-medium text-rose-200 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Reject
            </button>
          </div>
        </div>

        <aside className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <h3 className="text-lg font-semibold text-white">Operational status</h3>

          <div className="mt-5 space-y-5">
            <div className="rounded-xl border border-slate-700 bg-slate-950/70 p-3">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Workflow run</p>
              <p className="mt-2 break-all font-mono text-sm text-teal-200">{runId || "not started"}</p>
            </div>

            <div className="rounded-xl border border-slate-700 bg-slate-950/70 p-3">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Decision</p>
              <p className="mt-2 text-sm font-medium text-slate-200">{decision}</p>
            </div>

            <div className="rounded-xl border border-slate-700 bg-slate-950/70 p-3">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Message</p>
              <p className="mt-2 text-sm text-slate-200">{statusMessage}</p>
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}
