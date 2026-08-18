# Deploying Leaves to Staging (Render)

This uses the `render.yaml` Blueprint in the repo root, which sets up three things in one pass: the backend API, the web dashboard, and a managed PostgreSQL database. A couple of settings can only be filled in after the first deploy (Render assigns each service's URL only once it exists), so this is a two-pass process — that's normal, not a mistake.

**Run the local smoke test in the main README first.** This codebase has only ever been typechecked, never actually run — verify it works locally (fast, no account needed, see README) before spending a deploy cycle finding out something's broken.

## Before you start
- Push this repository to GitHub (or GitLab/Bitbucket) — Render deploys from a connected git repo, it doesn't accept a zip upload.
  ```bash
  cd leaves-system
  git add -A
  git commit -m "Sprint 0/1: scaffold, theme, login flow"
  # create a new repo on GitHub first, then:
  git remote add origin <your-repo-url>
  git push -u origin main
  ```
- Create a free Render account at render.com if you don't have one, and connect your GitHub account to it.

## Pass 1 — First deploy
1. In the Render dashboard: **New → Blueprint**, and select this GitHub repo.
2. Render reads `render.yaml` and shows you three resources it's about to create: `leaves-db` (PostgreSQL), `leaves-backend` (web service), `leaves-web` (static site). Click **Apply**.
3. Wait for all three to finish deploying (the database first, then the backend, then the frontend — the backend needs the database's connection string, which Render wires up automatically via `fromDatabase`).
4. Once `leaves-backend` is live, note its URL from the Render dashboard — something like `https://leaves-backend-xxxx.onrender.com`.
5. Once `leaves-web` is live, note its URL too — something like `https://leaves-web-xxxx.onrender.com`.
6. Confirm the backend is actually up: visit `https://<leaves-backend-url>/health` in a browser — you should see `{"status":"ok"}`.

At this point the frontend is deployed but pointing at a placeholder backend URL, and the backend is accepting requests from any origin (`*`) rather than just your frontend. Pass 2 fixes both.

## Pass 2 — Wire the two services together
1. Open the `leaves-web` service in Render → **Environment** tab. Set `VITE_API_BASE_URL` to the real backend URL from step 4 above (e.g. `https://leaves-backend-xxxx.onrender.com`). Save, then trigger a manual redeploy of `leaves-web` (env var changes require a rebuild for a static site, since Vite bakes it in at build time).
2. Open the `leaves-backend` service → **Environment** tab. Set `CORS_ORIGIN` to the real frontend URL from step 5 (e.g. `https://leaves-web-xxxx.onrender.com`). Save — this one takes effect on the next restart, which Render triggers automatically.
3. Visit your `leaves-web` URL in a browser. You should land on the Leaves login page.

## Seed the first login
The database is empty after a fresh deploy — there's no owner account yet. Render's free plan doesn't give you a persistent shell, so run the seed script as a **one-off job**:
1. In the `leaves-backend` service → **Shell** tab (or **Jobs**, depending on your Render plan/UI version).
2. Run: `cd backend && npm run prisma:seed`
3. This creates the three test logins documented in the main README (`owner@leaves.test`, `supervisor@leaves.test`, `team@leaves.test`, all password `ChangeMe123!`). Log in as owner and use `POST /auth/users` (or a future admin UI) to create real accounts, then delete these test ones.

## Optional — seed demo clients to actually see the app working
The database is otherwise empty at this point — no clients, no visits, nothing on the dashboards. To smoke-test the deployment with realistic-looking data, run the same shell/job step with:
```
cd backend && npm run prisma:seed:demo
```
This creates 15 **fictional** example clients (prefixed `[DEMO]`, not real Leaves data) with garden profiles, sample visits, and a few tickets — enough to click through every screen and confirm staging actually works end-to-end. Delete these before Leaves' real client data goes in.

## Set up object storage before uploading real photos/videos
The backend supports S3/Cloudflare R2 (see the "Setting up photo/video storage" section in the main README), but falls back to local disk if no bucket is configured. **On Render, that fallback is not durable** — free web services have an ephemeral filesystem, so every redeploy wipes anything saved locally. Before logging real client visits in staging:
1. Provision an S3 or R2 bucket (README has both options).
2. Add `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT` (R2 only), `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_URL_BASE` to the `leaves-backend` service's Environment tab in Render.
3. Redeploy `leaves-backend`. Test uploads will now persist properly.

## Known limitations of this staging setup — expected, not bugs
- **Free-tier services spin down when idle** and take ~30–60 seconds to wake up on the next request. Fine for a staging/demo environment; upgrade the plan before this is client-facing.
- **The database is on Render's free Postgres plan**, which expires after 90 days unless upgraded — a fine limit for a staging environment, not for anything long-lived.

## Redeploying after future code changes
Render redeploys automatically on every push to the connected branch — no extra steps needed beyond `git push`.
