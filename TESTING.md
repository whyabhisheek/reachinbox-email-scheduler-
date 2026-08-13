# Testing Report

Status: **ALL TESTS PASSED** — backend 75/75, frontend 19/19.

Run both suites with `npm test` in the `backend/` and `frontend/` directories. All external dependencies (Redis, Prisma, BullMQ, SMTP) are mocked, so no Docker or database is required.

## Backend — 7 files, 75 tests

Command: `cd backend && npm test`

| File | Tests | Coverage |
|---|---|---|
| `src/validators/email.validator.test.ts` | 15 | Zod schedule validation: required start time, recipients (empty/invalid/max 5000), delay & hourly limit bounds (delay in seconds, max 3600), sender email, attachments, image MIME allowlist (accept/reject), `isAllowedAttachmentMimeType` helper |
| `src/services/rate-limit.service.test.ts` | 6 | Redis key/window math, allowed & denied reservations (`hourly_limit`, `minimum_delay`), env cap, Lua script arguments |
| `src/services/email.service.test.ts` | 15 | Schedule validation 400s, recipient dedup, delay spacing (seconds), duplicate-job skip, `Prisma.JsonNull` attachments, BullMQ queueing, list/get-by-id, sender ownership 404, unique-constraint race treated as existing job |
| `src/services/email-worker.service.test.ts` | 13 | Missing job, already-sent skip, job-id mismatch, concurrent-claim skip, stale-processing reclaim after crashed worker, reschedule on rate limits, send success, SMTP failure → failed status, crash safety (rate limiter / DB failure releases job back to failed for retry) |
| `src/services/email-sweeper.service.test.ts` | 8 | Orphan with no BullMQ job id marked failed, job id not live marked failed, live job skipped, stale processing orphan marked failed, past-due cutoff query, live-state search, empty sweep, mid-sweep claim race not counted |
| `src/services/auth.service.test.ts` | 9 | Password login (success/unknown/wrong/no hash), email normalization, JWT round-trip + foreign-secret rejection, OAuth state create/verify, state in Google URL |
| `src/controllers/auth.controller.test.ts` | 9 | OAuth redirect state cookie, callback (missing code, state mismatch, cookie clear, success, failure), login/logout/getMe |

## Frontend — 2 files, 19 tests

Command: `cd frontend && npm test`

| File | Tests | Coverage |
|---|---|---|
| `src/utils/leadParser.test.ts` | 9 | CSV/TXT parsing, dedup counting, mailto stripping, case normalization, invalid entries, 254-char limit, supported file types |
| `src/pages/ComposePage.test.tsx` | 10 | Form validation (subject, body, leads, past start time, negative delay, zero hourly limit), local-time default, submit payload with delay in seconds, success message, navigation |

## Environment

- Vitest 4.x (backend: node env; frontend: jsdom + Testing Library)
- `NODE_ENV=test` and isolated env values loaded from `backend/test/setup.ts`
- Prisma client (`../config/prisma.js`), Redis (`../config/redis.js`), queue, and SMTP modules mocked with `vi.mock`
- Both `npm run lint` (tsc) checks pass with the test files included
