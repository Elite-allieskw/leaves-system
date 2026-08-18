# Deploying Leaves to Staging (Fly.io + Neon + Cloudflare Workers)

`render.yaml` and `STAGING_DEPLOY.md` are untouched and still valid if you
want to go back to an all-Render setup later. This is a parallel path, not a
replacement.

## ⚠️ Read this before creating any accounts

**Fly.io requires a credit card for anything beyond a 7-day (or 2 machine-hour,
whichever comes first) trial.** No credit card is needed to sign up and start
the trial, but once the trial window closes you can't run or deploy anything
until you add one — and adding a card starts real, immediate billing (there's
no separate "free tier" to fall back to; Fly removed its permanent free tier
in 2024). This is the opposite of Render, where the account itself, the
static site, and the database all stay genuinely free — only the backend
service cost money there.

To limit the actual spend, this setup only asks Fly to host the backend. The
database and frontend go to providers that still have real, cardless free
tiers as of this writing (Aug 2026):

| Piece | Provider | Cost | Card required? |
|---|---|---|---|
| Backend API | Fly.io | ~**$3.32–4/month** (512MB shared-cpu-1x, always-on, + negligible bandwidth) | **Yes**, to keep it running past the trial |
| Database | [Neon](https://neon.tech) (Postgres) | Free (0.5GB storage, 100 compute-hours/month, autosuspends after 5 min idle) | No |
| Frontend | Cloudflare Workers (static assets) | Free (static assets are unlimited/unmetered even on the free plan, per [Cloudflare's own pricing docs](https://developers.cloudflare.com/workers/platform/pricing/); 3,000 Workers Builds minutes/month for auto-deploy-on-push) | No |

**Total: ~$3.32–4/month**, not $0. That's actually *less* than Render's
current $7/month Starter-plan backend (see `STAGING_DEPLOY.md`'s cost note),
but it does require you to put a card on file with Fly specifically, which
Render's free static site + free Postgres didn't. If that's a dealbreaker,
say so before creating a Fly account — going back to the Render path costs
more per month but needs no new account/card beyond what you may have
already set up there.

Fly's own Postgres offering is **not** part of this plan: their legacy
"unmanaged" Postgres is deprecated, and the current "Managed Postgres" (MPG)
starts at **$38/month** with no free tier — using it instead of Neon would
roughly 10x the monthly cost for no benefit at this scale. This is exactly
the kind of stale-assumption trap the Render `plan: free` issue was — Fly's
own docs and pricing page were the ground truth here, not older blog posts
or training data describing an earlier, cheaper/freer Fly.io.

**A second instance of the same lesson, mid-deploy**: this doc originally
described Cloudflare **Pages**' classic dashboard flow (Connect to Git → fill
in a Root directory/Build command/Build output directory form). That flow no
longer exists — Cloudflare has been folding Pages into Workers throughout
2025-2026, and "Create application" in the dashboard now only offers a
Workers flow driven by `wrangler deploy` from the CLI, confirmed by actually
hitting the dashboard rather than assuming the old flow still applied. Pages
itself isn't gone (existing Pages projects still run), but there's no way to
*create* one through the current UI anymore. This doc now reflects Workers
with static assets instead — see Pass 3 below.

## Before you start
- Push the latest commit to GitHub if you haven't (`git push`) — needed for
  the optional Workers Builds auto-deploy step in Pass 3, and good practice
  regardless. Neither Fly nor a manual `wrangler deploy` actually require the
  repo to be pushed (both deploy from your local working copy via CLI).
- Install the Fly CLI (`flyctl`): see https://fly.io/docs/flyctl/install/ for
  your OS. Confirm with `fly version`.
- Create a Fly.io account (`fly auth signup` or via the dashboard) — no card
  needed for this step itself, per the warning above.
- Create a free Neon account at neon.tech — no card needed.
- Create a free Cloudflare account at cloudflare.com if you don't have one —
  no card needed. `wrangler` (the CLI) is already a `devDependency` in
  `web/package.json`, so no separate install step for it.

## Pass 1 — Database (Neon)
1. In the Neon dashboard: **New Project**. Pick a region close to where the
   Fly backend will run (see Pass 2) to minimize latency between them —
   they're on different infrastructure, so some cross-network latency is
   unavoidable either way.
2. Once created, go to the project's **Connection Details** and copy the
   **direct** (non-pooled) connection string — it looks like
   `postgresql://<user>:<password>@<host>/<db>?sslmode=require`. Neon also
   offers a separate pooled (PgBouncer) connection string for
   high-concurrency/serverless use; this deployment runs the backend as a
   single always-on container, not a serverless function, so the direct
   connection is what you want here — using the pooled one would need an
   extra `directUrl` split in `schema.prisma` for `prisma migrate` to work,
   which isn't set up in this codebase and isn't necessary at this scale.
3. Keep that connection string handy for Pass 2.

## Pass 2 — Backend (Fly.io)
1. From the repo root: `cd backend`
2. Run `fly launch --no-deploy`. This detects `backend/Dockerfile` and
   `backend/fly.toml`, and will prompt you for:
   - An app name (must be globally unique across all of Fly — `leaves-backend`
     is almost certainly taken; try something like `leaves-backend-<yourname>`)
   - A region (pick one close to your Neon database's region)
   - Whether to create a Postgres database — **say no**, you're using Neon
   
   It'll rewrite `fly.toml`'s `app` and `primary_region` to match your
   choices — that's expected, let it.
3. Set the required secrets (these are equivalent to Render's environment
   variables, but set via the CLI instead of a dashboard form — they're
   encrypted and never appear in `fly.toml`):
   ```bash
   fly secrets set DATABASE_URL="<the Neon direct connection string from Pass 1>"
   fly secrets set JWT_SECRET="$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))')"
   # Starts permissive so the first deploy succeeds — tighten this in the
   # "wire them together" step below once the frontend's Workers URL
   # exists.
   fly secrets set CORS_ORIGIN="*"
   ```
   Leave `S3_*` and `SMTP_*` unset for now (same reasoning as the Render
   path — see `STAGING_DEPLOY.md`'s storage section and the main README).
4. Deploy: `fly deploy`. This builds the Docker image, runs
   `npx prisma migrate deploy` via `release_command` against your Neon
   database, then starts the app.
5. Confirm it's up: `curl https://<your-app-name>.fly.dev/health` should
   return `{"status":"ok"}`. Note this URL — you'll need it in Pass 3.

If `release_command` hangs or times out on the first deploy (a known rough
edge with Prisma + Fly release commands — see
[the Fly community thread on it](https://community.fly.io/t/release-command-runs-indefinitely/5722)
if it happens), you can instead run the migration manually:
`fly ssh console -C "npx prisma migrate deploy"` from `backend/`, then
`fly deploy` again without changing `release_command`.

## Pass 3 — Frontend (Cloudflare Workers, static assets)
There's no dashboard form for this step (see the note above) — it's CLI-first,
then an optional dashboard step afterward to wire up auto-deploy-on-push.

1. Authenticate `wrangler` to your Cloudflare account:
   ```bash
   cd web
   npx wrangler login
   ```
   This opens a browser for sign-in, so it needs a real interactive
   terminal — same constraint as `fly auth login` earlier. If you're running
   this through an assistant/agent session without a real TTY, open a
   separate terminal window yourself, run it there, and come back once
   you're logged in (it writes to a local Wrangler config file, so any
   terminal on the same machine can use it afterward — no need to re-paste
   anything).
2. Deploy, with the backend URL from Pass 2 set for the build to bake in:
   ```bash
   cd web
   VITE_API_BASE_URL="https://<your-app-name>.fly.dev" npx wrangler deploy
   ```
   (Windows PowerShell: `$env:VITE_API_BASE_URL="https://<your-app-name>.fly.dev"; npx wrangler deploy`)

   This is different from the old Pages flow: there's no dashboard field for
   `VITE_API_BASE_URL` — it has to be a real shell environment variable
   *when you run this command*, because `web/wrangler.toml`'s `[build]`
   section runs `npm install && npm run build` as a subprocess that inherits
   it, and Vite bakes `VITE_*` vars into the bundle at that build step, not
   at request time. No trailing slash, no `/api` suffix — the frontend
   appends paths like `/clients` directly to this.
3. `wrangler` prints the deployed URL when it finishes — something like
   `https://leaves-web.<your-subdomain>.workers.dev`. Note it for the next
   step.
4. SPA routing (React Router's client-side routes falling back to
   `index.html` instead of 404ing) is handled by `not_found_handling =
   "single-page-application"` in `web/wrangler.toml` — already in the repo,
   no extra step needed.

### Optional — auto-deploy on every push (Workers Builds)
The CLI deploy above is a one-shot snapshot, not a standing connection to
GitHub. To get the Render/Pages-style "push to main, it redeploys itself"
behavior, connect the repo *after* the Worker exists from step 2 above:
1. In the Cloudflare dashboard, open the `leaves-web` Worker you just
   created → **Settings → Builds → Connect**.
2. Follow the prompts to authorize Cloudflare's GitHub App and select the
   `leaves-system` repo.
3. Set the build configuration:
   - **Root directory**: `web`
   - **Build command**: `npm install && npm run build` (or leave it to
     `wrangler deploy`, which already runs this via `[build]` in
     `wrangler.toml` — check whichever field Cloudflare's UI actually shows
     you at this point, since this is the part most likely to keep shifting)
   - **Deploy command**: `npx wrangler deploy`
4. Add `VITE_API_BASE_URL` as a build-time environment variable here too —
   same value as step 2 above. Unlike the CLI deploy, this dashboard form
   *does* have a proper env var field for it, since Cloudflare controls the
   build environment here.

## Wire them together
1. Back on Fly: tighten CORS to the real frontend URL from Pass 3:
   ```bash
   cd backend
   fly secrets set CORS_ORIGIN="https://leaves-web.<your-subdomain>.workers.dev"
   ```
   Setting a secret triggers an automatic redeploy.
2. Visit your Workers URL in a browser. You should land on the Leaves login
   page.

## Seed the first login
The database is empty after Pass 1/2 — no owner account yet. SSH into the
running Fly machine and run the seed script directly (this is Fly's
equivalent of Render's Shell tab / one-off job):
```bash
cd backend
fly ssh console -C "npm run prisma:seed"
```
This creates the three test logins documented in the main README
(`owner@leaves.test`, `supervisor@leaves.test`, `team@leaves.test`, all
password `ChangeMe123!`). Log in as owner and use `POST /auth/users` to
create real accounts, then delete these test ones.

## Optional — seed demo clients to actually see the app working
Same idea as the Render path — see the main README for what this creates
and the safety notes around it:
```bash
cd backend
fly ssh console -C "npm run prisma:seed:demo"
```

## Set up object storage before uploading real photos/videos
Same situation as Render: the backend falls back to local disk if
`S3_BUCKET` isn't set, and **that fallback is not durable on Fly either** —
redeploys replace the machine's filesystem from scratch. See the "Setting up
photo/video storage" section in the main README for provisioning an S3/R2
bucket, then:
```bash
cd backend
fly secrets set S3_BUCKET="..." S3_REGION="..." S3_ACCESS_KEY_ID="..." S3_SECRET_ACCESS_KEY="..." S3_PUBLIC_URL_BASE="..."
# S3_ENDPOINT too, if using R2 instead of AWS S3
```
Each `fly secrets set` triggers a redeploy, so this alone is enough — no
separate manual redeploy step needed.

## Known limitations of this staging setup — expected, not bugs
- **Neon's free tier autosuspends the database after 5 minutes of
  inactivity** and takes a moment to wake on the next query — similar in
  spirit to Render's free-tier spin-down, just on the database instead of
  the web service this time. Fine for a staging/demo environment.
- **Neon's free tier caps out at 0.5GB storage and 100 compute-hours/month**
  — comfortably enough for the demo seed and continued scaffold work, not
  enough for a real 120-client production dataset. Revisit before going
  further than staging.
- **Fly's backend filesystem is ephemeral** (see storage section above).
- **Cloudflare's dashboard flow for this keeps changing** (Pages → Workers
  mid-project, in this case). If the Workers Builds dashboard steps above
  don't match what you see, that's the next iteration of the same shift —
  re-verify against Cloudflare's current docs rather than trusting this file
  blindly, same as the Fly/Render notes elsewhere in this doc.
- **This entire setup needs a card on file with Fly**, per the warning at the
  top of this doc — there's no way around that for an always-on backend
  beyond the 7-day trial.

## Redeploying after future code changes
- **Backend**: `cd backend && fly deploy` — not automatic; Fly doesn't watch
  your GitHub repo the way Render does unless you separately set up GitHub
  Actions for it (out of scope here, but worth doing before this is more
  than a personal staging loop — see
  https://fly.io/docs/launch/continuous-deployment-with-github-actions/).
- **Frontend**: `cd web && VITE_API_BASE_URL="..." npx wrangler deploy` —
  also not automatic unless you did the optional Workers Builds step in
  Pass 3, in which case it redeploys on every push to the connected branch,
  same as Render's static site used to.
