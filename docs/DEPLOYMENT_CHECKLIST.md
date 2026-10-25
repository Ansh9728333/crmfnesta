# Supabase, GitHub and Vercel deployment checklist

Status: **LIVE; operational checklist remains partly open**. Every unchecked item needs evidence.
The user authorized Supabase/Vercel live deployment and source push on 25 October 2026. The selected GitHub repository is Ansh9728333/crmfnesta. Supabase connectivity
was verified with its trusted CA and certificate verification enabled; the initial
public schema was empty. Reviewed migrations 0000–0020 have now been applied.
Vercel CLI authentication is complete; source is pushed to Ansh9728333/crmfnesta
and main-branch hosted CI passed. Vercel project crmfnesta and its production
environment are configured. Live administrator provisioning was separately approved
by the user and completed through Better Auth with a new password. Real private
Storage upload, anonymous denial and signed byte-preserving download were verified;
only the unique infrastructure probe was removed. Application release 2357ee3 is live
at https://crmfnesta.vercel.app; production HTTPS, real login, first-password-change,
logout/session revocation and desktop/mobile browser checks passed. See
DEPLOYMENT_STATUS.md for release evidence and remaining operational items.
After the warning, the user explicitly supplied the same legacy server key again
and directed setup to continue. It is stored only in ignored local configuration
and a Vercel production secret. Rotation/retirement of chat-shared database and
server credentials remains recommended and has not been performed.
Use this alongside PRODUCTION_READINESS_AUDIT.md and the phase-specific guides.
Do not put credentials, database dumps, signed URLs or customer screenshots in PRs.

## 1. Release source and GitHub

Repository configuration now specifies Next.js, Node 24, `npm ci` and
`npm run build`. `.vercelignore` excludes `.local`, all environment files,
private keys, browser artifacts and local test infrastructure from CLI uploads.
Git-based deployments still require the `.gitignore`/initial commit secret review.

- [ ] Select the intended private GitHub repository/organization and named owners.
      No remote is currently configured. Review all untracked source before the
      initial commit; select the release commit and record its SHA and lockfile.
- [ ] Verify `.env.local`, other `.env*`, `.vercel`, build output, test artifacts,
      keys and dumps are ignored. Only `.env.example` belongs in source control.
      Run secret scanning before the initial push; rotate any exposed credential.
- [ ] Protect the release branch: PR review, required `checks` job, stale approval
      dismissal, restricted bypass/force pushes and deletion. Enable account MFA,
      secret scanning/push protection and Dependabot where available.
- [ ] Run `npm ci`, `npm run check`, `npm run test:e2e` and
      `npm run test:e2e:auth` in hosted CI; install Chromium with
      `npx playwright install --with-deps chromium`. Run
      `npm audit --omit=dev --audit-level=high`. Review new advisories regardless
      of the threshold. No real CRM secrets belong in these isolated test jobs.
- [ ] Keep actions pinned and reviewed; CI has read-only contents permission and
      no persisted checkout credential. Never execute untrusted PR code with
      production secrets or `pull_request_target` checkout privileges.
- [ ] GitHub push approval must account for an eventual connected Vercel project's
      auto-deployment behavior. Do not connect/push while deployment is forbidden.

## 2. Supabase database and private Storage

- [ ] Use separate staging and production projects and credentials. Inspect for
      pre-existing schemas/table conflicts before applying the initial migrations.
      Enable organization/account MFA and restrict platform membership.
- [ ] Record region, capacity, backup/PITR retention and availability needs. Review
      the Security Advisor, SSL enforcement and network restrictions. Allowlist
      approved app/migration egress only where the hosting/network plan supports
      stable addresses; do not invent an IP allowlist for dynamic Vercel egress.
      Database network restrictions do not secure Storage HTTPS endpoints.
- [ ] Configure transaction-pooler `DATABASE_URL` (runtime, prepared statements
      disabled), direct/session-pooler `DIRECT_URL` (migration operator only) and
      `DATABASE_SSL_CA` if the project requires a private CA. Supply real PEM
      contents using the secret manager. Remote certificate verification must
      succeed; never resolve a TLS failure by disabling certificate checks.
- [ ] Use a reviewed privileged server database role with only needed runtime
      privileges; it must support this server's scoped access model. The current
      model trusts a server role that bypasses RLS. Keep DDL/migration authority
      separate where possible and test the exact runtime role, triggers and functions.
- [ ] Back up the target, then run **only after authorization**
      `npm run db:migrate` from a trusted operator using DIRECT_URL. Apply reviewed
      migrations 0000–0020 together, including security guards. Never `db push`.
      Compare `drizzle.__drizzle_migrations` hashes/order to the release artifacts;
      rerun the migration runner and confirm no extra changes.
- [ ] Inspect all 53 application tables for enabled RLS, no browser allow policies
      and no effective PUBLIC/anon/authenticated grants (including inherited grants).
      Test browser-role SELECT/INSERT/UPDATE/DELETE rejection in staging. Verify
      cross-company/branch denial with real application roles and session revocation.
- [ ] Configure server-only SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and
      SUPABASE_STORAGE_BUCKET=`siteflow-documents`. After authorization run
      `npm run storage:configure`. It refuses an existing public bucket. Verify
      private status, 4 MiB cap, allowed PDF/JPEG/PNG types and restrictive
      `siteflow_documents_server_only` policy on storage.objects. Inspect drift.
- [ ] Upload/download real staging evidence through each application module.
      Confirm bytes survive reload, invalid/oversized files fail without metadata,
      anonymous and unrelated employees cannot read, links expire in 60 seconds
      and no bucket listing is exposed. Never test destructive suites on production.
- [ ] Provision the first real administrator with `npm run admin:bootstrap` from
      a trusted operator using one-time BOOTSTRAP_* secrets. Supply a real unique
      email and an Admin-selected password; verify direct sign-in, remove all bootstrap variables,
      verify ordinary employee provisioning and revocation. No public bootstrap,
      Supabase Auth signup or synthetic address is part of this architecture.

## 3. Vercel configuration (after authorization)

- [ ] Select Next.js framework, repository root, Node 24, `npm ci`, `npm run build`
      and default Next output. Keep database migration/bootstrap/storage setup
      **out of build/start commands**. Match function region to the database.
- [ ] Keep Development, Preview and Production environment values separate.
      Production database/Storage keys must never reach a preview or fork build.
      A fixed protected staging hostname is simplest for cookie-origin testing.
- [ ] Set DATABASE_URL, optional DATABASE_SSL_CA, random BETTER_AUTH_SECRET
      (at least 32 characters; generate 48 random bytes), BETTER_AUTH_URL and
      NEXT_PUBLIC_APP_URL. Both URLs must be the same exact HTTPS origin, without
      trailing slash/path. Set server-only Storage variables above. Only the app
      URL is public. Do not add NEXT_PUBLIC prefixes to secrets. Keep DIRECT_URL
      and BOOTSTRAP_* out of runtime environments.
- [ ] Add the intended domain, HTTPS and canonical-host behavior. Requests on
      alternate preview aliases must not silently authenticate against production.
      Do not wildcard trusted origins. Use preview protection and separate auth secrets.
- [ ] Inspect Secure/HttpOnly/SameSite cookies, no-store on personalized/error
      responses, nonce CSP and security headers on the deployed host. Confirm no
      shared CDN caching and no CSP violations while navigating all modules.
- [ ] Verify trusted ingress overwrites the client-IP header used by Better Auth;
      test spoofed headers and login throttling through the actual platform.
      Review platform WAF/body/rate limits without weakening account limits.
- [ ] Check function duration/memory, 4 MiB multipart uploads and 10,000-row XLSX
      exports under the selected plan. Monitor aggregate connection counts across
      instances: max=1 is per worker, not a global database connection limit.
- [ ] Set redacted error/availability alerts, DB pool/latency and Storage failure
      monitoring, escalation owner and retention. Never log bodies, SQL parameters,
      cookies, payment/customer details or signed URLs. Run an operational outage
      drill; verify unavailable services fail closed without fake success.

## 4. Staging acceptance before production promotion

- [ ] Create a restricted staging acceptance dataset for each company. Run lead
      create/edit/assign/search, customer with multiple projects, follow-up, visits,
      quotation V1/V2/PDF, showroom/negotiation, Lost reason and accepted-quote Won.
- [ ] Follow all sixteen post-sales stages with real uploaded documents and
      approvals. Verify survey approval precedes production release and that
      WhatsApp group fields record actual group evidence only.
- [ ] Split 40 items into loads of 30 and 10 for every company. Attempt concurrent
      duplicate/over-allocation from two independent database connections. Check
      rollback leaves no partial allocation, and one finished load leaves order open.
- [ ] Record partial installments; deny unauthorized verification and duplicate
      allocation. Block unpaid dispatch, then verify contractual payment and create
      valid shipment/partial delivery. Reconcile exact ledger totals and receipts.
- [ ] Finish per-load installation and engineer audits; exercise S-Grip glass Yes
      and No inside the same order. Try bypassing via generic workflow forms.
      Require all loads, approved checks/glass and documents before handover.
      Record customer acceptance, declined/low-rating feedback and reopened ticket.
- [ ] Verify nineteen dashboard KPIs and ten reports against independently
      reconciled staging SQL totals; test every filter, scoped CSV/XLSX export,
      notification state and Admin policy changes. Test pagination and capped exports.
- [ ] Test Admin, Accounts, sales, installation, engineer and restricted branch
      users on desktop/mobile, including keyboard focus, revoked grants, expired
      sessions and reload persistence. Record evidence without exposing real PII.
- [ ] Capture EXPLAIN ANALYZE for representative large report/task queries in
      staging. Measure load-test latency and advisory-lock contention. Decide
      capacity from measured data, not the small isolated test dataset.

## 5. Recovery and release decision

- [ ] Set agreed RPO/RTO, encrypted off-site database backup retention and separately
      versioned/private Storage object backups. Database backups contain Storage
      metadata, **not the file objects**. Keep backup access restricted and audited.
- [ ] Restore to an isolated target, including required roles/secrets, schema/data
      and object bytes. Compare file manifests, item/payment totals and audit
      history; verify login and authorized file download. Record measured recovery
      times and test the latest backup. Do not overwrite production for a drill.
- [ ] Record release SHA, migration hashes, environment/project identifiers,
      acceptance evidence, previous deployment and responsible operator.
- [ ] Plan rollback: stop promotion/writes when integrity is uncertain, assess
      compatibility before reverting application code. Vercel rollback does not
      reverse database migrations. Prefer reviewed forward fixes; restore data
      only with an approved recovery decision accounting for writes since backup.
- [ ] Explicitly authorize production deployment/promotion only after all blocking
      items have evidence. After release, repeat smoke checks, inspect alerts and
      reconcile order/payment counts before ending the observation window.

Official platform references are linked in PRODUCTION_READINESS_AUDIT.md. Check
current plan-specific limits and platform instructions when executing this checklist.
