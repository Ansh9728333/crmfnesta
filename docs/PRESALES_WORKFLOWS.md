# Detailed pre-sales workflows

## Delivered routes and modules

- `/appointments`: permission-scoped, SQL-paginated visit directory and lead lookup.
- `/quotations`: permission-scoped, SQL-paginated quotation version directory.
- `/leads/[id]/presales`: responsive visits/quotations/showroom-negotiation/conversion
  workspace, linked from lead details and its drawer. Selected tabs survive reload.
- `/orders/[id]`: copied commercial items, customer/project/company, final value and
  quantities, creation history and all sixteen shared post-sales stages.
- `/api/leads/[id]/presales`: real authorized workflow reads and transactional writes.
- `/api/leads/[id]/attachments`: bounded multipart upload to private Storage.
- `/api/leads/[id]/attachments/[fileId]`: authorized 60-second download link.
- `/api/leads/[id]/quotations/[quoteId]/pdf`: authenticated PDF for that exact version.

## Workflow behavior

Visits store sales assignment, IST date/time, status, observations and named initial
measurements with units. Optimistic appointment versions reject stale edits.
Completed/cancelled/no-show visits cannot be overwritten; schedule a new appointment.
Full before/after records remain in the immutable lead timeline. Completing a visit
requires observations; a new follow-up joins the existing pending-task queue.
Files can link to a particular appointment or the lead. Failed Storage writes do
not create document rows or report success. Failed database writes attempt object
cleanup; operational reconciliation of provider/connection failures remains a
production readiness task. No production file store or credential fallback exists.

Scheduling and completion advance adjacent stages 2 and 3 respectively; issuing a
quotation advances adjacent stage 4, showroom outcome advances stage 5 and a
negotiation advances stage 6. Manual stage tracking remains available. The exact
canonical stages are shared across Finesta Home, IBAX and S-Grip.

Quotations issue directly as immutable versions. V1 has no revision prerequisite;
later versions require a reason and expected latest revision. Each item has name,
description, company, quantity, INR unit rate, INR discount, subtotal and final.
Decimal.js rounds each quantity × rate to paise half-up, subtracts explicit INR
discounts, then sums exact line totals. Negative/excessive discounts, invalid
precision and zero/oversized totals fail validation. Item ordering is preserved.
Customer/site/company snapshots and commercial notes remain attached to the
original version even when lead contact fields are edited later. No taxes or
external billing actions are inferred from the requested item fields.

Quotation decisions append actor/time/evidence and never update historical quote
content. Staff with quotation permission record acceptance/approval references;
this is not electronic signature collection. New revisions require a fresh decision.
PDFs use bundled static Montserrat with pagination, totals and version references.

Showroom and negotiation records are append-only. Showroom Not Required needs a
reason. A negotiation's revised offer is historical evidence; it cannot silently
replace accepted quotation prices or quantities.

Won verifies company and latest approved/accepted quotation, matching final value,
explicit quantity confirmation, open stage 6 lead and linked customer/project.
One transaction copies every item and its final quantity into an order, stores
quotation ID/value/total quantity, records closure time, cancels pending follow-ups
and initializes post-sales stage 1 with an order workflow event. The first stage is
pending, not marked completed. The unique lead/order constraint plus serialization
prevents duplicate orders; identical conversion retries return the same order ID.
The previous direct Won action is blocked server-side and links to conversion.

Lost records a required reason and closure time while preserving all prior history.
Closed workflow records become read only. Generic lead editing cannot reopen them
or change a Won order's approved values/quantities.

## Security and database

Services reuse verified Better Auth sessions, active profiles and current grants.
Queries enforce organization/branch/assigned-lead scope. Visit changes additionally
require appointments.manage; quotation issuance/decisions/PDFs require
quotations.manage; workflow writes require lead write scope. Files require lead
access for downloads and appointment management for uploads. Order detail separately
requires orders.read. Assignees must be active permitted sales employees in the
lead branch. Appointments do not transfer ownership of the underlying lead.

All mutations use the same transaction advisory lock as permission/account changes.
Origin/CSRF checks and Zod validation protect route boundaries. Uploads are bounded
before multipart parsing, reject MIME/signature mismatches, and never overwrite
existing objects. PDF routes contain no public credential or signed-link cache.

Migrations 0005–0008 extend existing appointments/quotations/orders, add separate
quotation decisions, engagements and pre-sales attachments, enable RLS and deny
browser grants, add constraints/indexes and prohibit historical updates/deletes.
The attachment/appointment composite foreign key also enforces the same lead and
company in PostgreSQL. Generated migration ordering was reviewed and corrected so
the referenced unique constraint exists before its foreign key is created.
Nullable snapshot/commercial fields preserve genuine legacy rows. A legacy quote
without complete items/snapshot cannot be approved or converted; issue a real
new version. Existing legacy Won orders are not backfilled with invented quotations.

## Verification and live setup

Unit tests cover exact decimals, line rounding, discount bounds, revision reasons
and showroom exceptions. Isolated PostgreSQL tests cover visit history/measurements,
private-file authorization, immutable revisions, revision races, approved latest
version requirements, final quantities/company/value, concurrent conversion retries,
Lost closure time/history, public grant denial and post-sales initialization.
Browser tests exercise the forms and PDF download on desktop/mobile, plus existing
employee and lead flows. Rendered quotation PDFs are visually reviewed.

Run npm run lint, npm run typecheck, npm test, npm run test:integration,
npm run build, npm run test:e2e and npm run test:e2e:auth.

Verified 24 October 2026:

| Check                                      | Result                                  |
| ------------------------------------------ | --------------------------------------- |
| ESLint                                     | Pass, zero warnings                     |
| TypeScript and route generation            | Pass                                    |
| Unit tests                                 | 14 passed                               |
| Isolated PostgreSQL integration tests      | 32 passed                               |
| Public desktop/mobile browser tests        | 8 passed                                |
| Authenticated desktop/mobile browser tests | 6 passed                                |
| Production build                           | Pass                                    |
| Quotation PDF rendering                    | Generated, parsed and visually reviewed |

The new browser flow covers appointment creation/completion, measurements, V1/V2,
PDF download, acceptance evidence, showroom exception, negotiation, Won conversion,
order creation and post-sales initialization, Lost closure and reload persistence.
Mobile page width is checked to prevent horizontal overflow. Integration coverage
also includes concurrent V3 revision attempts, one-order conversion retries,
unchanged Lost closure timestamps and attachment/appointment foreign-key scope.

Implementation files: src/lib/presales contains validation, exact pricing,
transactional services, private Storage adapter and PDF rendering. The App Router
pages/API handlers expose the documented routes. src/features/presales contains
the responsive workspace and directories. Existing lead detail, Kanban actions,
schema and documentation were updated. Migrations 0005–0008 and tests in
tests/unit/quotations.test.ts, tests/integration/presales.test.ts and
tests/browser-auth/workflows.spec.ts cover this increment. The bundled PDF font
and its license live under public/fonts.

Commands executed: npm install for decimal.js, pdf-lib, @pdf-lib/fontkit and static
@fontsource/montserrat; npm run db:generate for reviewed SQL artifacts;
npx prettier --write on changed files; npm run check; npm run test:e2e;
npm run test:e2e:auth; and Poppler pdfinfo/pdftoppm for PDF rendering inspection.
Individual checks and focused browser tests were run while fixing failures.
Final runs pass. No real-project migration or external deployment command was run.

Live acceptance still needs DATABASE_URL, DIRECT_URL and BETTER_AUTH_SECRET in
ignored `.env.local`, actual Supabase migration application and an administrator.
Visit uploads also need the private Storage configuration from README and a
verified private bucket. Local tests use a disposable database; Storage transport
is injected in integration tests. They do not establish live Supabase connectivity
or live Storage uploads. No migration to the real project, deployment or push has
been performed in this increment.

Subsequent phases implement post-sales completion, load planning, production,
installation, payments and service. The existing S-Grip glass rules remain unchanged.
