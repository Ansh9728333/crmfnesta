# SiteFlow CRM

B2C CRM for Finesta Home (Windows), IBAX (Shower Partitions) and S-Grip (Railings).
Employee authentication/administration and common pre-sales management are implemented.
Supabase supplies PostgreSQL and private Storage only. **Supabase Auth is not used.**
Leads, customers, projects, assignment, follow-ups and activity use real database
services, with a responsive dashboard, Kanban, paginated tables and detail drawers.
No customer records or business totals are fabricated. Shared post-sales and detailed production load planning/fulfillment are implemented. See [pre-sales implementation](docs/PRESALES_IMPLEMENTATION.md).

## Local setup

For an isolated persistent localhost test database without Supabase, see
[local testing](docs/LOCAL_TESTING.md) and run `npm run local:test` after building
and supplying the ignored administrator identity. This opt-in test harness is not
a production database fallback; Supabase Storage is unavailable in that mode.

Release status: repository security hardening and isolated workflow verification
are documented in [production readiness audit](docs/PRODUCTION_READINESS_AUDIT.md).
Use the [Supabase, GitHub and Vercel checklist](docs/DEPLOYMENT_CHECKLIST.md)
before an authorized release. Live credentials, Storage acceptance, recovery drills
and hosted platform settings remain unverified. Nothing has been deployed.

Use Node.js 24 LTS and npm. The package engine and CI use Node 24.

```sh
npm ci
```

Copy `.env.example` to the ignored `.env.local` file and configure:

| Variable                  | Purpose                                                           |
| ------------------------- | ----------------------------------------------------------------- |
| DATABASE_URL              | Supabase transaction pooler, port 6543, server-only               |
| DIRECT_URL                | Direct PostgreSQL or session pooler connection for migrations     |
| DATABASE_SSL_CA           | Optional Supabase PEM CA; remote certificates are always verified |
| BETTER_AUTH_SECRET        | Random secret of at least 32 characters; use 48 random bytes      |
| BETTER_AUTH_URL           | Exact app origin, HTTPS outside local loopback                    |
| NEXT_PUBLIC_APP_URL       | Same exact origin; this is the only public environment value      |
| SUPABASE_URL              | Project HTTPS URL, used on server for private Storage             |
| SUPABASE_SERVICE_ROLE_KEY | Server-only Storage key; never a browser variable                 |
| SUPABASE_STORAGE_BUCKET   | `siteflow-documents`, matched by the restrictive migration policy |

Generate a secret locally; do not send it in chat or commit it:

```sh
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
npm run db:migrate
```

`db:migrate` applies both generated schema and reviewed security SQL in `drizzle/`.
Do not substitute `drizzle-kit push`: that omits custom security policies/triggers.
Use a fresh dedicated project or inspect existing public tables for name conflicts
before migrating. The runner never deletes existing tables. The runtime uses
Postgres.js with `prepare:false`, `max:1` and TLS outside loopback. DIRECT_URL is
separate because migrations require a direct/session connection. The application
has no local or in-memory production database fallback.

## One-time initial administrator

Set these variables temporarily in `.env.local`, using real details:

- BOOTSTRAP_ADMIN_NAME
- BOOTSTRAP_ADMIN_USERNAME
- BOOTSTRAP_ADMIN_EMAIL (real unique email; no email is sent)
- BOOTSTRAP_ADMIN_PASSWORD (at least 12 characters, no permanent default)
- BOOTSTRAP_ADMIN_MOBILE
- BOOTSTRAP_CENTRE (real initial branch name, created for each company)

```sh
npm run admin:bootstrap
```

This local-only CLI uses Better Auth's supported Admin server API and Drizzle
transaction. An advisory lock prevents concurrent bootstrap/provisioning. Bootstrap
refuses to run once **any** auth user exists; no public bootstrap endpoint exists.
The initial Super Admin receives assignments for all three companies. Remove all
BOOTSTRAP_* values immediately after success. Sign in at `/login` and change the
initial password before entering the workspace. Recovery after bootstrap requires
another authorized administrator or a reviewed operator recovery procedure; never
reopen public signup.

```sh
npm run dev
```

Visit http://localhost:3000. With missing configuration the login page still renders;
protected pages redirect to login and APIs fail closed with a real service error.
Montserrat is self-hosted under `src/assets` with its OFL license.

## Employee administration

`/admin/employees` is restricted on the server to Admin/Super Admin assignments.
Create employees with real unique emails, globally unique usernames, generated
employee codes, mobile, department, status and one or multiple organization/branch/
role assignments. Initial passwords are never returned after provisioning, stored
in plaintext, emailed or persisted in the browser. Share temporary credentials only
through an approved private channel. Creation/reset forces a password change.

The interface supports search, role/branch/status filters, creation modal, edit
drawer, activation/deactivation, password reset, session revocation, last login and
organization-specific role permissions. Privileged actions require confirmation.
Existing branches come from `centres`; the Add branch action creates branches only
inside organizations the operator administers and records an audit event.
Role defaults are defined in `src/lib/auth/roles.ts` and seeded at bootstrap.

Only Super Admin may grant/change Admin or Super Admin roles. An administrator
must administer **every** organization assigned to the target employee before
changing global identity/status/credentials. Operators cannot edit, deactivate,
reset or revoke their own accounts through administration. Another authorized
administrator must perform those changes. This protects the last active Super Admin.
Admin authority cannot be granted through permission checkboxes.

## Security boundary

Better Auth's generated `user`, `account`, `session`, `verification` and `rate_limit`
tables are the only credential/session store. Scrypt password hashing and verification
remain library-owned. Cookies are httpOnly, SameSite=Lax and Secure for HTTPS origins;
sessions last eight hours with no cookie session cache. Every service revalidates
session, active profile, forced password change, assignments and current permissions.
Changes are effective for existing sessions without trusting stale client roles.

Public Auth is allowlisted to username login, sign-out and session lookup. Public
signup, email login, username discovery, raw Admin API routes and impersonation
are unavailable, including direct HTTP calls. Internal scoped provisioning uses
Better Auth's Admin APIs. Login limits persist in PostgreSQL: five attempts per
trusted platform IP per five minutes, plus ten attempts per normalized account per
five minutes. Vercel's `x-vercel-forwarded-for` is the sole trusted forwarded IP
header; other hosts need a reviewed trusted-proxy setting. Password changes also
have a persistent per-account limit. Do not deploy behind an untrusted proxy that
allows clients to inject the configured platform header.

Mutating application routes require exact Origin, reject cross-site fetches and
validate JSON with Zod. Better Auth retains its built-in CSRF/origin protections.
Account mutations, assignments, revocation and audits are transactional. Sign-in,
password changes and privileged mutations are serialized to avoid races between
credential verification, session creation and concurrent role/deactivation changes.

All 46 current tables have RLS enabled without browser allow policies and explicit grants
revoked from PUBLIC/anon/authenticated. **A privileged server connection bypasses
RLS.** Application services enforce organization and record scope; RLS alone is not
claimed to secure those queries. Business child records have composite organization
foreign keys, and load items are constrained to their parent order. Normal employees
access assigned order documents only; Admins access their organizations' documents.
Customer/project/lead API routes require the same verified authorization boundary.
No unauthenticated data endpoint or browser database credential is provided.
Audit records are append-only at the database level. Operators with owner/superuser
credentials can change database protections; keep those credentials tightly controlled.

## Private Storage

```sh
npm run storage:configure
```

Run only against the configured dedicated project after migrations. This verifies
or creates the private `siteflow-documents` bucket, never makes an existing public
bucket silently private, and does not create browser allow policies. The custom
migration adds a restrictive storage.objects policy denying browser access to this
bucket even if another permissive policy exists. The policy is skipped on ordinary
PostgreSQL without a storage schema. The bucket name is deliberately fixed; changing
it requires a matching reviewed policy migration.

`GET /api/documents/[id]/download` verifies identity, permissions, organization and
assigned order before touching Storage, checks the bucket is private, and issues a
60-second signed download URL. The signing key never reaches the browser. A URL
already issued remains valid for at most its 60-second lifetime after revocation.
Upload UI/document CRUD belongs to the next document phase; no fake upload endpoint
or public bucket is provided.

## Commands and tests

```sh
npm run lint
npm run typecheck
npm test
npm run test:integration
npm run build
npx playwright install chromium
npm run test:e2e
npm run test:e2e:auth
```

`npm run check` runs lint, typecheck, unit/integration tests and production build.
Integration tests apply the actual migrations to isolated PGlite PostgreSQL, run
real Better Auth credential/session/Admin APIs and the same Drizzle service methods.
They use reserved `.test` identities, no email provider and no real environment
credentials. PGlite is a dev dependency only; production uses Supabase/Postgres.js.
Tests cover user creation restrictions, direct signup rejection, username login,
wrong credentials, inactive accounts, revocation, forced/reset passwords, current
permissions, tenant/assigned-record access and private-document denial.
Browser tests cover desktop/mobile login UI, anonymous redirects, rejected public
endpoints and invalid-login presentation. A stub is used only for the latter UI
presentation test, never as a production backend or credential/security test.
The authenticated browser suite starts a disposable PostgreSQL wire-protocol
test server on loopback and runs the actual Postgres.js driver and production Next.js
application. It verifies employee creation, first login/password change, scoped
access, role edits, password reset, activation/deactivation, revocation and logout
through the desktop/mobile UI. This test server overrides environment variables
only in its child process; it never connects to Supabase or reads real credentials.
Ports 55439 (test database) and 3100 (test app) must be free. Its reserved identities
and test-only passwords are fixtures under tests/support, never runtime defaults.

## Schema/tooling

```sh
npm run auth:schema
npm run db:generate
```

The checked-in auth schema was generated by official `auth` CLI 1.7.12 with Admin,
Username and database-rate-limit options. `scripts/auth-schema.config.ts` is a
schema-generation-only config with no runtime fallback or live database connection.
After generating schemas, review SQL and add matching security SQL for new tables.
Generated-schema CLI diagnostics before a schema exists do not establish a live
connection. Drizzle's dev-only legacy esbuild loader is overridden to a patched
esbuild release; schema generation and migrations are exercised in tests.

## Routes and structure

Public: `/login`. Protected: `/` for the live opportunity dashboard, `/leads` for
Kanban/table management, `/leads/[id]` for lead details, `/customers` and `/projects`
for scoped directories and creation. `/appointments` and `/quotations` provide
real directories; `/leads/[id]/presales` contains visits, versioned quotations,
showroom/negotiation and order conversion. `/orders` is the real post-sales dashboard;
`/orders/[id]` runs the shared sixteen-stage workflow, private documents and approvals;
`/orders/settings` provides Admin stage responsibilities and mandatory fields.
`/installations` provides per-load installation, S-Grip glass, engineer audits and handover; `/service` provides feedback and complaint/service tickets. `/documents` retains
placeholders. `/admin/employees` provides employee administration;
`/change-password` for authenticated employees, including first-login sessions.

`src/lib/db` owns schemas/runtime client; `src/lib/auth` owns identity/access;
`src/lib/employees` owns scoped account services; `src/lib/documents` owns private
access; `src/features` holds interactive UI. App routes are thin validation and
transport boundaries. The common business workflows are unchanged in
`src/lib/domain/workflows.ts`.

Post-sales state, permissions, core gates, migrations and verification are documented
in [docs/POSTSALES_ENGINE.md](docs/POSTSALES_ENGINE.md). The engine records manual
WhatsApp group information and review requests; it does not create groups or send
messages. Dispatch uses verified contractually due payment, and handover precedes
review tracking without any positive-review requirement.

## GitHub / Vercel

No remote is configured and nothing was pushed or deployed. GitHub Actions checks
lint/types/unit/integration/build and public browser security smoke tests with no
production credentials, plus authenticated desktop/mobile lifecycle tests. For later authorized Vercel deployment: use Node 24,
configure environment-specific secrets and an exact HTTPS origin, apply migrations,
bootstrap the real admin, configure private Storage and test login/logout against
the deployed hostname. Never wildcard-trust all vercel.app domains. Do not cache
personalized responses. Prefer a dedicated restricted runtime database role, keeping
owner credentials limited to migrations. Review grants before switching runtime roles.

Live Supabase persistence, actual Storage signing and post-deployment login/logout
require separate verification; local integration success does not prove them.
See `docs/STEP_2_VERIFICATION.md` for the verified status and remaining prerequisites.

Official references: [Better Auth Admin](https://better-auth.com/docs/plugins/admin),
[Username](https://better-auth.com/docs/plugins/username),
[Drizzle adapter](https://better-auth.com/docs/adapters/drizzle),
[Next.js integration](https://better-auth.com/docs/integrations/next),
[rate limiting](https://better-auth.com/docs/concepts/rate-limit),
[Supabase pooling](https://supabase.com/docs/guides/database/connecting-to-postgres),
[Supabase Drizzle](https://supabase.com/docs/guides/database/drizzle).

## Production load planning implementation

Phase 5 production load planning is implemented for all three companies. See
[production load rules and verification](docs/PRODUCTION_LOADS.md). `/production`
and `/production/[id]` replace the placeholder with real database-backed allocation,
independent progress, payment verification, dispatch/delivery/installation/audit and
quantity aggregation. Reviewed migrations 0012–0013 add immutable load events and
transaction-safe allocation safeguards. The Phase 5 schema had 40 tables.

Production/load completion never completes an order automatically. Final handover
requires complete item allocation and all applicable loads completed, plus existing
approved installation/audit stages. Empty planning drafts reserve no quantities.
The full payment ledger, reconciliation and external integrations remain later work.

Payment Management and Material Dispatch/Delivery are implemented at `/payments`
and `/dispatch`. Installments, Admin load milestones, private receipt verification,
verified allocations, dispatch approval, challans and partial delivery proofs use
real scoped database services. See [payment and shipping rules](docs/PAYMENTS_DISPATCH_DELIVERY.md).
Migrations 0014–0015 add reviewed financial and quantity safeguards; the current
schema contained 46 tables at Phase 6. Live Supabase acceptance remains pending configuration.

Installation, S-Grip glass checklist, service engineer audits, customer handover,
feedback and complaint/service tickets now use persisted scoped records. See
[installation and customer-care rules](docs/INSTALLATION_AFTERCARE.md). Reviewed
migrations 0016–0017 bring the schema to 51 tables. Production status transitions
for installation/audit/completion now require this evidence-backed workspace.
Live Supabase credentials, migration and private Storage verification remain pending.

Management dashboards, ten scoped reports, CSV/XLSX exports, the Admin Panel and
in-app overdue notifications are implemented at `/`, `/reports`, `/settings` and
`/notifications`. See [management rules and verification](docs/MANAGEMENT_REPORTING.md).
Reviewed migrations 0018–0020 bring the schema to 53 tables and add configuration,
notification receipts, immutable document snapshots and reporting indexes. Live
Supabase acceptance remains pending real environment credentials. No deployment
or source push has been performed.
