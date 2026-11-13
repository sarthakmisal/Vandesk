# VanDesk

Fees, student onboarding and trips for school vans, with three roles (driver, parent, admin).
Ionic 9 + Angular 22 (standalone, zoneless) in the layout of the Ionic `tabs` starter, plus a small Node + PostgreSQL API. The web build goes to **`www/`** and the Node server serves it.

## Quick start

```bash
npm ci                       # Node 22.22.3+ or 24.15+ (Angular 22 requirement; the API runs TypeScript natively)
npm start                    # demo mode: in-memory data, no backend, http://localhost:4200
```

**Static-only deployment (no API yet, demo accounts):**

```bash
npm run build:static-mock    # produces a production build in www/ but keeps mock login + in-memory data
```

Serve `www/` from any static backend. This mode does not call `/api/*`.

**With the real API** (data is saved, email-OTP sign-in, ledger, reminders):

```bash
npm run build                # -> www/
npm run serve                # API + app on http://localhost:3000, seeded demo data, built-in dev database (./data)
# or live-reload the UI against the API:   npm run dev:api   (terminal 1)   npm run start:api   (terminal 2)
```

Sign in with `ramesh@vandesk.test` (driver, Van), `suresh@vandesk.test` (driver, Bus), `mrpatil@mail.test` (parent of Akshay and Ishita), `admin@vandesk.test`.
Without SMTP the code is printed in the server log and shown on the sign-in screen (development only, never in production).

## Production

Set the variables in `.env.example`, then `npm ci && npm run build && node server/index.ts`.

- **Database:** `DATABASE_URL` -> PostgreSQL (tables are created on start from `server/schema.sql`). Without it the server uses PGlite (real Postgres compiled to WASM) in `./data`, which is for development only.
- **Email:** SMTP through Nodemailer. Use a transactional provider and set SPF/DKIM on your sender domain; consumer mailboxes have low daily limits and OTP emails must arrive fast.
- **Jobs** (call with `Authorization: Bearer $CRON_SECRET`; any scheduler works; schedules below are UTC and safe to run late or twice):

| Job                                                                           | Endpoint                                | Suggested                       |
| ----------------------------------------------------------------------------- | --------------------------------------- | ------------------------------- |
| Generate this month's dues                                                    | `GET /api/internal/jobs/generate-dues`  | daily `40 18 * * *` (00:10 IST) |
| Fee reminders (reminder days 1, 5, 10, 15, then weekly; 09:00-20:00 IST only) | `GET /api/internal/jobs/send-reminders` | daily `30 4 * * *` (10:00 IST)  |
| Remove raw GPS older than 90 days                                             | `GET /api/internal/jobs/retention`      | daily `0 21 * * *`              |

- **HTTPS is required** (the session token is sent as a bearer header). The server is a normal long-running Node process; a serverless host would need an adapter.

## Roles (RBAC)

| Role     | Home                                     | Can                                                                                                                                                                           | Cannot                                        |
| -------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `driver` | `/driver` (Fees, Students, Trip, Ledger) | Onboard students into **own vehicle**, record fees (2 taps, undo), set the monthly fee, reverse payments with a reason, send reminders, run morning pickup and afternoon drop | Touch other vehicles; parent or admin actions |
| `parent` | `/parent`                                | **Own children only**: track the van, stops timeline, last-stop map link, read-only fees, Going / Not going (locked once the trip starts; after 05:00 IST it is flagged late) | Any other child; fees, students, trip control |
| `admin`  | `/admin`                                 | All vehicles overview (seats, pending fees, trip status), suspend / activate drivers                                                                                          | Daily operations                              |

Enforced three times: route guards (`core/guards.ts`), checks inside every repo (mock) and **on the server for every endpoint** (`server/auth.ts`, `server/domain.ts`).
A suspended driver's token stops working immediately (401).

## What is in it

- **Money** is integer paise. Payments are append-only: a correction is a reversal row with a reason. Allocation is oldest due first; overpayment becomes advance credit; retries are safe (`clientUuid`).
- **Trips:** one tap per student (tap again = undo), "not there", end never blocked. **GPS is read only at the tap**, never in the background; a missing or poor fix never blocks the tap and a poor fix is not shown to parents. Parents see the last stop, "N stops before yours", typical time and a map link rounded to about 100 m.
- **Email (Nodemailer):** OTP, payment receipt, invite to a new guardian, fee reminders. Every message is 1:1 and deduplicated (`notification_log`).
- **UI:** big targets, 2-tap payment, English / Hindi / Marathi, light theme, no redirects in the driver flow, hash routing so refresh and deep links never white-screen.

## Structure

```
server/                    Node API (Express 5, pg / PGlite, Nodemailer, zod). Runs .ts directly, no build step.
  app.ts routes · domain.ts rules · auth.ts · db.ts · mail.ts · schema.sql · seed.ts · app.test.ts (16 tests)
src/app/
  core/ auth.service · guards · api (HttpClient + interceptor) · geo · i18n · providers (mock | http)
  tabs/ fees/ students/ trip/ ledger/ parent/ admin/ login/ profile-bar/
```

Each feature talks to an abstract repo (`FeesRepo`, `StudentsRepo`, `TripRepo`, `AdminRepo`) with two implementations: in-memory mock (`npm start`, unit tests) and `Http*Repo` (production build and `start:api`).

## Checks

`npm run lint` · `npm run test:unit` (31 Vitest tests) · `npm run test:api` (16 API tests on a real Postgres engine) · `npm run typecheck:api` · Prettier · `tsc -p tsconfig.e2e.json`.

## Not built yet

Offline queue for taps and payments, in-app map (a link is used), per-student fee override and proration rules, guardian consent screen and data export, CSV import, multi-vehicle agency owner role, WhatsApp / SMS / push channels, payment gateway, rate limiting beyond OTP.
