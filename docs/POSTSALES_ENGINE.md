# Unified post-sales workflow engine

## Delivered routes

- `/orders`: SQL-filtered/paginated order dashboard, company search/filter, current
  task filters (active, completed, overdue, unassigned, approval, mine) and real alerts.
- `/orders/[id]`: approved progress, all sixteen stage indicators, owner/target
  planning, stage-specific forms, approval/rejection, document panel and audit timeline.
- `/orders/settings`: Admin-only company policies for roles and mandatory fields.
- `/api/orders`, `/api/orders/[id]`, `/api/orders/configuration`: authenticated services.
- `/api/orders/[id]/stages/[number]`: audited typed stage actions.
- `/api/orders/[id]/stages/[number]/documents`: bounded private uploads.
- `/api/orders/[id]/documents/[fileId]`: authorized 60-second download link.

## State and approvals

Won conversion creates the sixteen pending stage records in its existing transaction.
Each stores the canonical stage name, status, owner/reviewer role policy snapshot,
mandatory fields, actual employee assignment, planned/started/submitted/completed
timestamps, notes, JSON evidence, approving user and optimistic version.
Documents link to their exact order/stage/company. Every initialization, assignment,
evidence edit, document upload, submission, rejection, approval and policy change
records an immutable before/after event with actor and time.

Pending stages require an active owner and target date before starting. Evidence
edits are permitted in in-progress/changes-requested states. Submit validates the
stage fields, required files and core business dependencies. Awaiting-review data
is locked; a reviewer approves it or requests changes with a reason. Approval
revalidates the gates, records the approver/completion time, and unlocks only the
next stage. Stage 16 approval closes the order. Completed records are immutable;
there is no generic reopen/skip endpoint. Corrections to completed work need a future
explicit audited amendment process rather than overwriting accepted evidence.

An existing converted order at stage 1 can be explicitly initialized by a scoped
coordinator. Orders without Won/quotation provenance or with ambiguous pre-existing
workflow progress require review; initialization never invents past completions.

## Standard stage evidence

| Stage                            | Required evidence in addition to stage notes                                         |
| -------------------------------- | ------------------------------------------------------------------------------------ |
| WhatsApp Group Created           | Actual group name, invitation link, creation date, attachment                        |
| Documents Uploaded               | Contract reference, payment/credit terms, cumulative INR due by dispatch, attachment |
| Final Survey Appointment         | Appointment date/time and site contact                                               |
| Final Survey and Measurement     | Named measurements with positive values/units, findings, attachment                  |
| Site Readiness Confirmed         | Passed readiness checks and supporting notes                                         |
| Production Load Planning         | Load count (1–100) and plan/allocation reference                                     |
| Production Order Released        | Release reference/date; approved survey, readiness and load plan                     |
| Factory Production and Readiness | All-load readiness confirmation and factory reference                                |
| Customer Payment Received        | Verified cumulative receipts, references, verification date and attachment           |
| Material Dispatched              | Transport reference, carrier and dispatch date; approved payment coverage            |
| Material Delivered               | Delivery receipt, recipient and delivery date                                        |
| Installation Started             | Actual start date; explicit Glass Required Yes/No for S-Grip                         |
| Installation Completed           | All-load installation checks/date; S-Grip glass checks when required                 |
| Service Engineer Audit           | Passed audit, findings/date and attachment                                           |
| Site Handover                    | Recorded acceptance/checks, representative/date and attachment                       |
| Testimonial and Google Review    | Request date and neutral outcome; no positive-rating gate                            |

WhatsApp metadata is manually recorded; the application creates no groups or
messages. Review requests similarly record the team's actions, with no provider
integration claimed. Declined/no-response requests can close without a testimonial
or review URL even when policy requires those fields for received reviews.

The approved contract defines cumulative payment due by dispatch. Verified receipts
must cover that amount; no full-payment percentage is invented. Zero due is possible
under documented, approved credit terms. This is staff verification of evidence,
not automatic bank validation or a full receipts ledger. Actual evidence dates
cannot be in the future (appointments may be planned ahead); related dispatch,
delivery, installation, audit, handover and review dates follow their prerequisites.

Stage 6 approval verifies actual production loads and item allocations for every
company. The engine records aggregate order milestones and retains approved
installation/audit checks. Phase 5 now provides detailed item allocation, independent
per-load progress, partial quantities and handover aggregation; see
[production loads](PRODUCTION_LOADS.md). Load statuses come from explicit audited
load operations. S-Grip glass evidence stays within the order and its loads, with
no separate glass pipeline.

## Policy and authorization

Admin/Super Admin authority is company scoped. Coordinators with orders.manage
assign stage owners/targets in their authorized branch; normal specialists can
record evidence only for their own assigned stage with the configured role and
module permission. A configured reviewer role authorizes review within its branch;
production release, payment and audit review also require production.manage,
payments.manage and audits.manage respectively. Administrators can review but
cannot bypass core evidence checks. Self-review is permitted when the role policy
authorizes it; no unrequested two-person approval rule is implied.

Order read scope includes the original order owner, explicitly assigned stage
workers, authorized pending reviewers and prior approvers in permitted branches.
Sales Managers/Post-Sales Coordinators coordinate branch orders; Admins remain
organization scoped. Every service revalidates the active database session and
current grants. Permission/employee changes and workflow mutations use the same
transaction advisory lock. Stale/concurrent approval cannot duplicate advances or
production loads. Core gates also verify every preceding stage, not just a mutable
current-stage pointer.

Company policy changes apply to future orders. Admin can explicitly apply changes
to up to 200 matching pending stages atomically; started/approved work is unchanged.
Changing the owner role clears pending assignments. Policies cannot rename/reorder
the shared process, remove core fields, invent positive review requirements or
authorize an owner role without the stage module/order permissions.

Private uploads validate size, MIME/signature, active stage and caller. They create
unique object paths without overwrite, retain immutable metadata and authorize
downloads on every request. File addition does not overwrite unsaved form evidence.
Provider failure leaves no successful document record; transaction failure attempts
object cleanup. Operational reconciliation for ambiguous provider/connection errors
and a distributed upload-finalization design remain production-hardening work.

## Implementation and migrations

src/lib/orders contains shared stage definitions, typed validation, initialization
and the transactional service. src/features/orders contains separate dashboard,
stage editor, fields, document panel, configuration, workspace and timeline components.
Existing Won conversion invokes initializeOrderStages inside its transaction.
Existing authorization predicates now include assigned/review stage work.

- 0009_post-sales-engine.sql: order completion, stage/document linkage and three
  new tables (order_stages, order_stage_events, order_stage_policies).
- 0010_post-sales-security.sql: RLS/grant denial, statuses, completed-stage/audit/
  document immutability and orders.read defaults for survey/installation/service roles.
- 0011_order-document-stage-scope.sql: composite document/stage/company FK.

The server's privileged database connection bypasses RLS; explicit service predicates
are mandatory. No Supabase Auth/auth.uid assumption or browser database key was added.
Production uses the existing Supabase/Postgres.js runtime and private Storage adapter.

## Verification and live prerequisites

Unit coverage: exact shared definitions, typed/unknown fields, measurement bounds,
manual WhatsApp metadata/files, date checks, ordered glass checks, and review refusal
without a testimonial/URL. Integration coverage runs all sixteen stages for all three
companies and two production loads each; tests skipped stages, role/record scope,
current permission revocation, core policies, required files, rejection/resubmission,
concurrent approval, partial contractual payment coverage, failed audits, review
chronology, completed history immutability and denied public table access.

Desktop/mobile browser coverage includes owner/target assignment, evidence forms,
approval, filters, configuration, reload persistence, forbidden skipping and honest
Storage errors. Its required initial attachment is seeded through the real service
using an injected test Storage transport; no production Storage fallback exists.
Positive upload/download authorization is exercised in isolated integration tests.
These tests do not establish live Supabase Storage transport or a deployed login.

Verified 24 October 2026:

| Check                                      | Result                                                       |
| ------------------------------------------ | ------------------------------------------------------------ |
| ESLint                                     | Pass, zero warnings                                          |
| TypeScript / Next route types              | Pass                                                         |
| Unit tests                                 | 20 passed                                                    |
| Isolated PostgreSQL integration tests      | 40 passed                                                    |
| Public desktop/mobile browser tests        | 8 passed                                                     |
| Authenticated desktop/mobile browser tests | 8 passed                                                     |
| Production build                           | Pass                                                         |
| Responsive visual review                   | Desktop/mobile order screenshots reviewed; width checks pass |

The full authenticated suite retains employee and pre-sales coverage alongside the
new engine. All sixteen stages are exercised for all three companies in integration
tests. Concurrent load-plan approvals produce one advancement and exactly two loads;
receipts covering only the contractually due INR 40 of a INR 100 order permit dispatch.
An unapproved survey, failed audit, missing glass approval, insufficient contractual
receipts or backdated review request blocks progression. Declined reviews close
without a testimonial, URL or rating requirement.

Commands: npm run lint, npm run typecheck, npm test, npm run test:integration,
npm run build (also combined in npm run check), npm run test:e2e and
npm run test:e2e:auth. Reviewed migrations were generated with npm run db:generate;
changed files were formatted with Prettier and desktop/mobile screenshots reviewed.

DATABASE_URL, DIRECT_URL, BETTER_AUTH_SECRET and private Storage settings are still
unconfigured in the ignored .env.local. Inspect the actual Supabase target, apply
all migrations with npm run db:migrate and verify real authenticated CRUD/Storage
once those settings are available. Local suites never load real project credentials.
No real-project migration, deployment, external messaging or push was performed.

The source/security design follows [Next.js server data-access guidance](https://nextjs.org/docs/app/guides/data-security)
and [Supabase private Storage access controls](https://supabase.com/docs/guides/storage/security/access-control).

## Production load integration

Detailed per-load allocation and fulfillment are now implemented in Phase 5:
[Production loads](PRODUCTION_LOADS.md). The earlier Phase 4 acceptance counts above
are historical. Final handover additionally checks complete allocation of confirmed
item quantities and completion of every load with allocations; its date must follow
load completion. Empty planning drafts are excluded from fulfillment totals. Load
operations progress independently following approved survey/readiness/planning;
they do not automatically advance the parent sixteen-stage workflow.

## Ledger and actual shipment integration

The [payment and shipping module](PAYMENTS_DISPATCH_DELIVERY.md) now backs receipt
and material milestones. Stage 9 must match the actual verified receipt total.
Stages 10/11 require full shipment/receipt quantities for all allocated loads.
Private ledger receipts, challans and delivery proofs are maintained in their
respective workspaces; existing order-stage approval/evidence requirements remain.
