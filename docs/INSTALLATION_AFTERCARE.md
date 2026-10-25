# Installation, quality, handover and customer care

## Workspace and ownership

`/installations` lists permission-scoped Won orders with company/customer filters and
server pagination. `/installations?orderId=<id>` contains each load's installation,
S-Grip checklist, engineer audit, handover pack and immutable activity history.
`/service` lists assigned/scoped tickets with status, priority, overdue, company and
customer filters. `/service?orderId=<id>` records feedback and customer service.
Order and production-load pages link to these workspaces.

Coordinators plan named teams, active branch employees and dates. Only assigned
installers (or company Admin) record installation work. Assigned service engineers
inspect, manage corrections and approve audits. Coordinators assign/reassign tickets;
assigned engineers progress them. Reopening and closure require coordination rights.
Current session, employee/branch status, organization, role grants and record scope
are checked on every operation, including downloads. Mutations acquire the existing
transaction advisory lock and recheck access inside the transaction.

## Installation and glass

One installation belongs to an existing production load in the same order/company.
It stores team leader/members, planned/actual/completed dates, status and remarks.
Installation starts only after confirmed full delivery. Append-only quantity entries
allocate actual installed quantities to individual load items. PostgreSQL numeric
counters, row locks, positive/bounded constraints, optimistic versions and unique
request IDs prevent concurrent excess progress and retry duplication. Pending
quantities are calculated from confirmed load quantities. Photos are required for
completion. Completing a load never completes the parent order.

Only S-Grip installation start requires an explicit Glass Required Yes/No. No skips
all glass work. Yes requires dimension rows with units, responsible employee/date,
a prepared uploaded template and a recorded approver/date. Measurement, preparation
and approval must occur in order. Approved evidence is immutable. This checklist
stays attached to the existing installation/order: there is no glass production,
dispatch, load or installation pipeline.

## Audit and handover

An assigned engineer records actual inspection date, findings, private site photos
and seven checks: measurements, fixings, alignment, operation, finish, safety and
cleanliness. A check must pass or have a Not Applicable reason. Failed work and open
punch items block submission/approval. Corrections record responsible installer,
due date, resolution, actor and actual date. Submitted audits can be returned with
a reason. Approved audits retain the approving employee and server approval time.

Handover preparation may begin early so documents can be collected. Confirmation
requires full item allocation, all applicable loads completed, installed quantities
complete, approved audits, required S-Grip glass approval, and three mandatory private
documents: handover certificate, installation report and warranty document. Empty
planning drafts do not count as applicable loads. Workflow stages 1–14 must already
be approved. Record actual handover date, customer representative, signed acceptance
reference, explicit customer acceptance and confirming employee/time. Confirmation
locks fulfillment records. The canonical stage engine still requires its normal
owner submission/reviewer approval; it now verifies these real records at stages
12–16. Existing generic production forms cannot bypass installation/audit gates.

## Feedback, service and complaints

Feedback and service requests begin after confirmed handover and remain available
after the sixteen-stage order closes. Track actual Google-review/testimonial request
dates, requested/received/declined/no-response status, received date, optional 1–5
rating, comments, testimonial, HTTPS review URL and publication consent. Declined
requests and low ratings are valid; a positive review, URL or testimonial is never
required by the customer-feedback service. Recording a request does not send one.

Service/complaint tickets have title, description, active assigned engineer, priority,
due date, evidence and status. Flow: open → in progress → waiting for customer or
resolved → closed; waiting can resume, and coordinators can reopen resolved/closed
tickets. Resolution notes and actor/date are required. Reassignment, status decisions,
closure/reopening and feedback edits preserve before/after audited history.

## Storage and migrations

Reviewed migrations `0016_installation-aftercare.sql` and
`0017_aftercare-integrity.sql` add records, composite company/parent foreign keys,
private RLS defaults, browser-role revocations, indexes, immutable evidence/history
and quantity/status guards. Apply all reviewed migrations with `npm run db:migrate`
using the existing deployment procedure; never use `db push`. Existing historical
manual installation/audit/completion data needs reconciliation before live rollout;
do not infer approved audits, glass evidence or customer acceptance from old booleans.

Files use the existing private Supabase Storage adapter: immutable random paths,
maximum 4 MiB, signature-checked JPEG/PNG photos and PDF/JPEG/PNG documents, authorized
60-second signed download links. Database failures clean up uploaded objects.
No browser database policies or service credentials are exposed.

Official references: [Next.js data security](https://nextjs.org/docs/app/guides/data-security)
and [Supabase Storage access control](https://supabase.com/docs/guides/storage/security/access-control).
The privileged Storage/SQL clients require explicit application authorization because
Better Auth sessions are independent of Supabase browser identities.

## Acceptance and live prerequisites

Automated tests use disposable PGlite PostgreSQL migrations and real authenticated
services. Test-only file transports are injected exclusively from test fixtures;
production has no mock database or Storage fallback. Tests cover all companies,
30/10 quantities, excess/retry progress, glass Yes/No, failed/passing audits, punch
resolution, handover prerequisites, declined reviews, service transitions, permissions,
revoked grants, immutable history and private-file authorization. Desktop/mobile
browser tests exercise forms, gate failures, reload persistence, focus and overflow.

Live Supabase migration, private Storage transport, multi-connection acceptance and
production backup/restore verification require configured environment credentials.
No deployment, source push or external customer communication is performed.

Verified 24 October 2026: lint, TypeScript, production build, 33 unit tests, 47
isolated database tests, 8 public browser checks and 14 authenticated desktop/mobile
browser tests pass. Installation screenshots were reviewed; keyboard focus and
horizontal overflow assertions pass. Live Supabase credentials remain empty, so
no target migration, actual Storage acceptance, deployment or push was performed.
