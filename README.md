# DurableOps

DurableOps is a production-style demo application that uses Next.js 16 and Workflow SDK v5 beta to show durable orchestration with a self-hosted Postgres backend.

## Stack

- Next.js 16 (App Router + TypeScript)
- Workflow SDK v5 beta (`workflow`)
- Self-hosted Postgres world (`@workflow/world-postgres`)
- Docker Compose for local Postgres
- Human approval hook for demonstration of pause/resume

## Quick start

1. Start Postgres:

   ```bash
   npm run db:up
   ```

2. Set environment variables:

   ```bash
   cp .env.example .env.local
   ```

3. Bootstrap the Workflow SDK tables:

   ```bash
   npm run db:bootstrap
   ```

4. Run the app:

   ```bash
   npm run dev
   ```

5. Open http://localhost:3000 and trigger the onboarding workflow.

## Workflow story

This demo uses an onboarding workflow that:

- validates a customer record
- creates a durable workflow step for the record
- waits for a human decision
- resumes using a typed hook approval
- finalizes the onboarding process if approved

This is designed to demonstrate the value of durable orchestration over a traditional request/response app.

## Demo features

- Durable onboarding workflow with a human approval gate
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
