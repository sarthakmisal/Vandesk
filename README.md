# VanDesk (Ionic app)

Fees, student onboarding and trips for school vans, with three roles (driver, parent, admin).
Ionic 9 + Angular 22 (standalone, zoneless) + Capacitor 8. This project is the **app only**; the API (Node + PostgreSQL/Neon) is the separate `back` / `backend` project next to it.

```
npm install                  # Node 22.22.3+ (Angular 22)
```

## Run

| Goal | Command | Needs |
| --- | --- | --- |
| Real data in the browser (live reload) | `npm start` -> http://localhost:4200 | backend running on :3000 (`npm run dev` in the backend folder) |
| Demo, no backend at all | `npm run start:demo` | nothing |
| App + API on one server | `npm run build:back`, then `npm run dev` in the backend -> http://localhost:3000 | backend folder next to this one |
| Android / iOS app | see below | backend URL in `src/environments/environment.native.ts` |

`npm start` forwards `/api` to `http://localhost:3000` (`proxy.conf.json`). Sign in with the admin email you put in the backend seed; in development the 6-digit code is shown on the sign-in screen.
Demo accounts (`start:demo` only): drivers Ramesh / Suresh, parent Mr. Patil, admin.

## Mobile app (Capacitor)

1. Edit `apiUrl` in `src/environments/environment.native.ts` (the app has no same-origin server, so the URL must be absolute; production should be https).
   - Android emulator -> your PC: `http://10.0.2.2:3000/api`. Real phone on Wi-Fi: `http://<PC-LAN-IP>:3000/api`.
   - Plain-http dev backends need `CAP_CLEARTEXT=1` (Windows cmd: `set CAP_CLEARTEXT=1`) before the next step.
2. First time only: `npx cap add android` (and `npx cap add ios` on a Mac).
3. `npm run android` (or `npm run ios`): builds the native web bundle, syncs it and opens Android Studio / Xcode. Run from there.

The backend already allows the app's origins (`https://localhost`, `capacitor://localhost`, ...). Extra origins: `CORS_ORIGINS=a,b` in the backend `.env`.

## Scripts

`start`, `start:demo`, `build` (web, served by the backend), `build:back` (build + copy into the backend `public/`), `build:demo` (static demo for any file host), `build:native`, `cap:sync`, `android`, `ios`, `test:unit`, `test:e2e` (Playwright, demo mode), `lint`.

## Roles (RBAC)

| Role | Home | Can | Cannot |
| --- | --- | --- | --- |
| `driver` | `/driver` (Fees, Students, Trip, Ledger) | Onboard students into **own vehicle**, record fees (undo), reverse payments, send reminders, run pickup and drop | Touch other vehicles; parent or admin actions |
| `parent` | `/parent` | **Own children only**: track the van, stops timeline, read-only fees, Going / Not going | Any other child; fees, students, trip control |
| `admin` | `/admin` | Onboard / edit / retire buses, assign drivers, manage stops, bus-wise fee plans, add or move students to any bus, overview | Daily operations |

Enforced in route guards (`core/guards.ts`), in every repo, and on the server for every endpoint (the UI is never the security boundary).

## Layout

```
src/app/core        api client, auth, guards, mock data, providers (mock <-> http repos)
src/app/{fees,students,trip,admin,ledger,parent,login,tabs}   feature pages; each has repo.ts (mock) + http.repo.ts (API)
src/app/{profile-bar,ui}     shared header, toast, icons
src/environments    environment.ts (dev), prod, demo, native
```

Data access goes through abstract repos (`FeesRepo`, `StudentsRepo`, `TripRepo`, `AdminRepo`); `core/providers.ts` picks the mock or the HTTP implementation from the environment. Unit tests always run on the mock (`ng test` uses the demo environment).
