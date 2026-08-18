# Deploying Leaves to Staging (Fly.io + Neon + Cloudflare Pages)

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
| Frontend | [Cloudflare Pages](https://pages.cloudflare.com) (static hosting) | Free (unlimited bandwidth, 500 builds/month) | No |

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

## Before you start
- Push the latest commit to GitHub if you haven't (`git push`) — Cloudflare
  Pages deploys from the connected repo; Fly deploys from your local machine
  via the CLI (it doesn't need the repo pushed, but keeping it in sync is
  good practice regardless).
- Install the Fly CLI (`flyctl`): see https://fly.io/docs/flyctl/install/ for
  your OS. Confirm with `fly version`.
- Create a Fly.io account (`fly auth signup` or via the dashboard) — no card
  needed for this step itself, per the warning above.
- Create a free Neon account at neon.tech — no card needed.
- Create a free Cloudflare account at cloudflare.com if you don't have one
  (for Pages) — no card needed.

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
   # "wire them together" step below once the frontend's Cloudflare Pages
   # URL exists.
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

## Pass 3 — Frontend (Cloudflare Pages)
1. In the Cloudflare dashboard: **Workers & Pages → Create → Pages → Connect
   to Git**, select the `leaves-system` repo.
2. Build settings:
   - **Root directory**: `web`
   - **Build command**: `npm install && npm run build`
   - **Build output directory**: `dist`
3. Before the first build, add an environment variable (**Settings →
   Environment variables**, for the Production environment):
   - `VITE_API_BASE_URL` = `https://<your-app-name>.fly.dev` (the backend URL
     from Pass 2, **no trailing slash, no `/api` suffix** — the frontend
     appends paths like `/clients` directly to this)
4. Trigger the deploy (or it runs automatically after you connect the repo).
   Note the resulting `*.pages.dev` URL once it's live.
5. `web/public/_redirects` (already in the repo) handles React Router's
   client-side routes falling back to `index.html` — no extra Cloudflare
   config needed for that part.

## Wire them together
1. Back on Fly: tighten CORS to the real frontend URL from Pass 3:
   ```bash
   cd backend
   fly secrets set CORS_ORIGIN="https://<your-project>.pages.dev"
   ```
   Setting a secret triggers an automatic redeploy.
2. Visit your Cloudflare Pages URL in a browser. You should land on the
   Leaves login page.

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
- **Cloudflare Pages' free tier allows one custom domain per account** — fine
  for a `*.pages.dev` staging URL, revisit if you want a branded staging
  domain alongside a future production one.
- **This entire setup needs a card on file with Fly**, per the warning at the
  top of this doc — there's no way around that for an always-on backend
  beyond the 7-day trial.

## Redeploying after future code changes
- **Backend**: `cd backend && fly deploy` — not automatic; Fly doesn't watch
  your GitHub repo the way Render/Cloudflare Pages do unless you separately
  set up GitHub Actions for it (out of scope here, but worth doing before
  this is more than a personal staging loop — see
  https://fly.io/docs/launch/continuous-deployment-with-github-actions/).
- **Frontend**: automatic — Cloudflare Pages redeploys on every push to the
  connected branch once it's set up, same as Render's static site.
