# Production load planning

Implemented for Finesta Home, IBAX and S-Grip using the existing scoped PostgreSQL
connection. There is no local production database or simulated integration.

## Routes and operations

- `/production`: server-filtered, paginated company/customer/status/readiness dashboard.
- `/production?orderId=<uuid>`: confirmed-item quantity progress and pending quantities.
- `/production/<uuid>`: allocation editor, owner, readiness, payment verification,
  production timeline, actual/estimated dates and paginated immutable activity.
- `/api/production`: GET listing and POST creation.
- `/api/production/planning/<orderId>`: scoped confirmed items and eligible employees.
- `/api/production/<loadId>`: GET detail/history and PATCH validated commands.

The accessible Create Load modal searches real Won orders and allocates each item
separately. A quantity can be split between loads; duplicate rows for the same item
inside one load are rejected. For 40 confirmed items, a ready load of 30 leaves 10
unallocated; a second pending load of 10 reserves the balance. Decimal quantities
have three places. Pending site readiness does not prevent reserving quantities.
An existing empty planning draft is edited from its load detail page. Stage 6
approval checks the actual load count and requires existing item allocations; it
does not manufacture additional empty drafts. Later partial loads remain supported
under the approved survey/readiness/plan prerequisites until handover approval.

## Integrity and concurrency

Migrations 0012 and 0013 extend existing load records; no historical completion is
invented. Reviewed SQL backfills the allocation counter from actual allocation
rows. Invalid historical duplicates, over-allocation or cross-order links fail the
migration and require operator review; nothing is silently deleted.

Each allocation references a confirmed order item and its company. A trigger also
checks that the item and load have the same order. A unique constraint prevents
repeated item rows within a load; positive quantity and capacity constraints apply.
The database atomically updates `order_items.allocated_quantity` on allocation
insert/update/delete. Updating the confirmed item row takes its row lock; concurrent
allocations cannot both spend the remaining capacity. Reducing confirmed quantities
below allocated amounts fails. Direct counter changes and reparenting allocated
items are rejected. Released allocations, completed loads and load identity are
immutable. Runtime edits replace allocations transactionally with optimistic
versions, authorized session rechecks and the existing employee mutation lock.
Failed creation/reallocation rolls back every row and audit change.

See [PostgreSQL concurrency behavior](https://www.postgresql.org/docs/current/transaction-iso.html)
and [Supabase trigger documentation](https://supabase.com/docs/guides/database/postgres/triggers).

## Independent progress

Loads progress sequentially through planned, released, in production, factory ready,
dispatched, delivered, installation started, installed, engineer audit passed, completed.
Each step records an actual date, reference, notes and acting employee. Production
start also requires an estimated completion date. Release records the production
order number; dispatch records carrier/reference; delivery records recipient/
confirmation. Engineer audit is an explicit passed-audit action; notes retain the
findings. A failed audit remains outstanding and cannot advance the load.

Release requires approved final survey, site-readiness and load-planning order
stages, nonempty allocation, and readiness for this load. Individual loads can then
progress in parallel without waiting for the entire order's factory/delivery stage.
Actual dates cannot be in the future or precede the previous load activity.

Accounts verifies the per-load dispatch milestone against the approved contract.
Amounts describe **cumulative order receipts**, not independently summable payments;
load verification is not a bank integration or a payment ledger. The amount due
cannot be below the approved contract's cumulative dispatch requirement, and
verified receipts must cover it within the final order value. Documented approved
credit terms permit zero due. Dispatch requires Accounts verification and cannot
precede its date. A lower partial-load contract schedule needs an approved contract
policy extension; staff cannot bypass the existing contractual requirement.

S-Grip installation explicitly records Glass Required Yes/No; Yes requires glass
measurement, template preparation and approval before installed. These checks stay
on the existing order's load, alongside the order-level installation controls.
There is no separate glass pipeline. Finesta Home and IBAX share all other behavior.

Completing a load does not advance or complete the parent order. Final handover
requires every confirmed quantity allocated, all loads with allocations completed,
and the existing approved installation/audit checks. Handover cannot predate load
completion. Empty legacy/planning drafts reserve no quantity and are not applicable
fulfillment loads. New/reallocated loads are prohibited after approved handover.

## Permissions and audit

All reads require active sessions and current company/branch/record scope. Assigned
load owners can read their order in an authorized branch. Production commands need
`production.manage`; payment verification needs `payments.manage`; installation
needs `installations.manage`; passed audit needs `audits.manage`. Organization Admin
retains scoped authority but cannot skip prerequisites. Owners must be active
production employees in the order branch. Assignment does not grant new roles.
The event table has RLS, no browser grants and an immutable SQL trigger. Actor,
time, notes, versions and snapshots survive reload. No events contain credentials.

## Verification and live acceptance

Automated suites cover each company's 40 = 30 + 10 allocation, remaining quantities,
racing allocation requests, duplicate/cross-order/over-capacity attempts, direct SQL
capacity/counter guards, permission denial, rollback, readiness/release/dispatch
prerequisites, independent completion and handover blocking. Desktop/mobile browser
checks create, edit, allocate the remaining quantity, filter and reload persisted loads.
These use an isolated PostgreSQL-compatible PGlite engine and real application
services/HTTP routes. They do not establish multi-server Supabase connectivity.

The ignored `.env.local` still has no DATABASE_URL, DIRECT_URL, BETTER_AUTH_SECRET
or Storage credentials. Apply reviewed migrations using `npm run db:migrate` against
the configured Supabase project, then verify concurrent requests from independent
connections, signed-in CRUD/reload and existing private Storage before live acceptance.
No deployment, source push, external notification or live migration was performed.

Verification on 24 October 2026: ESLint and TypeScript pass; 24 unit tests,
43 isolated database integration tests, 8 public browser checks and 10 authenticated
desktop/mobile browser tests pass. Production build passes. Desktop/mobile load
screenshots were visually reviewed and horizontal overflow checks pass. The 40-item
fixture exercises both a single full load and a 30/10 split for each company,
including partial readiness and independent progress before aggregate order stages.
Commands: `npm run lint`, `npm run typecheck`, `npm test`,
`npm run test:integration`, `npm run build`, `npm run test:e2e`,
`npm run test:e2e:auth`. Schema artifacts were generated with `npm run db:generate`
and changed TypeScript formatted with Prettier. OneDrive caused a generated-output
EPERM on an intermediate rebuild; removing the verified workspace `.next` output
and rebuilding resolved it. No source or user data was removed.

## Payment and material management supersedes manual Phase 5 evidence

The later [payment/dispatch/delivery module](PAYMENTS_DISPATCH_DELIVERY.md) now owns
financial verification and material movements. The Phase 5 manual payment and
dispatched/delivered commands are retired with explicit errors. Verified installments
and allocations, approved consignments and confirmed item receipts determine those
gates and load states. Physical delivery includes recorded damage for subsequent
installation/audit review. Earlier Phase 5 verification counts above are historical.
