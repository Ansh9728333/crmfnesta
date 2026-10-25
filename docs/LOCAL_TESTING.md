# Persistent localhost testing

`npm run local:test` explicitly starts an isolated PGlite PostgreSQL-compatible
test engine and the existing production build on http://localhost:3000.
It does not change the production database client or provide a runtime fallback.
It never reads .env.local for setup and overrides the child's database/auth/Storage
environment. CI and Vercel execution are refused. Docker is not required.

Before the first start, run `npm run build` and create the ignored file
`.local/siteflow-test/admin.json` with your real `name`, `email`, Indian `mobile`
and desired `username`. Do not put credentials in tracked source. Setup generates
random auth/password secrets and creates the initial Super Admin through the same
Better Auth bootstrap service, with access to all three canonical companies.
It runs the reviewed migration runner and seeds no customers, leads or orders.

Open `.local/siteflow-test/ADMIN_LOGIN.txt` for the generated temporary login.
First login requires a password change. The saved temporary password becomes
obsolete afterward. Subsequent starts preserve users, password changes and CRM data;
they never reset or reprovision existing accounts. Admin can provision employees
through the normal UI. No email or SMS is sent.

Stop the terminal with Ctrl+C; restart with `npm run local:test`. Keep only one
instance running. Stop `npm start`/`npm run dev` first if port 3000 is occupied.
Back up the entire `.local/siteflow-test` directory only after clean shutdown.
Never delete it to fix a login problem: that would delete your local test records.

The database socket is restricted to 127.0.0.1:55440 and trusts local connections.
It is not a secure multi-user database server. Treat all data and secrets as
local-only, use disposable test customer information, and keep this directory out
of Git, deployment uploads and shared backups. Windows access controls and OneDrive
sync must be managed on the host; `mode: 0600` is not a Windows ACL guarantee.

Supabase Storage uploads/downloads are unavailable and fail honestly. Workflow steps
requiring file evidence cannot be completed without a separately configured Storage
environment. PGlite does not establish native PostgreSQL multi-connection concurrency,
production performance, TLS or Supabase behavior. Use real staging Supabase for
release acceptance. This harness is explicitly for local testing only.
