# Support Ticket & SLA Tracker

A support-ticket system where SLA clocks run on **business hours only**. Nights, weekends, and configured holidays do not count.

## Tech stack

- Runtime: Node.js 20+ (TypeScript, strict mode)
- API: GraphQL Yoga, schema-first (`.graphql` files)
- Frontend: React + TypeScript (Vite)
- Database: PostgreSQL + Prisma
- Auth: bcrypt password hashes + JWT
- SLA: dedicated business-hours engine (`luxon`, timezone `BUSINESS_TIMEZONE`)

## Architecture

```
backend/src/
  graphql/          schema, resolvers, request auth
  services/
    auth/           register, login, JWT, roles
    ticket/         listing, mutations, status transitions
    sla/            business-hours calendar + SLA evaluation
    dashboard/      open / in-progress / at-risk / breached counts
  validation/       shared input checks
  db/               Prisma client
```

Resolvers stay thin. Ticket rules and SLA math live in services, not in GraphQL handlers. The frontend must display `Ticket.sla` from the API and must not recompute breach/at-risk itself.

## Database schema

- **User** — reporter or agent (`passwordHash`, unique email)
- **Ticket** — priority, status, reporter, optional assignee, `createdAt`, `firstResponseAt`, `resolvedAt`
- **Comment** — belongs to a ticket and an author
- **Holiday** — calendar date + name; excluded from SLA

Indexes exist on ticket `status`, `priority`, `assigneeId`, `reporterId`, and `createdAt`.

## Authentication

- `register` / `login` return a JWT
- Send `Authorization: Bearer <token>` on subsequent requests
- Passwords are hashed with bcrypt (never stored in plain text)
- Public registration is **REPORTER only**; agents are provisioned (see seed)
- Reporters can create tickets and comment on their own tickets
- Agents can assign, change status, resolve, and comment on any ticket

## Status transition rules

```
OPEN        → IN_PROGRESS, RESOLVED
IN_PROGRESS → RESOLVED, OPEN
RESOLVED    → CLOSED, OPEN          (OPEN = reopen)
CLOSED      → OPEN                  (reopen only)
```

`CLOSED → IN_PROGRESS` is rejected with `INVALID_STATUS_TRANSITION`. Assigning an `OPEN` ticket also moves it to `IN_PROGRESS`. `resolveTicket` is `OPEN`/`IN_PROGRESS` → `RESOLVED` and sets `resolvedAt`.

## SLA calculation

Business hours: **Monday–Friday, 09:00–18:00** in `BUSINESS_TIMEZONE` (default `Asia/Kolkata`). 9 business hours per working day.

Default policies (first response / resolution):

| Priority | First response | Resolution |
| -------- | -------------- | ---------- |
| URGENT   | 1 hour         | 4 hours    |
| HIGH     | 4 hours        | 24 hours   |
| MEDIUM   | 8 hours        | 48 hours   |
| LOW      | 24 hours       | 72 hours   |

- Starts outside business hours snap to the next business open.
- Weekends and `Holiday` rows contribute zero minutes.
- **ON_TRACK:** 0%–75% of the budget consumed (75% inclusive).
- **AT_RISK:** consumed **greater than** 75%, deadline not yet passed.
- **BREACHED:** remaining business minutes are 0.
- `firstResponseAt` (first comment by someone other than the reporter) freezes the first-response clock.
- `resolvedAt` freezes the resolution clock. A met clock stays met and cannot later become `BREACHED`.

Timestamps are stored in UTC and returned as ISO 8601.

## Environment variables

Root `.env` (Docker Compose):

```
POSTGRES_USER=postgres
POSTGRES_PASSWORD=<local-password>
POSTGRES_DB=support_ticket_sla
POSTGRES_PORT=5432
```

`backend/.env` (from `backend/.env.example`):

```
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/support_ticket_sla?schema=public
JWT_SECRET=<long-random-secret>
BUSINESS_TIMEZONE=Asia/Kolkata
PORT=4000
FRONTEND_ORIGIN=http://localhost:5173
```

Do not commit `.env` files.

## Setup

```bash
# 1. Repo-root .env for Compose, then start Postgres
copy .env.example .env
# set POSTGRES_PASSWORD in .env
docker compose up -d

# 2. Backend env, install, migrate, seed
cd backend
copy .env.example .env
# set DATABASE_URL (same user/password/db) and JWT_SECRET
npm install
npm run gendb
npx prisma db seed
npm run dev
```

GraphiQL: http://localhost:4000/graphql

```bash
# 3. Frontend (second terminal)
cd frontend
copy .env.example .env
npm install
npm run dev
```

UI: http://localhost:5173

The Vite dev server proxies `/graphql` to the API. For a non-proxied client origin, set `FRONTEND_ORIGIN` on the backend.

### Seed credentials

| Email                  | Password    | Role     |
| ---------------------- | ----------- | -------- |
| reporter@example.com   | password123 | REPORTER |
| agent@example.com      | password123 | AGENT    |

## Tests

```bash
cd backend
npm test
npm run test:integration

```

The integration test does **not** mock PostgreSQL. It creates a ticket, adds a reporter comment then an agent comment, and checks persisted `firstResponseAt` plus SLA fields derived from that row.

## Example queries

```graphql
mutation {
  login(email: "agent@example.com", password: "password123") {
    token
    user { id role }
  }
}
```

```graphql
query {
  tickets(status: OPEN, take: 10) {
    nodes {
      id
      title
      priority
      status
      sla {
        firstResponseState
        firstResponseRemainingMinutes
        resolutionState
        resolutionRemainingMinutes
      }
    }
    pageInfo { hasNextPage endCursor }
  }
  dashboard {
    openTickets
    inProgressTickets
    atRiskTickets
    breachedTickets
  }
}
```

## Frontend

React + TypeScript (Vite). SLA badges and remaining time are copied from `Ticket.sla` returned by the API. The UI never applies the 75% rule itself.

- Ticket list: priority, status, assignee, SLA state, remaining time
- Filters: status, priority, assignee, SLA state
- Sort: created at, priority, remaining SLA minutes (API `TicketSort`)
- Create ticket, detail, comment thread
- Agents: assign, change status, resolve
- GraphQL `extensions.code` shown on validation/authorization errors
- Timestamps formatted with `toLocaleString()` (user local timezone)

## Written walkthrough

1. **Architecture** — GraphQL Yoga loads `.graphql` schema files. Resolvers call services (`ticket`, `auth`, `sla`). Prisma talks to PostgreSQL.
2. **GraphQL** — Queries: `tickets` (cursor + filters + sort), `ticket`, `dashboard`, `users`, `holidays`. Mutations: register/login and ticket actions. Auth is a Bearer JWT on context.
3. **Database** — User, Ticket, Comment, Holiday with indexes on filter fields. Passwords stored as `passwordHash`.
4. **SLA** — `business-hours.ts` adds/counts minutes only Mon–Fri 09:00–18:00 in `BUSINESS_TIMEZONE`, skipping holidays. Policies are per priority. Due times and remaining minutes are computed on read.
5. **Clock freeze** — First non-reporter comment sets `firstResponseAt`. Resolve sets `resolvedAt`. Those timestamps freeze their clocks so a met SLA cannot later show `BREACHED`.
6. **Status transitions** — `OPEN → IN_PROGRESS → RESOLVED → CLOSED`, with reopen to `OPEN` only from `RESOLVED`/`CLOSED`. `CLOSED → IN_PROGRESS` is `INVALID_STATUS_TRANSITION`.
7. **Testing** — Unit tests cover SLA edge cases, transitions, validation, and auth. `npm run test:integration` uses real Prisma/PostgreSQL (Docker Compose), not a mock.
8. **Tradeoff** — Priority/SLA sorts and `slaState` filters are applied in memory after fetch so ranking can use computed SLA rather than a stored column.

## How I'd extend this

- Pause SLA while waiting on the customer
- Escalation rules and notifications
- Per-team business calendars
- Audit log for status and assignee changes
- Agent performance metrics
- Recurring holidays
- Persist due timestamps at creation for cheaper list/dashboard queries
