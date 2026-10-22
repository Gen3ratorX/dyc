# Connect this repository to Vercel

1. Import `Gen3ratorX/dyc` in Vercel. Choose **Next.js**, root directory **.**, default `npm run build`, Node.js **22.x**.
2. Set these server environment variables in Production: `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `BOOTSTRAP_ADMIN_EMAIL`, `APP_ORIGIN`. Use `.env.example` for the names. Do not put credentials in GitHub or chat, and do not use `NEXT_PUBLIC_` prefixes.
3. `DATABASE_URL` must be your Supabase **Transaction pooler** connection string from **Connect**, with the database password URL-encoded. This is a database password, not an Auth-user password or publishable API key. The server uses TLS certificate verification, disables prepared statements and limits each instance to one pooled connection.
4. Codex has applied `20261022075106_dyc_camp_schema.sql` to DYC Care Production. The matching migration is committed in `supabase/migrations/`. It creates a private `dyc` schema, a restricted backend role and row policies. It does not change Auth users or copy the old local/Cloudflare database. If it was already applied by Codex, do not apply it twice.
5. Prefer a dedicated database login that is a member of `dyc_app`. Every query runs inside a transaction with `SET LOCAL ROLE dyc_app` and a private search path. The migration grants that role to the project's `postgres` login for initial setup; configure a dedicated login before clinical rollout.
6. Set `SUPABASE_URL` and its **publishable** key from DYC Care Production. Set `BOOTSTRAP_ADMIN_EMAIL=admin@dyccamp.com`. That Supabase Auth account already exists; use its existing password. No verification email is sent by the app.
7. Set `APP_ORIGIN` to the exact Vercel production HTTPS origin and redeploy. Until all variables are correct, data APIs remain closed. `/api/health` returns 503 when configuration or schema is missing.
8. Open the app, sign in and choose a device passphrase for encrypted offline capture. Add staff permissions in Camp settings and create the corresponding password users in Supabase Auth, with Auto Confirm enabled. There is no public signup page; disable provider public signup as well.

Use separate environment variables and a separate database for Vercel Preview deployments. Do not point public previews at real camp records.

## Implementation and validation limits

This checkout runs standard Next.js on Node. Cloudflare build configuration, launch scripts and prior test files are retained as historical reference; the default commands now target Vercel. The original Sites identity is excluded from GitHub. There is no header-based demo sign-in in the Vercel runtime.

The SQL adapter preserves parameter binding and atomic write batches. A transaction advisory lock serialises camp writes so check-status and prescription checks keep their concurrency guarantees on Postgres. Auth roles/groups remain checked server-side, with a second membership check within write transactions.

Build and focused tests must pass before pushing. A successful build does not verify the database connection string or staff password sign-in: those require the Vercel environment and user-assisted sign-in after import. Do not enter identifiable medical data until hosted permissions, offline recovery, backups, clinical workflows and load testing have been accepted.

Supabase security advisor currently warns that leaked-password protection is disabled. Enable it when the project plan supports it, and complete the clinical acceptance checks before real use.

The app also accepts Supabase’s standard `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` names (or the legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY`). Use either naming scheme for these public provider values. Database credentials remain server-only. `/api/health` reports missing variable names or `DATABASE_UNAVAILABLE`, and never returns their values.
