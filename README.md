# ReachInbox Email Scheduler

A full-stack cold-email scheduling system for the ReachInbox hiring assignment. Users log in with Google OAuth (or email/password), upload a CSV/TXT lead list, compose an email, and schedule it to be sent in the future. Emails are persisted as `EmailJob` rows in PostgreSQL, enqueued as durable BullMQ delayed jobs in Redis, throttled by a Redis rate limiter, and delivered through Ethereal SMTP. The React dashboard shows scheduled, processing, sent, and failed emails with live status.

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 6, TypeScript, Tailwind CSS 3, React Router 7, lucide-react |
| Backend | Node.js, Express 4, TypeScript (NodeNext), Zod, Multer, cookie-parser, CORS |
| Database | PostgreSQL 16, Prisma 6 ORM |
| Queue | BullMQ 6 backed by Redis 7 |
| Rate limiting | Redis Lua script (atomic, per-sender) |
| Email | Nodemailer + Ethereal SMTP (test inbox) |
| Auth | Real Google OAuth 2.0 + email/password with bcrypt, JWT session cookie |
| Tests | Vitest (backend: node env; frontend: jsdom + Testing Library) |
| Infra | Docker Compose (PostgreSQL + Redis), npm workspaces |

---

## Architecture

```text
React + Vite (port 5173)
  │  fetch (credentials: include)
  ▼
Express REST API (port 4000)
  ├── /api/auth/*            Google OAuth + password login, JWT session cookie
  └── /api/emails/*          schedule / list / get, Zod + multer validation
        │
        ▼
  PostgreSQL (port 5433, source of truth)
        │  create EmailJob → status scheduled/queued
        ▼
  BullMQ delayed jobs (Redis port 6380, durable, deterministic IDs)
        │
        ▼
  BullMQ Worker (concurrency 5)
        ├── atomic transition → processing
        ├── Redis rate limiter (Lua) — hourly cap + minimum delay
        ├── Ethereal SMTP send
        └── PostgreSQL status → sent / failed (attempts++, error)
        ▲
  Email Sweeper worker (self-rescheduling BullMQ job)
        └── marks orphaned scheduled/queued rows as failed
```

PostgreSQL is the source of truth for users, senders, and email jobs. Redis stores BullMQ queue state plus shared per-sender rate-limit counters. State survives restarts: scheduled jobs live in Redis (`--appendonly yes`) and job statuses live in Postgres.

---

## Features Implemented

### Backend

- **Google OAuth 2.0 login** with CSRF `state` protection (`crypto.timingSafeEqual`) and an httpOnly state cookie.
- **Email/password login** with bcrypt-hashed passwords (no registration endpoint).
- **JWT session cookies** (httpOnly, `sameSite: lax`, secure in production, 7-day expiry) with a `requireAuth` middleware.
- **Scheduled email delivery** via BullMQ delayed jobs — `POST /api/emails/schedule` accepts JSON or `multipart/form-data` (up to 5000 recipients).
- **Durable scheduling**: each email is a PostgreSQL `EmailJob` row (source of truth) + a deterministic BullMQ job in Redis (`--appendonly yes`).
- **Per-sender rate limiting** enforced by an atomic Redis Lua script — hourly cap + minimum delay between sends; denied sends are re-queued, never dropped.
- **Crash-safe worker**: the whole transition → rate-limit → SMTP → status pipeline runs in one try/catch; failures release the job back to `failed` for BullMQ retry (3 attempts, exponential backoff).
- **Orphan sweeper**: a self-rescheduling BullMQ job (no cron) marks `scheduled`/`queued` rows with no live queue job as `failed` after a grace period, healing the gap between Postgres and Redis.
- **Idempotency & dedup**: deterministic job IDs, a guarded `processing` transition, and a DB unique index (`userId, senderId, recipient, subject, md5(body), scheduledAt`) that turns concurrent duplicate requests into no-ops.
- **Validation & security**: Zod schemas, server-side image MIME allowlist (multer + schema), 10 MB attachment cap, no `any` types, git-ignored env files.
- **Error handling**: centralized error middleware (HttpError → status code, Zod → 400 with details, otherwise 500).

### Frontend

- **Login page** — "Continue with Google" + email/password form, renders OAuth callback errors.
- **Dashboard** — stat cards (Scheduled / Processing / Sent / Failed), failed-jobs warning, recent-activity feed, and preview lists for scheduled and sent emails.
- **Compose page** — subject, body, CSV/TXT lead upload with drag-and-drop, local-time start picker (defaults to now + 5 min), delay between emails (seconds), hourly limit, and image attachments.
- **Lead parser** — extracts, normalizes, and dedupes emails; reports invalid entries and duplicate counts before scheduling.
- **Scheduled / Sent pages** — responsive jobs tables with status badges and a details modal (sender, recipient, timestamps, attempts, delivery error).
- **Session management** — AuthContext with `credentials: include` fetch wrapper and protected routes.

---

## Repository Layout

```text
reachinbox-email-scheduler/
├── docker-compose.yml              PostgreSQL (5433) + Redis (6380)
├── package.json                    npm workspaces: backend + frontend
├── .gitignore                      env files, node_modules, dist, coverage, editor files
├── README.md                       this document
├── TESTING.md                      detailed test report
├── backend/
│   ├── .env.example                template for backend/.env
│   ├── package.json
│   ├── tsconfig.json               NodeNext, strict, rootDir: src
│   ├── vitest.config.ts
│   ├── test/setup.ts               test env vars
│   ├── prisma/
│   │   ├── schema.prisma           User / Sender / EmailJob + enum EmailJobStatus
│   │   └── migrations/             init, add_hourly_limit, add_email_password_auth,
│   │                               add_attachments_to_emailjob, dedupe_email_jobs
│   └── src/
│       ├── server.ts               entrypoint: Express + email sweeper worker lifecycle
│       ├── app.ts                  Express app: CORS, json, cookies, routes, 404, error handler
│       ├── config/
│       │   ├── env.ts              zod-validated environment variables
│       │   ├── prisma.ts           PrismaClient singleton
│       │   ├── redis.ts            ioredis connection (maxRetriesPerRequest: null)
│       │   └── google.ts           OAuth2Client + scopes [openid, email, profile]
│       ├── controllers/
│       │   ├── auth.controller.ts  Google redirect/callback, login, me, logout
│       │   └── email.controller.ts multipart/JSON schedule, list, get
│       ├── routes/
│       │   ├── auth.routes.ts      /api/auth/*
│       │   └── email.routes.ts     /api/emails/* (+ multer image MIME filter)
│       ├── middleware/
│       │   ├── auth.middleware.ts  requireAuth (JWT cookie → req.user)
│       │   └── error.middleware.ts HttpError → status, ZodError → 400, else 500
│       ├── validators/
│       │   ├── auth.validator.ts   login schema (email + min-8 password)
│       │   └── email.validator.ts  schedule schema, image MIME allowlist
│       ├── services/
│       │   ├── auth.service.ts     OAuth state, Google callback, JWT, bcrypt login
│       │   ├── email.service.ts    schedule / list / get email jobs
│       │   ├── email-worker.service.ts  per-job processing pipeline
│       │   ├── email-sweeper.service.ts orphan reconciliation sweep
│       │   ├── rate-limit.service.ts   Redis Lua hourly + minimum-delay reservation
│       │   └── smtp.service.ts     nodemailer send/verify, attachment parsing
│       ├── queues/
│       │   ├── email.queue.ts      email-send-queue + deterministic job IDs
│       │   └── email-sweeper.queue.ts  sweeper queue + scheduleNextSweep
│       ├── workers/
│       │   ├── email.worker.ts     standalone worker process
│       │   └── email-sweeper.worker.ts  sweeper worker + boot sweep
│       ├── scripts/test-smtp.ts    CLI SMTP test
│       ├── types/                  auth.ts, express.d.ts (req.user)
│       ├── errors/http-error.ts
│       └── utils/async-handler.ts
└── frontend/
    ├── .env.example                VITE_API_URL
    ├── package.json / vite.config.ts / vitest.config.ts / tailwind.config.js
    ├── test/setup.ts               jest-dom matchers
    └── src/
        ├── main.tsx                BrowserRouter + AuthProvider + App
        ├── App.tsx                 routes (login + protected layout)
        ├── pages/                  LoginPage, DashboardPage, ComposePage, EmailListPage
        ├── components/
        │   ├── layout/AppLayout.tsx        sidebar, topbar, logout
        │   ├── ProtectedRoute.tsx          auth gate
        │   ├── leads/LeadUpload.tsx        CSV/TXT drag-and-drop uploader
        │   ├── email/EmailJobsTable.tsx    responsive jobs table
        │   ├── email/EmailJobDetailsModal.tsx job details dialog
        │   ├── ui/StatusBadge.tsx          status pill
        │   └── dashboard/                  StatCard, EmailPreviewList, RecentActivity, StateBlock
        ├── context/AuthContext.tsx         session state, refresh, logout
        ├── hooks/                          useEmailJobs, useEmailDashboard
        ├── services/                       api.ts (fetch wrapper), auth.service.ts, email.service.ts
        ├── utils/                          leadParser.ts, date.ts
        └── types/                          auth.ts, email.ts, leads.ts
```

---

## Prerequisites

- Node.js 18+ and npm
- Docker (for PostgreSQL + Redis)
- A Google Cloud OAuth 2.0 client (for Google login)
- Ethereal credentials (auto-test inbox) — https://ethereal.email

---

## Quick Start

```bash
# 1. Install dependencies (npm workspaces: backend + frontend)
npm install

# 2. Start PostgreSQL and Redis (host ports 5433 and 6380 to avoid WSL conflicts)
docker compose up -d postgres redis

# 3. Create env files from the templates
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
#    → fill in GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / JWT_SESSION_SECRET / SMTP_* in backend/.env

# 4. Run Prisma migrations
npm run prisma:migrate --workspace backend

# 5. Run everything (backend + frontend + worker) with one command
npm run dev:all
```

Or run the three processes separately:

```bash
npm run dev --workspace backend          # Express API on http://localhost:4000
npm run dev:worker --workspace backend   # BullMQ email worker (+ sweeper)
npm run dev --workspace frontend         # Vite dev server on http://localhost:5173
```

---

## Environment Variables

### Backend (`backend/.env`)

```env
PORT=4000
CLIENT_URL=http://localhost:5173
DATABASE_URL=postgresql://reachinbox:<your-postgres-password>@localhost:5433/reachinbox_scheduler?schema=public

GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:4000/api/auth/google/callback

JWT_SESSION_SECRET=replace-with-a-long-random-secret     # must be ≥ 32 chars
AUTH_COOKIE_NAME=reachinbox_session
NODE_ENV=development

REDIS_URL=redis://localhost:6380
EMAIL_QUEUE_NAME=email-send-queue
EMAIL_SWEEPER_INTERVAL_MS=300000      # sweeper runs every 5 minutes
EMAIL_JOB_ATTEMPTS=3
EMAIL_JOB_BACKOFF_MS=5000
WORKER_CONCURRENCY=5
MIN_DELAY_BETWEEN_EMAILS_MS=2000
MAX_EMAILS_PER_HOUR_PER_SENDER=100

SMTP_HOST=smtp.ethereal.email
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-ethereal-user
SMTP_PASSWORD=your-ethereal-password
SMTP_FROM="ReachInbox Scheduler <your-ethereal-user@ethereal.email>"
```

> Note: PostgreSQL/Redis are exposed on **5433/6380** (not the default 5432/6379) to avoid WSL port conflicts. Use these values in `DATABASE_URL` and `REDIS_URL`.
>
> The Postgres password is injected into `docker-compose.yml` via `${POSTGRES_PASSWORD:-reachinbox}` (defaults to `reachinbox` for local dev). Set `POSTGRES_PASSWORD` when starting Docker and use the same value in `DATABASE_URL`.

### Frontend (`frontend/.env`)

```env
VITE_API_URL=http://localhost:4000
```

Secrets are read only from the backend environment and are never exposed to the frontend. `backend/.env` is git-ignored; only `.env.example` is committed.

---

## Google OAuth Setup

1. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials), create an **OAuth 2.0 Client ID** (Web application).
2. Add the authorized redirect URI:
   ```
   http://localhost:4000/api/auth/google/callback
   ```
3. Copy `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` into `backend/.env`.

Login flow (with CSRF state protection):

```text
React Login → GET /api/auth/google
  → server generates 32-byte random state, stores it in an httpOnly cookie
    (reachinbox_oauth_state, 10-minute TTL) and redirects to Google with state=
  → Google → GET /api/auth/google/callback?code=...&state=...
  → server always clears the state cookie, then verifies the returned state
    against the cookie with crypto.timingSafeEqual (fails closed on mismatch)
  → exchanges code, verifies the ID token, upserts the User
  → sets the httpOnly JWT session cookie → redirects to /dashboard
```

Callback failure redirects: `?error=missing_google_code`, `?error=invalid_oauth_state`, `?error=google_auth_failed`.

---

## Ethereal SMTP Setup

Create credentials at https://ethereal.email and set `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM` in `backend/.env`. Test the connection and send a sample email:

```bash
npm run test:smtp --workspace backend -- recipient@example.com
```

The script prints the message ID and the Ethereal preview URL (open it in a browser to see the rendered email).

---

## Database Schema

### `User`

| Column | Type | Notes |
|---|---|---|
| id | String | PK, cuid |
| googleId | String? | unique |
| passwordHash | String? | bcrypt, for email/password login |
| name | String | |
| email | String | unique |
| avatar | String? | Google picture |
| createdAt / updatedAt | DateTime | |

### `Sender`

| Column | Type | Notes |
|---|---|---|
| id | String | PK, cuid |
| userId | String | FK → User (cascade) |
| name | String | |
| email | String | |
| | | `@@unique([userId, email])` |

### `EmailJob`

| Column | Type | Notes |
|---|---|---|
| id | String | PK, cuid |
| userId | String | FK → User (cascade) |
| senderId | String | FK → Sender (restrict) |
| recipient | String | |
| subject | String | |
| body | String | |
| attachments | Json? | `[{ filename, content, contentType }]` |
| scheduledAt | DateTime | |
| sentAt | DateTime? | |
| status | EmailJobStatus | `scheduled / queued / processing / sent / failed` (default scheduled) |
| bullmqJobId | String? | deterministic BullMQ job id |
| attempts | Int | default 0 |
| error | String? | last failure message |
| hourlyLimit | Int? | per-request override, capped by env |
| createdAt / updatedAt | DateTime | |

Indexes: `[userId, status, scheduledAt]`, `[senderId, status, scheduledAt]`, `[bullmqJobId]`, and a **unique dedup index** `[userId, senderId, recipient, subject, md5(body), scheduledAt]` (created by the `dedupe_email_jobs` migration; md5 keeps the b-tree index within Postgres's index-row size limit for long bodies).

### Migrations

```text
20260813073402_add_email_password_auth
20260813084110_add_attachments_to_emailjob
20260813120000_dedupe_email_jobs
```

(The exact timestamps include earlier `init` and `add_hourly_limit` migrations from the initial scaffold.)

---

## REST API

Base URL: `http://localhost:4000`. All `/api/emails/*` and `/api/auth/me|logout` routes require the session cookie. API errors use this shape:

```json
{ "message": "Human readable error", "details": "optional" }
```

### Health

```
GET /api/health → { "ok": true }
```

### Auth

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/auth/google` | Redirect to Google with CSRF state cookie |
| GET | `/api/auth/google/callback` | OAuth callback (code + state verification) |
| POST | `/api/auth/login` | Email/password login → session cookie |
| GET | `/api/auth/me` | Current user (requires auth) |
| POST | `/api/auth/logout` | Clears the session cookie (204) |

Login request:

```json
{ "email": "you@example.com", "password": "at-least-8-chars" }
```

### Emails

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/emails/schedule` | Schedule emails (JSON or multipart/form-data) |
| GET | `/api/emails/scheduled` | List `scheduled / queued / processing` jobs |
| GET | `/api/emails/sent` | List `sent / failed` jobs |
| GET | `/api/emails/:id` | Single job (owner only) |

Schedule request (JSON):

```json
{
  "subject": "Quick question",
  "body": "Hi, wanted to reach out...",
  "recipients": ["lead1@example.com", "lead2@example.com"],
  "startTime": "2026-08-13T12:30:00.000Z",
  "delayBetweenEmails": 60,
  "hourlyLimit": 100
}
```

- `startTime` or `scheduledAt` — required ISO timestamp (must be in the future).
- `delayBetweenEmails` — **seconds** between consecutive recipients (0–3600). The backend converts to ms internally.
- `recipients` — 1–5000 email addresses; duplicates are normalized (trimmed, lowercased) and removed.
- `hourlyLimit` — per-sender hourly cap override (clamped to `MAX_EMAILS_PER_HOUR_PER_SENDER`).
- `senderId` OR `sender` (`{ name, email }`) — optional; defaults to the user's own email/name.
- `attachments` — optional `[{ filename, content (base64), contentType }]`; `contentType` must be an image MIME type.

Multipart equivalent uses repeated `recipients[]` fields and `attachments` file field. Multer enforces a 10 MB file size limit and a server-side **image MIME allowlist** (`image/jpeg`, `image/png`, `image/gif`, `image/webp`, `image/avif`, `image/bmp`, `image/tiff`) before any file is accepted.

Schedule response:

```json
{
  "count": 2,
  "jobs": [
    {
      "id": "cmx...",
      "recipient": "lead1@example.com",
      "subject": "Quick question",
      "body": "Hi, wanted to reach out...",
      "scheduledAt": "2026-08-13T12:30:00.000Z",
      "sentAt": null,
      "status": "queued",
      "bullmqJobId": "email-job-cmx...-1783488000000",
      "attempts": 0,
      "error": null,
      "hourlyLimit": 100,
      "sender": { "id": "...", "name": "...", "email": "you@example.com" },
      "createdAt": "...",
      "updatedAt": "..."
    }
  ]
}
```

---

## Scheduling Pipeline

`POST /api/emails/schedule`:

1. `requireAuth` validates the JWT session cookie and loads the user.
2. Zod validates the payload (`scheduleEmailSchema`); malformed input → 400.
3. Resolves the sender (existing owned `Sender` or upsert from the user's email/name).
4. Normalizes/dedupes recipients, computes each recipient's `scheduledAt` with `startTime + index * delayBetweenEmails (ms)`.
5. Skips planned jobs that already exist for the same user/sender/recipient/subject/body/time.
6. Creates each new `EmailJob` (status `scheduled`) **individually**. If a `P2002` unique-constraint error fires (concurrent duplicate request), it re-fetches the winner's row and treats it as already-scheduled instead of duplicating.
7. For each created job, adds a BullMQ delayed job and updates the row to `queued` with its `bullmqJobId`.

BullMQ job IDs are deterministic: `email-job-{emailJobId}` or `email-job-{emailJobId}-{epochMs}` (dashes; BullMQ rejects colons). The delay is `max(scheduledAt − now, 0)`, so scheduled jobs sit in Redis until their time arrives.

---

## Worker Lifecycle

Run (standalone process):

```bash
npm run dev:worker --workspace backend
```

Per-job flow (`processEmailJob`):

```text
load EmailJob → idempotency checks → atomic transition to processing
→ Redis rate-limit reservation → Ethereal SMTP → status=sent / failed
```

All of this — the `updateMany → processing` transition, rate-limit reservation, SMTP send, and the sent/failed update — runs inside a single `try/catch` so that **any failure releases the job back to `failed`** (a processable status) with `attempts+1`. BullMQ then retries it (3 attempts, exponential backoff 5 s). Without this, a Redis hiccup or crash after the transition would leave the row stuck in `processing` and every retry would be skipped.

Idempotency checks before and during processing:

- If `sentAt` is set or status is `sent` → skip.
- If the stored `bullmqJobId` differs from the BullMQ job id → throw (mismatch).
- `updateMany` transitions only if status is `scheduled/queued/failed`; if zero rows changed, the job is skipped as already-sent or already-processing (another worker owns it).

On send failure the error is rethrown so BullMQ's retry/backoff applies; the row records `attempts` and `error`.

---

## Rate Limiting

Per-sender throttling is enforced in Redis with a single atomic Lua script in `reserveEmailSendSlot`:

- Hourly counter key: `email-rate:{senderId}:{hourWindow}` (capped at `MAX_EMAILS_PER_HOUR_PER_SENDER`).
- Minimum-delay key: `email-delay:{senderId}` (default 2 s between sends to the same sender).

The script checks the hourly counter, checks the minimum-delay timestamp, increments the counter when allowed, and writes the next allowed send time — all in one `EVAL`, so concurrent workers cannot overshoot the limit.

If a send is denied:

- `hourly_limit` → rescheduled to the start of the next hour window.
- `minimum_delay` → rescheduled to the minimum-delay timestamp.

The denied job is **re-added to BullMQ as a delayed job** (never dropped), and the Postgres row is updated to `queued` with the new `scheduledAt` and `bullmqJobId`.

---

## Orphan Email Sweeper

If `emailQueue.add()` fails (e.g., Redis down during scheduling) a row can stay `scheduled` with no live BullMQ job, or a queued row can lose its job if Redis drops it — in both cases the email silently never sends.

`email-sweeper.service.ts` reconciles this:

1. Finds `scheduled`/`queued` rows whose `scheduledAt` is more than 60 s past.
2. Loads the set of live BullMQ job IDs (`waiting/delayed/active/prioritized`).
3. Marks any candidate whose `bullmqJobId` is missing or not live as `failed` with the error `"Orphaned email job: no live queue job was found for it."` — using a status-guarded `updateMany` so it never clobbers a worker that just claimed the row.

The sweeper runs as a self-rescheduling BullMQ delayed job (`email-sweeper-queue`, every `EMAIL_SWEEPER_INTERVAL_MS`, default 5 min) plus an immediate sweep on server boot. Wired into `server.ts` with graceful shutdown.

---

## Idempotency & Duplicate Protection

- Deterministic BullMQ job IDs + stored `bullmqJobId` prevent double enqueue of the same row.
- The guarded `processing` transition makes concurrent workers safe (exactly one claims a job).
- Application-level duplicate check + the DB unique index (`userId, senderId, recipient, subject, md5(body), scheduledAt`) make concurrent identical schedule requests safe: the second request gets a `P2002` and returns the winner's row.
- Once `sent`, the worker never re-sends.

SMTP cannot provide mathematically perfect exactly-once delivery; this implementation provides practical idempotency around application state and retries.

---

## Restart Persistence

- Job state lives in PostgreSQL; delayed queue state lives in Redis/BullMQ with append-only persistence (`redis-server --appendonly yes`).
- Future jobs remain in Redis after a restart and are picked up by the worker.
- The sweeper heals any scheduled rows that lose their queue job while the system was down.

---

## Frontend

### Routing (`App.tsx`)

| Route | Page |
|---|---|
| `/login` | LoginPage |
| `/dashboard` | DashboardPage |
| `/scheduled` | EmailListPage (scheduled/queued/processing) |
| `/sent` | EmailListPage (sent/failed) |
| `/compose` | ComposePage |
| `*` | redirect → `/dashboard` |

Protected routes are wrapped in `ProtectedRoute` (redirects to `/login` when unauthenticated) inside the `AppLayout` shell (sidebar, topbar, logout).

### Pages

- **LoginPage** — "Continue with Google" link (`/api/auth/google`) plus email/password form. Shows Google callback errors (`missing_google_code`, `invalid_oauth_state`, `google_auth_failed`) from the URL query string.
- **DashboardPage** — stat cards (Scheduled / Processing / Sent / Failed), a failed-jobs warning banner, recent-activity feed, and preview lists for scheduled and sent emails, driven by `useEmailDashboard` (parallel calls to `/scheduled` and `/sent`).
- **ComposePage** — subject, body, lead upload, start time (local `datetime-local`, defaults to now + 5 min), delay (seconds), hourly limit, and image attachments. Submits as JSON, or as `multipart/form-data` when files are attached.
- **EmailListPage** — table/card list of jobs with a refresh button; clicking a row opens `EmailJobDetailsModal` (sender, recipient, status, timestamps, attempts, delivery error, body). Uses `useEmailJobs(type)`.

### Lead parsing (`utils/leadParser.ts`)

`parseLeadText` extracts email candidates with a regex, trims/lowercases/normalizes `mailto:` prefixes, drops entries over 254 chars, dedupes, and returns `{ filename, validEmails, invalidEntries (max 20), duplicateCount, totalMatches }`. Only `.csv`/`.txt` files are accepted. `LeadUpload` supports drag-and-drop and shows valid/invalid/duplicate summaries.

### Data fetching (`services/api.ts`)

`apiRequest` wraps `fetch` with `credentials: "include"` (session cookie), JSON or FormData bodies, and surfaces backend error `message`s.

---

## Testing

Two Vitest suites. **All external dependencies (Redis, Prisma, BullMQ, SMTP) are mocked, so no Docker/database is required to run them.**

```bash
npm test --workspace backend     # backend: 7 files, 73 tests
npm test --workspace frontend    # frontend: 2 files, 19 tests
npm run lint                     # tsc --noEmit on both workspaces
```

| Suite | Files | Tests | Highlights |
|---|---|---|---|
| Backend | `email.validator` 15 | schedule validation, recipients, delay bounds (seconds, ≤3600), attachments, image MIME allowlist |
| | `rate-limit.service` 6 | hourly/delay windows, allowed/denied reservations, Lua args |
| | `email.service` 15 | validation 400s, dedup, delay spacing, duplicate skip, JsonNull attachments, queueing, lists, 404s, unique-constraint race |
| | `email-worker.service` 12 | skip rules, mismatch, concurrent claim, reschedule, send success, SMTP failure, crash safety |
| | `email-sweeper.service` 7 | orphan detection, live-job skip, grace cutoff, live states, mid-sweep race |
| | `auth.service` 9 | password login, JWT round-trip, OAuth state create/verify, state in Google URL |
| | `auth.controller` 9 | redirect state cookie, callback (missing code, state mismatch, cookie clear, success, failure), login/logout/me |
| Frontend | `leadParser` 9 | CSV/TXT parsing, dedup, mailto stripping, invalid entries, limits |
| | `ComposePage` 10 | form validation, local-time default, seconds-based delay payload, success + navigation |

See `TESTING.md` for the full per-file breakdown.

---

## Scripts & Commands

```bash
# Root (npm workspaces)
npm run dev          # backend + frontend
npm run dev:worker   # email worker (+ sweeper)
npm run dev:all      # backend + frontend + worker
npm run build        # tsc + vite build for both workspaces
npm run lint         # typecheck both workspaces
npm run prisma:generate

# Backend
npm run test --workspace backend
npm run lint --workspace backend
npm run prisma:migrate --workspace backend
npm run test:smtp --workspace backend -- recipient@example.com

# Frontend
npm run test --workspace frontend
npm run lint --workspace frontend
```

---

## Security Notes

- OAuth CSRF protection via cryptographically random `state` compared with `crypto.timingSafeEqual`; the state cookie is httpOnly and always cleared on callback.
- Session cookie is `httpOnly`, `sameSite: lax`, `secure` in production, 7-day expiry; JWT signed with a 32+ char secret.
- Passwords hashed with bcrypt; no registration endpoint exists (users come from Google or a pre-seeded passwordHash).
- Attachments restricted to image MIME types both in multer and in the Zod schema; 10 MB size cap.
- No `any` types in production code; secrets only in the (git-ignored) backend `.env`.

---

## Assignment Compliance

- **TypeScript** throughout (strict, NodeNext on the backend).
- **Express** REST API.
- **BullMQ + Redis** for all scheduled work — **no `cron`** (the recurring sweeper is a self-rescheduling BullMQ delayed job, not a cron).
- **PostgreSQL via Prisma** as the durable source of truth.
- **Ethereal SMTP** for sending + previewable messages.
- Google OAuth login, email/password login, lead-upload compose UI, scheduled/sent dashboards.

---

## Known Follow-ups

- The Google OAuth client secret and JWT session secret have both been rotated; the current values live only in the git-ignored `backend/.env`.
- If you run `prisma migrate dev` after a future schema change, re-apply the `email_jobs_dedup_key` index (it is an md5-based unique index created via raw SQL and may be dropped as unmanaged drift).
