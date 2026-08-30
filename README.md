# DurableOps

DurableOps is a production-style demo application that uses Next.js 16 and Workflow SDK v5 beta to show durable orchestration with a self-hosted Postgres backend.

## Stack

- Next.js 16 (App Router + TypeScript)
- Workflow SDK v5 beta (`workflow`)
- Self-hosted Postgres world (`@workflow/world-postgres`)
- Docker Compose for local Postgres
- Human approval hook for demonstration of pause/resume
- Demo username/password authentication with scrypt password hashes and signed, HttpOnly session cookies
- A tech account can be seeded from `TECH_USERNAME` and `TECH_PASSWORD` in `.env.local`
- Authenticated support ticket creation with requester and tech queues

## Quick start

1. Start Postgres:

   ```bash
   npm run db:up
   ```

2. Set environment variables:

   ```bash
   cp .env.example .env.local
   ```

   Set `TECH_USERNAME`/`TECH_PASSWORD` in `.env.local` for the local tech account. It is created automatically the first time auth storage is read and is never exposed through public registration. If an existing account uses that username, its role is synchronized to tech.

3. Bootstrap the Workflow SDK tables:

   ```bash
   npm run db:bootstrap
   ```

   This also applies the versioned application migrations for the ticket tables. To apply only application migrations, use `npm run db:migrate`.

4. Run the app:

   ```bash
   npm run dev
   ```

5. Open http://localhost:3000, create a user, and explore the support ticket and onboarding demos.

For UI-only development when Docker is unavailable, use:

```bash
npm run start:demo:offline
```

The workflow APIs still require the Postgres World to be running.

## Workflow story

This demo includes two durable workflows:

- The onboarding workflow validates a customer record, continues through a durable step chain, and waits for a human approval decision before finalizing.
- The support ticket workflow models a production-grade lifecycle: submitted -> triage -> awaiting approval when required -> in progress -> resolved -> closed.

The support ticket workflow is explicitly role-aware. Sensitive and high-impact work pauses for an approval hook before technical work begins, while routine requests continue directly into the tech queue.

```mermaid
flowchart TD
    A[Ticket submitted] --> B[Triage]
    B --> C{Approval required?}
    C -- No --> D[In progress]
    C -- Yes --> E[Awaiting approval]
    E --> F{Decision}
    F -- Rejected --> G[Closed]
    F -- Approved --> D
    D --> H[Resolved]
    H --> I[Closed]

    J[Requester or tech creates ticket] -. starts .-> A
    K[Tech resumes ticketApprovalHook] -. approval .-> F
```

## Roles and lifecycle

Support accounts can be created with one of two roles:

- `requester`: creates tickets and views only their own issue history
- `tech`: sees the operator queue, assigns work, and resolves tickets

Ticket lifecycle states are:

- `submitted`
- `triage`
- `awaiting approval`
- `in progress`
- `resolved`
- `closed`

Sensitive, high-impact, or high-priority tickets automatically pause at `awaiting approval` and resume through a typed Workflow SDK hook. This is implemented as a durable approval gate rather than a simple UI flag, so the approved/denied decision is persisted and replay-safe.

## Authentication and tickets

The demo uses Postgres for operational data and keeps only local demo authentication state under `.durableops/`. Application schema changes are tracked as versioned Drizzle migrations under `drizzle/` and are applied before the app starts:

- `auth.json` stores demo users with `scrypt` password hashes, opaque session cookies, and role metadata
- Postgres stores tickets, lifecycle state, queue ownership, and workflow run IDs
- `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, and `GET /api/auth/me` manage sessions
- `GET /api/tickets` returns the signed-in user’s tickets for requesters or the full queue for tech
- `POST /api/tickets` creates a ticket and starts `processSupportTicket`
- `PATCH /api/tickets/[id]` lets tech update queue state and assignee metadata
- `POST /api/tickets/approve` resumes the durable approval hook for sensitive or high-impact requests

The demo auth store remains file-backed for simplicity, while operational ticket data is stored in Postgres alongside Workflow SDK state. Use a managed database, a secret manager, CSRF protection, rate limiting, and a production identity provider before deploying.

## Why Workflow SDK instead of Temporal?

Temporal is a powerful, established platform for large-scale workflow orchestration. This demo uses Workflow SDK to show a serverless-friendly operating model: durable workflows can live beside the Next.js application and be deployed through the same application pipeline, without requiring a separately managed, always-running worker fleet.

This can simplify CI/CD for application teams. Workflow code, application code, and deployment versions can stay together in the same repository and release, while durable steps and hooks allow work to continue across requests, restarts, and process lifetimes. Workflow deployments can also be versioned independently from the rest of the application, so updating workflow behavior does not require taking the entire web application offline or coordinating a full application redeploy.

Temporal remains a strong choice when an organization needs its mature workflow platform, multi-language ecosystem, dedicated service operations, or extensive controls at significant scale. The trade-off is that Workflow SDK is a newer and more opinionated option, so teams should evaluate its operational maturity, language coverage, and hosting model against their requirements.

## Demo features

- Durable onboarding workflow with a human approval gate
- Durable support ticket lifecycle with requesters and tech roles
- Tech queue and operator dashboard with role-aware actions and required status notes
- Approval hooks for sensitive and high-impact ticket categories
- Run status + history API at `/api/runs/[runId]` and `/api/runs`
- File-backed demo history store for timeline snapshots and recent-run views
- Stronger approval UX with reviewer notes, status cards, and a run timeline
- Postgres bootstrap script that sets Docker config and waits for `pg_isready`

## Useful commands

```bash
npx workflow web
npx workflow inspect runs
npm run db:up
npm run db:bootstrap
```
