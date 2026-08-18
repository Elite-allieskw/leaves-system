# Leaves Maintenance System — Sprint 0/1 Scaffold

This is the starting codebase for Sprint 0/1, matching the technical build plan and Phase 1 sprint plan agreed with Leaves. The theme (colors, logo placeholder) matches Leaves' brand from their Instagram — see `claude/leaves-brand-notes.md` in the project.

## Start here: verify it actually runs, before building more
Everything in this repo has been typechecked but never actually run end-to-end (it was built in a sandboxed environment that can't launch dev servers). **Before adding anything else — Phase 2, more UI, a deploy — run it locally and click through it.** Catching a real bug now is far cheaper than finding it after three more phases are built on top. Only deploy to staging (`STAGING_DEPLOY.md`) once local verification passes.

The "Getting it running locally" section below uses Docker Compose for the database, so this needs no cloud account or signup — just Docker.

**Quick smoke test once it's running** (do this before moving on):
1. Log in as `owner@leaves.test` — do you land on the Owner dashboard?
2. Run `npm run prisma:seed:demo`, refresh the Clients page — do the 15 `[DEMO]` clients show up, with garden profiles?
3. Open a demo client — does the visit history, plant list, and ticket list render correctly?
4. Log a new visit with a photo, check "raise a ticket" — does it save, and does the ticket show up on the Supervisor dashboard for that client's team? (Use a `demo-team-N@leaves.test` login to log the visit, not `team@leaves.test` — see "Testing team-scoped views" below for why.)
5. Try the Clients page filters (team, contract type, plant) — do they actually narrow the list?
6. Log out and confirm protected pages redirect to `/login`.

If any of these break, that's real signal — fix it here before layering on more scope.

## Structure
```
backend/   Node + Express + TypeScript API, Prisma ORM, PostgreSQL
web/       React + Vite + TypeScript dashboard (Login, Clients, Log Visit, Supervisor & Owner dashboards)
```

## What's already scaffolded
- Full Prisma schema matching the data model from the build plan: User (with password), Team, Client, GardenProfile, Visit, Ticket, ClientReport, Payment
- **Login flow, end to end:**
  - `POST /auth/login` — email + password → JWT
  - `GET /auth/me` — resolve the current token against fresh DB data
  - `POST /auth/users` — owner-only, provisions new accounts (this is an internal tool, so there's no public self-signup)
  - A seed script (`npm run prisma:seed`) creates one login per role to get started — see credentials below
  - React side: `/login` page, an `AuthContext` that holds the session, a `RequireAuth` route guard (redirects to login, and can restrict by role), and a header that shows the signed-in user + sign-out button and only shows nav links the user's role can access
- Express API with JWT auth middleware + role-based access (`requireAuth`, `requireRole`)
- **Photo/video storage:** `POST /visits` uploads straight to object storage via `src/lib/storage.ts` — works with AWS S3 or Cloudflare R2 (same S3-compatible API, just set `S3_ENDPOINT` for R2). Falls back automatically to local disk if `S3_BUCKET` isn't set, so the app still runs without cloud credentials for local dev — but that fallback isn't durable storage and must not be relied on past local testing (see `.env.example` for the full config).
- Routes: `/clients` (CRUD + search/filter), `/visits` (log a visit with photo + optional video + optional inline ticket), `/tickets` (raise/list/update), `/teams` (list, for filters), `/dashboard/supervisor`, `/dashboard/owner`
- **Ticketing wired into the visit flow (Sprint 2):** the Log a Visit form has a "this needs follow-up" checkbox — checking it raises a ticket (standard or emergency) in the same request as the visit. New tickets trigger a notification via `src/lib/notify.ts` (email if SMTP is configured, otherwise logs to the console so it still works without email credentials — see `.env.example`).
- **Client search/filter (Sprint 2):** the Clients page can filter by name, team, contract type, and valuable plant (`GET /clients?q=&teamId=&contractType=&plant=`); plant options are pulled from real data via `GET /clients/meta/plant-options`, not hardcoded.
- React web app: Clients list (with filters), Client detail (garden profile + visit/ticket history with status badges, photo/video links), Log a Visit form (photo + optional video + optional ticket), Supervisor dashboard, Owner dashboard — all themed to the Leaves brand palette

## What's intentionally stubbed (build these next, per the sprint plan)
- **Real client data migration** — there's a *demo* seed (`npm run prisma:seed:demo`, see below) with 15 fictional example clients, but importing Leaves' actual 120 clients needs the real source data (spreadsheet, WhatsApp export, etc.) and hasn't been built
- **A real (bucket-backed) storage account** — the code supports S3/R2, but nothing is provisioned yet; see "Setting up photo/video storage" below
- **Real email delivery for ticket notifications** — the code supports SMTP, but nothing is configured yet; falls back to console logging
- **Offline sync, auto-generated client reports, push emergency alerts, client self-service tickets, payments** — these are Phase 2/3 by design; not part of this scaffold
- **Real logo** — the header/login logo is a placeholder approximation, not Leaves' actual artwork

## Getting it running locally

### Database (Docker — no account needed)
```bash
docker compose up -d          # starts local PostgreSQL on :5432
```
This matches the `DATABASE_URL` already in `backend/.env.example`, so no changes needed there. If you'd rather use a database you already have running, just point `DATABASE_URL` at it instead.

### Backend
```bash
cd backend
cp .env.example .env         # DATABASE_URL already matches docker-compose.yml — no edits needed to just try it
npm install
npm run prisma:generate
npm run prisma:migrate        # creates tables from schema.prisma
npm run prisma:seed           # creates owner/supervisor/team_member logins (see below)
npm run dev                   # starts on :4000
```

### Web app
```bash
cd web
npm install
npm run dev                   # starts on :5173, proxies /api to the backend
```

### Seeded login credentials (change or delete these before going near production)
| Role | Email | Password |
|---|---|---|
| Owner | owner@leaves.test | ChangeMe123! |
| Supervisor | supervisor@leaves.test | ChangeMe123! |
| Team Member | team@leaves.test | ChangeMe123! |

Once logged in as owner, use `POST /auth/users` to create real accounts, then remove the seeded test accounts.

## Sample/demo data (not real clients)
To actually see the app working — clients, garden profiles, visit history, tickets, dashboards with numbers in them — without waiting for the real 120-client migration, run:
```bash
npm run prisma:seed:demo
```
This creates 6 demo teams and **15 fictional example clients**, each with a garden profile (varied size/shape/theme/valuable plants), a sample visit or two, and a few open tickets so the Supervisor/Owner dashboards have something to show. Everything it creates is prefixed `[DEMO]` so it's obviously not real data — safe to run against a staging database, and safe to delete at any time (`DELETE FROM "Client" WHERE id LIKE 'demo-%'` cascades through the related tables, or just reset the whole database). **Do not run this against a database that ever holds real client data without checking the ID prefixes don't collide.**

### Testing team-scoped views (Supervisor dashboard, Clients filters) with demo data
The `owner@leaves.test` / `supervisor@leaves.test` / `team@leaves.test` logins from the base seed (`npm run prisma:seed`) all belong to `seed-team-1`, which **owns none of the 15 demo clients** — those are spread across `demo-team-1` .. `demo-team-6`. Supervisor and team-member accounts only ever see clients/visits/tickets for their own team, so `supervisor@leaves.test` and `team@leaves.test` will always show an empty Clients page and an empty Supervisor dashboard against demo data — that's expected, not a bug.

To actually exercise team-scoped views (logging a visit as a team member, checking the resulting ticket shows up on that team's Supervisor dashboard, testing the Clients page's Team filter, etc.), the demo seed creates one team-member login per demo team instead:

| Login | Password | Team |
|---|---|---|
| `demo-team-1@leaves.test` | `ChangeMe123!` | Team 1 |
| `demo-team-2@leaves.test` | `ChangeMe123!` | Team 2 |
| … | | (same pattern through `demo-team-6@leaves.test`) |

`owner@leaves.test` isn't team-scoped and can always see everything, including a per-team view of the Supervisor dashboard via `GET /dashboard/supervisor?teamId=<id>` — useful for checking a specific team's numbers without logging in as that team.

## Setting up photo/video storage
Without an `S3_BUCKET` set, uploads still work locally but are **not durable** — most hosting (including Render's free tier) wipes local disk on every redeploy. To make this real:

**Option A — AWS S3**
1. Create a bucket (e.g. `leaves-media`), in the region closest to Kuwait that AWS offers (e.g. `me-south-1` — Bahrain).
2. Create an IAM user with `s3:PutObject`/`s3:GetObject` scoped to that bucket, and generate an access key.
3. Set in `.env`: `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`. Leave `S3_ENDPOINT` unset.
4. Either make the bucket public-read for the `visits/*` prefix, or put a CDN (e.g. CloudFront) in front and set `S3_PUBLIC_URL_BASE` to that CDN's domain.

**Option B — Cloudflare R2** (often cheaper, no egress fees — worth considering given photos/video will add up across 120 clients)
1. Create an R2 bucket in the Cloudflare dashboard, and an API token scoped to it.
2. Set `S3_ENDPOINT` to `https://<account-id>.r2.cloudflarestorage.com`, `S3_REGION=auto`, plus the bucket name and credentials.
3. Enable R2's public bucket URL (or a custom domain) and set `S3_PUBLIC_URL_BASE` to it.

Once configured, no code changes are needed — `storageMode` in `storage.ts` automatically switches from the local fallback to real object storage.

## Next steps (per the Phase 1 sprint plan)
1. Sprint 1 cleanup: provision a real S3/R2 bucket (see above), and build the **real** client data migration script once Leaves' actual source data is available (today's demo seed is fictional test data only)
2. Sprint 2 cleanup: configure real SMTP for ticket notifications; further dashboard polish if needed
3. Deploy backend + web app to a staging environment — see `STAGING_DEPLOY.md` for the Render runbook
4. Swap the placeholder logo for Leaves' real logo file once shared
