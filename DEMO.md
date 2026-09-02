# DurableOps Demo Guide

Use this guide to evaluate the requester and tech-operator experiences after running `npm run start:demo`.

## Demo credentials

| Role | Username | Password | What to evaluate |
| --- | --- | --- | --- |
| Requester | `demo-requester` | `demo-pass-123` | Sees only their tickets and can submit requests. |
| Requester | `demo-requester-2` | `demo-pass-123` | Has no pre-seeded tickets; useful for testing empty requester state. |
| Tech operator | `demo-tech` | `demo-pass-123` | Sees the full queue and can approve and update tickets. |

The demo may also include a tech account configured through `TECH_USERNAME` and `TECH_PASSWORD` in `.env.local`.

## Evaluation walkthrough

1. Open [http://localhost:3000](http://localhost:3000) and sign in as `demo-requester`.
2. Confirm that **My ticket lifecycle** shows the seeded tickets, rather than the full queue.
3. Create a ticket with category **Sensitive** or **High-impact** (or priority **High**). Refresh after a few seconds until the ticket reaches **awaiting approval**.
4. Sign out, then sign in as `demo-tech`. Confirm that **Tech team queue** includes the new ticket and all seeded tickets.
5. Approve or reject the new waiting ticket. Approval resumes the durable workflow and continues it; rejection closes it.
6. For an additional operator check, choose **In progress**, **Resolve**, or **Close** on a ticket. A status note is required before the update succeeds.

The seeded tickets are static sample records, so their approval buttons cannot resume a workflow. The ticket created in step 3 has the workflow run required for the approval test.

## Reseeding

```bash
npm run demo:seed  # Add missing demo users and tickets without overwriting existing data
npm run demo:clean # Remove all Postgres tickets, users, and sessions
npm run db:reset   # Start Postgres, migrate, bootstrap Workflow SDK, then seed
```

For a fresh evaluation environment, run `npm run demo:clean` followed by `npm run db:reset`.
