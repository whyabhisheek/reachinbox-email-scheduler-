# ReachInbox Email Scheduler — Hosted Access Guide

This project is deployed live. Use these steps to access and test it.

## 1. First open the hosted backend

Open this URL in your browser:

**https://reachinbox-email-scheduler-xh8i.onrender.com/api/health**

You should see: `{"ok":true}`

This confirms the backend (API + worker + database) is running. If it takes ~30–60s to load the first time, it's the free-tier cold start — just wait.

## 2. Then open the hosted frontend

Open this URL in your browser:

**https://reachinbox-emailscheduler-gamma.vercel.app**

The login page will appear.

## 3. Log in

Use either:

- **Google OAuth** → click **Continue with Google** and choose your account.
- **Superadmin** (recommended — works on any network/laptop, since the app runs on free-tier hosting, not AWS/GCP):
  - Email: `abhishekmj5560@gmail.com`
  - Password: `Reachinbox@2026`

## 4. Test the flow on the live site

1. After login, go to **Schedule**.
2. Add recipients (paste emails, one per line — e.g. 20 test emails).
3. Enter a Subject and Body, pick the send time (or send now), click **Schedule**.
4. Jobs appear under **Scheduled** and start sending automatically (~2s apart).
5. They move to **Sent** one by one. Check the emails at https://ethereal.email using the `SMTP_USER` / `SMTP_PASSWORD` set in `backend/.env`.

> Note: on the free Render tier the backend sleeps after ~15 min idle — if nothing sends, load step 1's URL again to wake it, then reload the frontend.

## Helpful hosted links

| What | URL |
|---|---|
| Backend API | https://reachinbox-email-scheduler-xh8i.onrender.com/api/health |
| Frontend | https://reachinbox-emailscheduler-gamma.vercel.app |
| Inbox preview (Ethereal) | https://ethereal.email |
