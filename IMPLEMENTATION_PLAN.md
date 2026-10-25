# SiteFlow CRM implementation plan

## Phase 1 — Foundation (implemented)

Responsive branded shell, dashboard, module placeholders, reusable shadcn/ui,
domain constants, setup docs and automated quality checks.
Acceptance: all documented routes render; mobile navigation is accessible; missing
Supabase configuration is explicit; lint/typecheck/tests/build pass; no fake data.

## Phase 2 — Identity, tenancy and schema (implemented locally; live setup pending)

Supabase PostgreSQL only for primary data and private Storage; Better Auth Admin
and Username plugins for application-managed identities. Drizzle/Postgres.js,
generated auth schema, CRM migrations, no-public-access boundary, admin-only
provisioning, one-time CLI bootstrap, login/logout, first-login password changes,
active account validation, roles/branches, immediate permission checks, employee UI,
session revocation, audit trail and authorized 60-second document downloads.
No public signup, invitations or synthetic email identities. No Supabase Auth.
Acceptance: anonymous access denied; cross-company reads/writes/uploads denied;
session validation/revocation tested; migrations reproducible; no privileged browser key.
Acceptance evidence and remaining live-project checks are recorded in
docs/STEP_2_VERIFICATION.md. Live Supabase persistence/Storage and deployment login
must be tested separately; isolated PostgreSQL tests cannot establish those facts.

## Phase 3 — Common lead management and pre-sales (implemented; live acceptance pending)

Real PostgreSQL services and API routes for lead creation/read/edit/archive/restore,
all requested form fields, customer/project creation/linking, normalized Indian
mobiles, duplicate detection/acknowledgement, branch-scoped employee assignment,
follow-ups, immutable activity and exact shared seven-stage tracking. Responsive
dashboard, SQL-filtered paginated table, independently paginated Kanban columns,
lead details drawer and full detail page are implemented. No browser database or
fake CRUD exists. Runtime remains the configured Supabase/Postgres.js connection.

Acceptance: create/edit/assignment/filter/reload flows pass on desktop and mobile;
permission/tenant/branch checks deny unauthorized operations; activity survives
edits; Lost requires a reason; finalised value is optional at creation and required
for Won; Won creates exactly one linked post-sales order transactionally.
Verification and real-project prerequisites: docs/PRESALES_IMPLEMENTATION.md.
Verified 24 October 2026: lint, TypeScript and production build pass; 14 unit,
32 isolated PostgreSQL integration, 8 public browser and 6 authenticated browser
tests pass. Desktop/mobile lead create/edit/assignment/filter/reload flows pass.
Live Supabase verification requires the ignored .env.local configuration and actual
migration application. Local isolated tests are not a claim of live Supabase access.

Appointments/site visits, initial measurements, private visit attachments,
immutable item-wise quotation revisions and PDFs, approval/acceptance evidence,
showroom outcomes/Not Required reasons, negotiation offers and quotation-backed
Won conversion are implemented. Appointment/quotation directories and a dedicated
lead pre-sales workspace replace their placeholders. Lost records closure time;
Won copies approved item quantities/value into one order and initializes stage 1
of the shared post-sales workflow. Existing Won shortcuts cannot bypass approval.

Acceptance: V1/V2/V3 remain immutable; stale revision submissions are rejected;
only the latest approved/accepted complete quotation converts; company, value,
quantities, customer and project are verified transactionally; retries do not create
duplicate orders; Lost history survives closure. Initial measurement units are
explicit, appointment changes retain before/after history, and files stay private.
See docs/PRESALES_WORKFLOWS.md for implementation rules and verification evidence.
Quotation revisions, visit forms and Won/Lost conversion pass on desktop/mobile;
concurrent V3 revision and order retry checks pass in the isolated database.
Live Supabase/Storage acceptance remains pending real environment configuration.
Calendar integrations, electronic signatures and automated customer messaging are
subsequent optional integrations, not simulated by these modules.

## Phase 4 — Orders and post-sales (implemented; live acceptance pending)

One reusable sixteen-stage engine for Finesta Home, IBAX and S-Grip, initialized
transactionally by quotation-backed Won conversion. `/orders` is the real filtered,
paginated dashboard with current-stage alerts; `/orders/[id]` contains progress,
stage owner/target planning, typed evidence forms, private documents, approval and
status history. `/orders/settings` lets organization administrators configure
owner/reviewer roles and additional mandatory fields without removing core gates.

Stage records preserve name/status, employee, planned/started/submitted/completed
dates, notes, evidence, attachments, approver and immutable before/after history.
Owner submission and authorized approval are separate actions. Future-stage work,
unapproved submissions, stale edits and edits to completed evidence are rejected.
Policy snapshots protect started/approved work; Admin may explicitly update pending
stages. A changed owner role clears affected pending assignments for reassignment.

Core gates: manual WhatsApp group metadata and documents; approved final survey;
production-load planning for every company; verified contractually due cumulative
receipts before dispatch; installation/glass/audit checks before handover; review
requests after handover without requiring a testimonial, URL or positive outcome
for declined/unanswered requests. Evidence dates follow related activities.

Acceptance: all sixteen stages complete in isolated integration tests for every
company with multiple planned loads. Role/branch/record scope, permission revocation,
forbidden skips, required evidence, rejection/resubmission, stale/concurrent approval,
partial contractual payments, S-Grip glass checks and declined reviews are tested.
Browser tests cover desktop/mobile assignment, forms, approval, filters, reload,
configuration and honest Storage errors. Detailed evidence and live prerequisites:
docs/POSTSALES_ENGINE.md. Supabase migration and live Storage verification remain
pending real environment settings. No deployment or push was performed.
Verified 24 October 2026: lint, TypeScript and production build pass; 20 unit tests,
40 isolated PostgreSQL integration tests, 8 public browser tests and 8 authenticated
desktop/mobile browser tests pass, including existing employee/pre-sales regression.

## Phase 5 — Production loads (implemented; live acceptance pending)

Shared production load planning and fulfillment for Finesta Home, IBAX and S-Grip.
The production dashboard and load detail page include real Won-order selection,
per-item allocation, active production owner, ready/pending indicators, quantity
progress, production order/start/estimate, factory readiness, Accounts milestone
verification, dispatch, delivery, installation, engineer audit and completion.
Load timelines and immutable paginated history remain independent of parent stages.

Transactions, optimistic versions, unique allocation rows and database triggers
prevent duplicates, cross-order links and concurrent over-allocation. Pending
unallocated quantities remain visible. Released allocations cannot be rewritten.
One item may be divided across loads, including 40 items as 30 ready and 10 pending.
S-Grip glass Yes/No and ordered checks stay inside the existing order/load.

Acceptance: each company supports one/multiple independent loads; invalid quantities,
duplicate rows and over-allocation fail without partial writes; current permissions
apply to every operation. Load completion never completes the order. Handover
requires full allocation and completion of all allocated loads, with approved order
installation/audit checks. Desktop/mobile creation, editing, filters and reload are
automated. See docs/PRODUCTION_LOADS.md for migration, security and live acceptance.
Reviewed migrations 0012–0013 are ready; applying them to real Supabase and testing
independent concurrent connections remain pending environment configuration.

## Phase 6 — Payments, dispatch and delivery (implemented; live acceptance pending)

Payment and dispatch dashboards now use real scoped PostgreSQL data at /payments
and /dispatch, with company/customer/status filters, SQL pagination and per-order
workspaces. Installments record precise INR amounts, mode, transaction reference,
actual date, receipt attachment, Accounts decision and verifier/date. Reported and
verified balances are distinct. Multiple installments fund explicit load milestones;
Admin configures amounts, dates, contract references and before-dispatch conditions.
Unique references, immutable allocations and database counters prevent duplicate
funding, overpayment, cross-order allocation and concurrent over-allocation.

Dispatch supports factory-ready item quantities, transporter, vehicle, tracking,
expected delivery, private challan, coordinator approval, actual shipment date and
status. Payment and evidence gates are rechecked at approval and actual dispatch.
Multiple consignments can serve a load. Delivery drafts/confirmations retain actual
site dates, recipients, received/damaged/missing quantities, remarks and private proof.
Partial receipts preserve the outstanding balance; missing observations can be
fulfilled later. Cancelled unshipped/unconfirmed drafts preserve history. Load status
reflects actual aggregate quantities; manual payment/shipping shortcuts are disabled.

Acceptance: full and partial payments, real Accounts verification, revoked grants,
unverified-payment dispatch blocks, duplicate/negative/excess money, concurrent
receipt attempts, multiple consignments, partial/full delivery, damaged/missing
observations, immutable history and private file authorization are automated.
Operational readers see shipment evidence and funding summaries; receipt records,
financial events and receipt downloads require current payment permission.
See docs/PAYMENTS_DISPATCH_DELIVERY.md for rules and migration/live prerequisites.
Reviewed migrations 0014–0015 are ready; real Supabase migration/Storage acceptance
remain pending environment configuration. No deployment or push was performed.

Remaining Phase 6 work: bank reconciliation, refunds/reversals/chargebacks, return
and replacement logistics and external provider integrations. WhatsApp/review
provider integrations require explicit requirements and authorization.

Phase 6 verification, 24 October 2026: ESLint and TypeScript pass; production build
passes; 28 unit tests, 45 isolated database integration tests, 8 public browser checks
and 12 authenticated desktop/mobile browser tests pass. Payment/shipping screenshots
were visually reviewed; horizontal overflow checks pass. Browser test identities are
separate to respect the unchanged production account/IP login limits. Supabase
transport, target migration and independent-connection acceptance remain pending
real environment settings.

## Phase 7 — Installation, quality, handover and customer care (implemented; live acceptance pending)

`/installations` and its order workspace persist named installation teams, active
branch employees, planned/actual/completed dates, exact per-item installed quantities,
pending balances, private photos, status and remarks. Only confirmed delivered loads
can start. Append-only entries, request IDs, optimistic versions and PostgreSQL
capacity counters prevent duplicate/retried or excessive installed quantities.

S-Grip installation alone records an explicit Glass Required Yes/No. Required glass
stores multiple dimension rows/units, responsible employee/date, uploaded prepared
template, preparer and approver/date in the same existing order/installation. No
skips the checklist; no separate glass production, dispatch or installation is created.

Assigned service engineers record inspections, seven canonical quality checks,
findings/photos, due/assigned punch items, corrective resolution, submission,
changes-required decisions and final approval. Installation completion, passing or
justified Not Applicable checks, resolved punch items and photos gate approval.
Approved records/evidence retain immutable history. Actual dates follow prerequisites.

Final handover requires all confirmed quantities allocated, every applicable load
complete, installation and required glass complete, approved audits, preceding
workflow approvals, mandatory certificate/report/warranty uploads and explicit
customer acceptance. Save actual date, representative, signed reference and confirming
employee/time. Order stages 12–16 validate these records; generic load status forms
cannot bypass the dedicated installation/audit/handover services. One completed load
never completes the order. Empty planning drafts are excluded from applicable loads.

`/service` supplies company/customer/status/priority/overdue filters and server
pagination. After handover, persist Google-review/testimonial request dates, feedback
status, optional rating/testimonial/URL and publication consent. Declined requests
and low ratings remain valid; no positive review or automated sending is required.
Service and complaint tickets retain engineer assignment, priority/due date, private
evidence, progress/waiting/resolution/closure and coordinator reopening/reassignment.
Customer care remains available after the order workflow closes.

Acceptance: complete installation, required/skipped glass, failed/corrected/passed
audits, all-load handover, mandatory documents, customer acceptance, declined
feedback and service resolution/reopening persist. Current session, active branch,
company/record scope, assigned employee and current grants are enforced for every
action and download. Every mutation is audited in its transaction. Private RLS
defaults, immutable evidence/history and database quantity guards are reviewed in
migrations 0016–0017. See docs/INSTALLATION_AFTERCARE.md for rollout prerequisites.
Live Supabase migration/Storage and legacy-evidence reconciliation remain pending
configured credentials. No deployment or source push is performed.

Phase 7 verification, 24 October 2026: `npm run lint`, `npm run typecheck`,
`npm test`, `npm run test:integration`, `npm run build`, `npm run test:e2e`
and `npm run test:e2e:auth` pass. Results: 33 unit tests, 47 isolated PostgreSQL
integration tests, 8 public browser checks and 14 authenticated desktop/mobile
browser tests. New browser flows cover installed quantity validation, ordered
S-Grip template approval, completion, engineer inspection/approval, independent
load completion, handover preparation, reload persistence, focus and overflow.
Desktop/mobile screenshots were visually reviewed. Database scenarios cover full
handover acceptance, mandatory document gates, declined feedback, service complaint
resolution/reopening/reassignment, current grants, scope and immutable evidence.
Live connection and Storage credentials remain empty; target migration, real
Storage upload/signing and independent-connection verification were not performed.

## Phase 8 — Management, reporting and Admin Panel (implemented; live acceptance pending)

The management dashboard at `/` shows all nineteen requested KPIs from scoped SQL:
lead totals/active/Won/Lost/conversion/pipeline, confirmed values, follow-ups, surveys,
production orders and active/delayed loads, verified receipts/outstanding balances,
dispatch, installation, audit, handover and service queues. Money is aggregated
independently of child rows to prevent duplicated totals. Company, Financial Year,
inclusive IST date range, territory, sales executive and status filters use SQL.
Users without report access retain their operational/pre-sales workspace. Financial
values require payment access and otherwise display Restricted.

`/reports` implements all ten requested reports, SQL pagination, CSV and real Excel
export. Exports use the full filtered result independently of page, preserve exact
decimal text, neutralize CSV formulas, recheck current permissions transactionally
and record export audit metadata. Requests above 10,000 rows require narrower filters.
Report entity statuses support completed loads within unfinished orders. Date bases
are explicit. Grouped queries and new cohort/owner/due-date indexes reduce scanning.

`/settings` is the organization-scoped Admin Panel for company contact/intake details,
active territories, product categories, payment templates, mandatory documents and
SLA grace rules. Existing employee/role permissions and workflow stage settings are
linked directly. Company identities and canonical roles/stages remain unchanged.
Territories feed lead forms and validation; payment templates prefill explicitly
reviewed load milestones. New orders snapshot document requirements so later Admin
changes cannot rewrite obligations or approved history. Settings retain versions,
soft-disabled records, immutable identity and before/after audits.

`/notifications` and the shell bell show actual overdue follow-ups, production,
contractual payments, installation and audits. Current record/module permissions
apply. Per-user read/dismiss state persists; resolved sources disappear and changed
due dates can alert again. Visible pages refresh the count each minute; no external
messaging or provider integration is claimed. Reviewed migrations 0018–0020 add RLS,
configuration/receipt tables, document tags/snapshots, guards and query indexes.

Acceptance: role/company scope and revoked grants, verified financial aggregates,
all reports, filters, complete paginated exports, formula/decimal safety, Admin
CRUD/versioning, territory/intake rules, immutable document snapshots and read/dismiss
notifications are automated. Desktop/mobile forms, exports, reload, focus and overflow
are checked against the production build. See docs/MANAGEMENT_REPORTING.md for KPI
and date definitions, export limits and live acceptance prerequisites. Supabase
credentials remain empty; target migration, Storage and production-scale query plans
remain pending. No deployment or source push is performed.

Phase 8 verification, 24 October 2026: `npm run lint`, `npm run typecheck`,
`npm test`, `npm run test:integration`, `npm run build`, `npm run test:e2e`
and `npm run test:e2e:auth` pass. Results: 37 unit tests, 52 isolated database
integration tests, 8 public browser checks and 16 authenticated desktop/mobile
browser tests. New browser coverage exercises Admin territory create/edit/reload,
all nineteen KPIs, date filters, CSV and genuine Excel downloads, date rendering,
notification read/dismiss persistence, permission-editor navigation, keyboard focus
and horizontal overflow. Dashboard and report screenshots were visually reviewed.
The complete existing employee/pre-sales/production/financial/aftercare browser suite
passes with the shared runtime connection pool; protected sidebar links no longer
prefetch every module. The production dependency audit reports zero vulnerabilities.
Live Supabase connection and Storage credentials remain empty, so target migration,
real Storage and production-scale independent-connection query plans remain pending.
No deployment, source push or external customer communication was performed.

## Phase 9 — Production readiness (repository audit implemented; live release on hold)

Reviewed authentication allowlists, current session/role/branch checks, transactional
mutation authorization, tenant/file boundaries, immutable history, exact financial
totals, report exports and all workflow gates. Corrected remote database certificate
verification in both runtime and migration connections; DATABASE_SSL_CA optionally
supplies the trusted project certificate. Replaced fully buffered JSON checks with
streaming byte limits, applied no-store to API/auth errors, and added per-document
nonce CSP and browser security headers. Added regression tests for payload rejection,
verified TLS options, nonce rotation and blocked inline HTML event-handler injection.

CI uses verified pinned action commits, non-persisted checkout credentials, read-only
token permissions and a production dependency audit. Dependabot prepares reviewed
updates. Generated browser artifacts are excluded from lint. No dependency upgrade,
database schema change, migration application or deployment is part of this audit.

See docs/PRODUCTION_READINESS_AUDIT.md for findings, evidence boundaries and workflow
coverage. docs/DEPLOYMENT_CHECKLIST.md contains sequenced Supabase/GitHub/Vercel setup,
staging acceptance, backup/Storage restore, rollback and release sign-off procedures.
Written procedures do not imply recovery or platform settings have been exercised.

Live acceptance remains required: actual Supabase credentials are empty; apply and
verify migrations 0000–0020 and private Storage in staging, exercise independent
PostgreSQL connection races, measure query plans/concurrency, complete database and
Storage restore drills, configure hosted CI/branch protections/environment isolation,
verify HTTPS/cookies/proxy throttling/monitoring, and obtain deployment authorization.
No Git remote is configured and source remains untracked. No push/provision/deploy
or external messaging occurred. Production release is explicitly on hold.

Phase 9 verification, 24 October 2026: lint, TypeScript, 45 unit tests, 53 isolated
database integration tests, production build, 10 public browser checks and 16
authenticated desktop/mobile lifecycle checks pass. Production dependency audit:
zero known vulnerabilities. A stale OneDrive `.next` EPERM was resolved by removing
only the verified workspace build output and rebuilding. The CSP regression test
was corrected to exercise injected HTML handlers rather than an intentionally
trusted dynamic script loader; the policy was not weakened. GitHub Action v7
commits were resolved against official upstream tags. Hosted CI itself, actual
Supabase TLS/Storage, independent server connections and recovery remain unverified.

### User-requested persistent localhost test setup

Added `npm run local:test`: an explicit loopback-only, disk-persistent PGlite test
harness using the reviewed migration runner and normal Better Auth bootstrap.
Identity and randomly generated secrets are kept under ignored `.local/siteflow-test`;
no credentials or identity are hardcoded in tracked source. Existing users and CRM
records survive restarts and are never reseeded/reset. First-login password change
remains required. The harness overrides child database/auth/Storage environment,
does not load real .env.local credentials for setup, and refuses CI/Vercel execution.
No production client fallback was introduced. Docker startup was unavailable, so
this uses the installed test engine; native PostgreSQL concurrency and Supabase
Storage acceptance remain separate. See docs/LOCAL_TESTING.md for restart and limits.

Local setup verification: lint, TypeScript, 45 unit tests, 53 isolated integration
tests and fresh production build pass. Real local API sign-in/sign-out and the
mandatory first-password-change redirect were verified. After stopping/restarting
the disk-backed harness, a Chromium UI login reached the password-change form and
signed out successfully, confirming the same administrator persisted. The password
was not changed by automation; its random temporary value remains in the ignored
local login file. Localhost was left running. No Supabase credentials or data changed.

### Supabase/Vercel release requested — 25 October 2026

The user authorized going live with the existing Supabase database and Vercel.
Added reviewed Next.js `vercel.json` install/build commands, pinned the package
engine and lockfile to Node 24, and added explicit `.vercelignore` exclusions for
local database/accounts, secrets, keys and local test infrastructure. Configuration
and lockfile consistency checks pass. No application workflow changed.

Connected GitHub access was inspected; no SiteFlow repository/remote is selected.
The workspace has no linked Vercel project or available CLI session, and Supabase
database/Storage secrets remain empty. The target Supabase project's existing data
status, project links and secure credential configuration were requested. Do not
copy local test data/passwords into production. Deployment authorization is granted;
target selection, access and live acceptance gates still need completion. No source
push, live migration, bucket provisioning or deployment has occurred in this step.

Release progress: the user selected Ansh9728333/crmfnesta (initially empty) and
completed Vercel login for the existing Bajrang workspace. Read-only inspection
confirmed Supabase PostgreSQL 17.11, an empty public schema and no CRM ledger.
Downloaded the public Supabase Root 2021 CA and configured verified TLS; applied
reviewed migrations 0000–0020 successfully. Secrets remain ignored; the supplied
legacy Storage key was not saved or used. A 301-file source scan found no current
auth/database secrets, private keys or token patterns. Source publication and
Vercel deployment are next; replacement Storage key is still pending. No test data
or local administrator password has been copied to the live project.

Release progress continued: source commit 2efe880 was pushed to the selected main
branch and hosted full CI passed. The signed-in Vercel workspace created crmfnesta;
its verified default domain is crmfnesta.vercel.app. Configured eight production
variables through stdin without exposing values in argv/logs, excluding DIRECT_URL
and bootstrap variables. Singapore region is selected to match the Supabase pooler.
Vercel's GitHub integration needs an account login connection, so deployment will
use the authenticated CLI while source remains versioned on GitHub.

The user explicitly approved the live all-company Super Admin, provisioned through
Better Auth with a new random password and first-login change. The local test
password and customer/order fixtures were not copied. The user repeated the supplied
legacy Storage key after the exposure warning and directed setup to continue; it is
kept only in ignored local configuration and Vercel's production secret storage.
Live private Storage upload, anonymous-access denial and signed byte integrity pass;
the unique non-customer probe was removed. Credential rotation remains recommended.
Read-only checks confirm 21 applied migration hashes, 53 RLS-enabled tables, no
effective browser table grants and the restrictive private-bucket policy. A Vercel
dry-run manifest excludes all local data/secrets and test infrastructure. Fresh lint,
TypeScript and 45 unit tests pass; the first pushed commit's full hosted CI also
ran integration/browser/build checks successfully. Production deployment follows.

Live release completed, 25 October 2026: application commit 2357ee3 is deployed at
https://crmfnesta.vercel.app (dpl_CB3wbcVUeHgt8FotmG5bkP1VUWbg). Vercel clean npm ci
reported zero vulnerabilities; production build/typecheck passed, and runtime
functions are confirmed in sin1. The deployed commit's full hosted CI passed.
Live HTTPS checks passed for sign-in, no-store/CSP/security headers, anonymous/raw
Admin denial, secure session cookies, first-login password-change and 428 API gates,
logout/revocation. Chromium desktop sign-in/change-password/sign-out and mobile
layout checks passed; screenshots were captured before credentials were filled.
Production password was not changed by automation; the user must change it at first
login. No fake customer/lead/order records were inserted. See DEPLOYMENT_STATUS.md
for exact evidence, credential-rotation recommendation, GitHub auto-deploy connection
requirement and unperformed recovery/concurrency/performance/business acceptance.

Phase 5 verification, 24 October 2026: lint, TypeScript and production build pass;
24 unit tests, 43 isolated database integration tests, 8 public browser checks and
10 authenticated desktop/mobile browser tests pass. Single/multiple loads, 40-item
30/10 splits for every company, pending quantities/readiness, concurrent allocation
attempts, SQL counter/capacity guards, independent early production, immutable
history, permissions and handover aggregation are covered. Live Supabase migration
and independent-connection verification remain pending real environment settings.

## Phase 10 — Reference-inspired theme and Admin-selected account passwords

User requested a charcoal navigation/header and bright multi-colour dashboard based
on the supplied image, plus Admin-created username/password/designation without
temporary credentials or first-login change. Shared semantic tokens, shell, mobile
drawer, metric-card primitive and management/pre-sales/order views are updated.
Operational bars and collection summaries use existing scoped real metrics only.

Employee creation/reset/bootstrap now preserve the Admin-selected password as the
normal login password. Designation labels map to the canonical permission-bearing
company/branch role assignments. Password hashing, minimum length, Admin scope,
session revocation and public endpoint restrictions remain enforced. Optional own
password changes are retained. Reviewed migration 0021 retires legacy flags with
immutable policy audits and leaves credential hashes unchanged. Acceptance: direct
login after create/reset, unauthorized management denial, designation scope, audited
backfill, all regression suites, responsive/focus checks and production rollout.
See docs/UI_ADMIN_ACCOUNTS.md. Verification and rollout results follow below.

Phase 10 verification: lint, TypeScript, 45 unit tests, 54 isolated database tests,
production build, all 10 public browser checks and all 16 authenticated desktop/mobile
CRM browser tests pass. Four focused employee/management browser checks were repeated
successfully after final spacing/contrast refinements. Browser coverage verifies direct
create/reset login, designation access, revoked sessions, real global search, mobile
navigation focus restoration and no horizontal overflow. Dashboard screenshots were
reviewed. Tested card/body contrast pairs exceed 4.5:1. Legacy password hashes remain
unchanged during the audited flag backfill. Generated Better Auth schema is unchanged.

Migration publication review also detected historical Git newline normalization on
five already-applied SQL artifacts. Their SQL was not changed; .gitattributes now
preserves original SQL bytes, and the staged artifacts match the actual previously
applied sources. No database ledger hashes were rewritten. This keeps future clean
checkouts/migration hash verification reproducible. Live rollout follows.

Phase 10 live rollout completed: migration 0021 applied through the reviewed runner;
all 22 hashes match and 53-table RLS/browser restrictions remain verified. UI/account
release b5d5791 and final copy clarification 417871d both passed full hosted CI.
Final production deployment is dpl_3AwgW6PnF2HwG2hQiMG3uAhYfPUp at the existing
https://crmfnesta.vercel.app URL. Production build and HTTPS verification pass.
Real existing-password login now reaches the dashboard and Admin API directly;
no password was reset. Secure cookies, public endpoint denial, optional own-password
page and sign-out revocation remain verified. Live desktop/mobile theme and account
form checks pass: Admin password input is empty, designation is selectable, and no
temporary credential is generated. No production employee/customer/order test record
was created or changed. Private login instructions were relabelled without changing
the saved password. The final deployed release's hosted CI is successful; updated
release evidence is in docs/DEPLOYMENT_STATUS.md.

## Phase 11 — General Help Tickets

User approved contextual Lead/Project intake, assigned resolver panel, independent
creator confirmation, rejected resolution/reopening, private supporting evidence,
Admin concern/SLA settings and immutable history. The shared module is separate
from existing after-handover service tickets and supports all three companies.

Implementation: first Workspace navigation item; create dialog; scoped list/tabs,
filters/pagination and counts; detail drawer/full page; resolve/confirm/reopen;
Admin reassignment and concern/evidence/SLA settings; real notification tasks;
four RLS-protected tables with reviewed migrations 0022/0023. Uploads go directly
to a separate private 10 MiB bucket, with server-side verification and transactional
claiming. Default permissions are limited to existing sales intake/service roles;
other role grants remain Admin-controlled. See docs/HELP_TICKETS.md.

Acceptance: real database persistence before handover; accurate source/creator;
no unauthorized branch/employee access; independent confirmation including a
separate Admin for self-assignment; all attempts survive reopening; stale and
duplicate submissions prevented; private valid evidence only; responsive and
keyboard-accessible forms/drawer; all regression checks. Validation/rollout
evidence will be recorded after completion.

Phase 11 verification: lint, TypeScript, 49 unit tests, 66 isolated database tests,
10 public browser checks, 18 authenticated desktop/mobile checks and the production
build pass. A focused Help Ticket browser run also passes for both viewports.
Screenshots were reviewed; drawer focus and mobile overflow checks pass. Tests
include all three companies, real session identities, notification read receipts,
repeated resolutions/reopening, independent confirmation, source relinking,
current permissions, private file claiming and default-deny tables/Storage.

Approved live preparation: previous 22 migration hashes matched their unchanged
source prefix. Additive migrations 0022/0023 applied successfully; all 24 ledger
hashes now match, all 57 tables have RLS and browser grants remain revoked. The
separate private Help bucket is configured with a 10 MiB limit. Storage capability
verification, source publication and application rollout follow.

Live Storage verification passes: actual 10 MiB direct signed upload, immutable-path
overwrite denial, exact byte integrity, private signed download, anonymous denial,
oversized upload rejection and cleanup of the unique infrastructure probes. No
production CRM/customer/employee fixtures were inserted or modified.

Phase 11 rollout completed: release ba0f4b7 is pushed to the authorized GitHub main
branch and deployed as dpl_B2iYyas1Uo7u97wELYUJLznk5bLW at the existing production
URL. The exact deployed commit's full hosted CI is successful. Live existing-login,
Help API/list/source queries, scoped concern settings, private no-store/CSP and
desktop/mobile empty-form checks pass. General authentication/revocation smoke
checks also pass. No production customer/employee/ticket test fixtures were created
or changed. Remaining operator work: customer-specific live business acceptance,
abandoned-upload cleanup policy, optional malware scanning, and the previously
documented backup/recovery/performance operations. See docs/DEPLOYMENT_STATUS.md.

## Phase 12 — Visible Help intake questions and shared company directories

User requested every original form question immediately, a typable location, all
employees' clients in the picker, and every active employee as a possible resolver.
Implemented dedicated company-scoped minimal client lookup (name/mobile), automatic
initial pages, search/pagination, client-only intake, optional project/lead linkage,
typed location snapshots and all active company employee choices. Real submitter
identity remains session-derived and immutable. Named assignment provides only that
ticket's read/resolve authority; general CRM permissions stay independent. The old
global help.resolve toggle is retired, without broad role grants or rewriting old
audit/migration artifacts. Additive migrations 0024/0025 preserve old tickets.

Acceptance: questions visible before client selection; colleagues' clients listed;
mobile/name search and company isolation; no inherited full-lead access; no-project
client submission; custom location survives reload; active Accounts/sales employees
can resolve their assigned tickets only; creator confirms independently; inactive
accounts lose access; all quality/browser checks and approved live rollout.

Phase 12 validation: lint, TypeScript, 49 unit tests, 68 isolated database tests,
10 public browser checks, 18 authenticated desktop/mobile checks and production
build pass. A focused 14-case Help database run also verifies private proof uploads
by assigned Accounts staff and previous-version inserts during rolling deployment.
Screenshots reviewed. Live migrations 0024/0025 applied; all 26 hashes match, all
57 tables retain RLS/browser denial and both private Storage guards are present.
Source publication and application rollout follow; no production fixtures used.

Phase 12 initial rollout completed: 4e23d47 is pushed/deployed at the existing URL
as dpl_DNgMUSN4i6JCn9qyHbpMMRkDECpX; its full hosted CI passed. Live desktop/mobile
questions, editable location, real company client/employee option counts, immutable
submitter and notification query pass. General auth/security smoke checks pass.
An additional compatibility review found retired permission strings could remain
in the Admin editor's hidden selection. A small follow-up filters them out and adds
browser coverage with seeded legacy grants; final follow-up verification follows.

Phase 12 completed: compatibility follow-up c17d8f0 is pushed and deployed as
dpl_7BG8XQ6GTwjA3HULd8TM1eBkKpyN at the existing production URL. Lint, TypeScript,
49 unit, 68 database tests and production build pass; focused desktop/mobile Help
and employee checks pass with historical permission rows. The final release's full
hosted CI passed, including all public/authenticated browser regressions. Final
read-only production form/real dropdown/typing/identity/notification checks pass.
All original questions are present before client selection. Live CRM records,
employee assignments, credentials and role grants were not changed during testing.

## Phase 13 — Operating guide and Customer to Project lookup review

User requested a detailed Hindi Word operating guide, end-to-end workflow testing,
completion status and an explanation of the empty Add Project customer list.
Inspection found the picker previously loaded only after Find. It now autoloads
permitted customers on opening/company change, displays loading/no-result guidance,
retains real names for preselected customers, and supports Enter search. A scoped
customer-ID filter preserves the existing customer/lead/company access predicate.
No general record permissions or company ownership rules were widened.

Expanded tests cover direct customer creation, automatic picker options, empty/name
search, project creation/reload and successful preselected-ID requests. Database
coverage denies another employee's customer-ID lookup. A separate Documents index
is still planned; its copy now directs users to implemented contextual uploads.
The requested private Word guide documents modules, prerequisites, all 7/16 stages,
quotations, loads, payments, aftercare, Help, permissions, testing and limitations.
No credentials or real customer information belong in the published source/manual.

Validation: lint and TypeScript pass, 49 unit tests and 69 isolated database tests
pass, production build passes, and 10 public plus 18 authenticated desktop/mobile
browser cases pass. Two focused pre-sales browser cases additionally verify the
selected-customer request returns HTTP 200. Release `45dc445` is live; read-only
desktop/mobile checks confirm automatic options and scoped linked-name lookup.
Production verification submitted no CRM forms and changed no customer records.
