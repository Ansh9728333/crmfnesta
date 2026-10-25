# Payments, dispatch and delivery

Implemented for Finesta Home, IBAX and S-Grip with the existing Supabase
PostgreSQL/Postgres.js connection and private Supabase Storage adapter. Better Auth
remains the employee identity provider. No browser database or production test
fallback is introduced.

## Routes

- `/payments`: company/customer/status filters, SQL pagination and order balances.
- `/payments?orderId=<uuid>`: installments, receipt evidence, Accounts decisions,
  load-wise allocations and Admin milestone configuration.
- `/dispatch`: shipment dashboard, company/customer/partial-delivery filters.
- `/dispatch?orderId=<uuid>`: factory-ready loads, item-wise dispatch drafts,
  approval, transport details, actual dispatch and multiple delivery receipts.
- `/api/commerce`: permission-scoped dashboard queries.
- `/api/commerce/orders/<id>`: detail and validated transactional commands.
- `/api/commerce/orders/<id>/files`: bounded private evidence upload.
- `/api/commerce/orders/<id>/files/<fileId>`: authorized 60-second download URL.

The payment and dispatch panels are separate client components sharing typed form
and attachment controls. URL filters and history pagination survive reload. Existing
order and load pages link to the ledger/shipping workspace.

## Financial rules

All money persists as PostgreSQL `numeric(14,2)`. Authoritative server arithmetic
uses Decimal.js or PostgreSQL numeric aggregates; JSON amounts remain decimal
strings. Display formatting is not used for financial validation. Quantities use
three decimal places. Currency is INR.

An installment records amount, payment mode, transaction/receipt reference, actual
payment date, notes, recording employee, immutable receipt evidence, verification
status and deciding employee/time. Accounts verifies the evidence manually; the
application does not claim a bank, UPI or reconciliation integration. Partial
payments and multiple installments are supported. Pending records cannot fund a
load. Rejected receipts remain historical and release their reported order capacity.
A corrected receipt can reuse a rejected reference; two active receipts cannot
share the same normalized reference within a company.

The ledger distinguishes reported receipts from verified received money.
Outstanding = final order value minus verified received money. Pending verification
is never silently treated as cleared cash. Reported non-rejected installments cannot
exceed order value. Verified financial details and decisions are immutable. Refunds,
chargebacks, bank reconciliation and reversal accounting require a later reviewed
ledger extension; they are not simulated by editing verified receipts.

Admin configures explicit load milestones: name, INR amount due, target date,
before-dispatch flag, contract reference and reason. Zero due permits documented
credit terms. Milestones across an order cannot exceed its value. Funded milestones
and terms for approved/shipped loads are locked. Each load needs an explicit
before-dispatch milestone, including a zero-due milestone under approved credit.
The original approved order contract's cumulative dispatch requirement still applies;
configuring a small load milestone cannot bypass it.

Accounts allocates a verified installment to one or more milestones. Multiple
installments may fund the same milestone. Each receipt/milestone pair is unique;
allocations are immutable and cannot consume more than the receipt's remaining
money or the milestone's remaining amount. Money cannot be reused for two loads.
An allocation is a deliberate final allocation; future top-ups to the same milestone
use another installment, rather than duplicate rows for an existing pair.

## Shipping and delivery

Production first records actual factory readiness in the load module. A dispatch
draft selects individual load-item quantities and records transporter, vehicle,
tracking/reference, expected delivery, notes and private delivery challan. Drafts
reserve shipping quantities, preventing concurrent or repeated over-shipment. An
unshipped draft/approval may be cancelled with a reason to release reservations;
rows and attachments remain historical.

A scoped coordinator with orders.manage approves dispatch. Approval requires
factory readiness, challan, verified allocated load milestones and coverage of the
approved cumulative order payment requirement. Production confirms the actual
shipment date with the same gates rechecked transactionally. Installation and
engineering permissions do not grant payment verification or shipment approval.

A load can have multiple consignments. Partial shipment/delivery quantities remain
independent. The load becomes dispatched only after all its allocated quantities
are actually shipped, and delivered only after all are confirmed received. A single
partial receipt cannot prematurely advance installation. Completed load/order
workflows are not advanced automatically by a payment or a partial shipment.

Each delivery records actual date, site recipient, per-item received quantity,
damaged quantity (a subset of received), missing quantity observed now, remarks and
private proof of delivery. Creation makes a draft; confirmation requires proof and
rechecks the remaining shipped quantity. Stale/overlapping drafts cannot double
count receipts and can be cancelled with an audited reason. Confirmed evidence is
immutable. Subsequent receipts can account for material previously reported missing:
missing observations do not consume delivery capacity a second time.

Delivery completion indicates physical quantity received, including any damaged
items. It does **not** approve material quality. Damage remains prominently recorded
for installation and service engineer review; their existing explicit checks/audit
are still required before handover. Return/replacement logistics are a later module.

The old manual load payment/dispatched/delivered shortcuts are disabled. Load
shipping states now derive from real shipment/receipt quantities. The aggregate
post-sales receipt stage must match the verified ledger total, and aggregate dispatch
and delivery stages require actual completion for every allocated load.

## Security, storage and migrations

Every operation rechecks active database sessions, first-login state, current
permissions, company, branch and accessible order. Ledger/shipping reads additionally
require an operational payments, production, order-management, installation or
audit grant; Sales-only order access does not expose this workspace. Transaction
references, receipt files and financial event snapshots require payments.manage;
other operational readers receive funding summaries and material evidence only. Admin authority stays company scoped.
Payments and verification require payments.manage; shipment creation/actual shipping
and delivery require production.manage; dispatch approval requires orders.manage;
configuration requires organization Admin authority.

All mutations serialize with employee/grant changes using the existing advisory
transaction lock. Versions reject stale decisions. Composite tenant/order foreign
keys, unique normalized receipt references and database triggers independently guard
receipt totals, allocation capacity, reserved shipment quantities and confirmed site
quantities. Counters cannot be edited through a direct top-level SQL update. Financial
and material events preserve employee, timestamp, reason and before/after snapshots;
every successful financial mutation and evidence upload also writes the main audit log.

RLS and revoked public/anon/authenticated grants protect all new business tables.
Runtime queries explicitly enforce scope because the privileged connection bypasses
RLS. File metadata references the correct order/entity with composite foreign keys.
Only signature-checked PDF/JPEG/PNG files up to 4 MiB are accepted. The existing
siteflow-documents bucket must be private. Uploads use unique paths without overwrite;
provider/database failures cannot report success. Authorized download links expire
in 60 seconds. Production contains no injected test object store.

Reviewed migrations 0014 and 0015 add the schema, backfill existing parent links and
actual reported payment totals, and apply security/integrity triggers together.
Invalid historical duplicate references, overpayments or inconsistent relationships
stop migration for operator review. No historical receipt is silently verified and
no existing JSON payment evidence is manufactured into a ledger transaction.
Legacy shipping records require reconciliation before they can enter the new flow.
Use `npm run db:migrate`; never substitute db push for reviewed SQL.

## Verification and live prerequisites

Isolated database tests exercise full and partial installments, real Accounts
verification, permission revocation, duplicate references, over-allocation,
concurrent payment attempts, blocked dispatch, multiple consignments, partial and
full delivery, missing balances, damage records, private evidence authorization and
immutable financial history. Tests never load real Supabase credentials.
Browser fixtures seed required evidence through the same real services with an
injected test-only file transport. The app still uses the real Supabase adapter;
missing Storage configuration honestly fails browser upload attempts.

DATABASE_URL, DIRECT_URL, BETTER_AUTH_SECRET and Supabase Storage settings remain
empty in the workspace. Live project migration, independent PostgreSQL connection
concurrency and actual Supabase upload/download acceptance remain pending those
settings. No deployment, external messaging, bank integration or source push occurs.

References: [PostgreSQL exact numeric types](https://www.postgresql.org/docs/current/datatype-numeric.html)
and [Supabase standard uploads](https://supabase.com/docs/guides/storage/uploads/standard-uploads).

Verified 24 October 2026:

| Check                                      | Result                                        |
| ------------------------------------------ | --------------------------------------------- |
| ESLint                                     | Pass, zero warnings                           |
| TypeScript / route types                   | Pass                                          |
| Unit tests                                 | 28 passed                                     |
| Isolated database integration tests        | 45 passed                                     |
| Public desktop/mobile browser checks       | 8 passed                                      |
| Authenticated desktop/mobile browser tests | 12 passed                                     |
| Production build                           | Pass                                          |
| Payment/shipping screenshot review         | Desktop/mobile reviewed; overflow checks pass |

Commands: npm run db:generate -- --name=payments-dispatch-delivery;
npm run db:generate -- --custom --name=commerce-integrity; npm run lint;
npm run typecheck; npm test; npm run test:integration; npm run build;
npm run test:e2e; npm run test:e2e:auth. Changed TypeScript was formatted with
Prettier. Generated migration ordering was reviewed so parent unique keys exist
before composite foreign keys, and existing shipment/delivery order links are
backfilled before NOT NULL enforcement.

The new browser flow verifies two installments, funds a load, observes blocked
unfunded dispatch, approves and ships after verification, confirms a seeded partial
receipt, persists a later draft and rejects confirmation without proof. Uploads
against missing real Storage configuration fail honestly. Existing employee,
pre-sales, order and production browser regressions remain green. No live Supabase
migration or actual Storage transport was claimed by these isolated tests.
