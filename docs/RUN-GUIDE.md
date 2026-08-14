# ReachInbox Email Scheduler — Run & Access Guide

## Live Demo (Deployed)

| Service | URL |
|---|---|
| **Frontend (Vercel)** | https://reachinbox-emailscheduler-gamma.vercel.app |
| **Backend API (Render)** | https://reachinbox-email-scheduler-xh8i.onrender.com/api/health |
| **Queue (Upstash Redis)** | `rediss://default:<token>@square-shark-78758.upstash.io:6379` |
| **Database (Render Postgres)** | hosted on Render (free tier) |

## Login Credentials

There are **two ways to log in** on the live site:

1. **Google OAuth** — click **Continue with Google** and pick your account.
   > If Google login is blocked on your network/laptop (the app runs on free-tier hosting, not AWS/GCP), use the superadmin login below instead.

2. **Superadmin (email + password)** — use:
   - Email: `abhishekmj5560@gmail.com`
   - Password: `Reachinbox@2026`

---

## How to Run Locally

### 1. Prerequisites

- Node.js v18+ and npm
- Docker (for PostgreSQL + Redis)
- The repo cloned: `https://github.com/whyabhisheek/reachinbox-email-scheduler-`

### 2. Start the infrastructure (PostgreSQL + Redis)

```bash
docker compose up -d
```

### 3. Install dependencies & set up env

```bash
npm install
```

Copy the example env files and fill in real values:

```bash
copy backend/.env.example backend/.env
copy frontend/.env.example frontend/.env
```

**Required values in `backend/.env`:**

| Variable | Value |
|---|---|
| `DATABASE_URL` | `postgresql://reachinbox:reachinbox@localhost:5433/reachinbox_scheduler?schema=public` |
| `REDIS_URL` | `redis://localhost:6380` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | from Google Cloud Console |
| `GOOGLE_CALLBACK_URL` | `http://localhost:4000/api/auth/google/callback` |
| `JWT_SESSION_SECRET` | a long random string (min 32 chars) |
| `SMTP_USER` / `SMTP_PASSWORD` / `SMTP_FROM` | from https://ethereal.email |

`frontend/.env`:

| Variable | Value |
|---|---|
| `VITE_API_URL` | `http://localhost:4000` |

### 4. Start the backend FIRST

Open a terminal and run:

```bash
npm run dev --workspace backend
```

Wait for: `Backend listening on http://localhost:4000`

### 5. Start the worker (email sending engine)

Open a **second** terminal and run:

```bash
npm run dev:worker --workspace backend
```

### 6. Start the frontend

Open a **third** terminal and run:

```bash
npm run dev --workspace frontend
```

Then open **http://localhost:5173** in your browser.

> Alternatively, run all three in one terminal: `npm run dev:all`

### 7. Log in

Open http://localhost:5173 → the login page appears.

- **Google**: click **Continue with Google**, or
- **Superadmin**: use the email/password above.

---

## Quick Demo Flow (for the demo video)

1. Log in with the superadmin credentials.
2. Go to **Schedule** → upload `leads20.csv` (or type recipients) → enter a Subject + Body → set the send time → click **Schedule**.
3. Jobs appear under **Scheduled**.
4. Emails start sending automatically, ~2s apart (rate-limit trickle) — they move to **Sent** one by one.
5. **Restart test**: press `Ctrl+C` on the backend+worker terminals mid-burst, wait ~20–30s, start them again — the remaining emails are picked up automatically (sweeper + crash-recovery) and finish sending.
6. Check the received emails at https://ethereal.email (login with your `SMTP_USER` / `SMTP_PASSWORD`).

## Helpful Commands

| Task | Command |
|---|---|
| Run tests (backend) | `npm run test --workspace backend` |
| Run tests (frontend) | `npm run test --workspace frontend` |
| Type-check | `npm run lint` |
| Check job statuses in DB | `'SELECT status, COUNT(*) FROM "EmailJob" GROUP BY status;' \| docker exec -i reachinbox-postgres psql -U reachinbox -d reachinbox_scheduler` |
| Create a superadmin user | `npm run create:user --workspace backend -- email password name` |
