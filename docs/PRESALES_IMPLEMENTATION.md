# Common pre-sales implementation

## Delivered functionality

- `/`: live, permission-scoped opportunity dashboard, company filter, pipeline
  value, open/won/lost totals, overdue follow-ups and recent leads.
- `/leads`: common seven-stage Kanban and paginated table, Add Lead modal,
  details drawer, keyboard-accessible Done completion, advanced filters.
- `/leads/[id]`: full lead details, Edit Lead, recorded Done status, follow-up
  scheduling/completion, paginated immutable timeline, notes and archive/restore.
- `/customers`: paginated/searchable contacts, real customer creation and links
  to customer-specific projects/leads.
- `/projects`: paginated/searchable sites, real project creation for an accessible
  customer, and links to associated enquiries. A customer can have multiple projects.

Every requested lead field is implemented. Company/branch/employee/CSE values
come from real authorized records. The form creates or links parent records
transactionally. Finalised value is optional on new leads; Won requires a positive
INR final value. Priority, normalized Indian mobile, financial year, quantities,
money precision, field lengths and follow-up dates are validated with Zod.

Brand, territory, SOE, source and customer/building/order types remain descriptive
text rather than invented business taxonomies. Discount Offered accepts descriptive
units (for example percent or amount); it is not silently interpreted as one unit.
Customer/project associations are immutable once linked. Editing lead contact/site
fields changes a lead snapshot, preserving other projects' shared master records.

## Workflow and integrity

All companies share the existing seven stages with their exact canonical names.
New records start at Lead Generated; Done validates the current step's evidence and
automatically starts the next step. Stage selection and drag/drop are disabled.
Saved supporting records do not advance without Done; manual PATCH cannot bypass it.
Lost may close an enquiry earlier, with a required reason. Won is available from
Negotiation / Quotation Revision and creates one unique parent-linked order at
post-sales stage 1. Retries/edits cannot duplicate the order. Closing cancels pending
follow-ups; reopening a closed outcome is not a side effect of editing other fields.

Follow-ups have persistent due times, assigned employees, actions and completion
notes. The earliest pending action drives next-follow-up reporting. Rescheduling
through Edit Lead cancels the earliest pending task with an explanation and inserts
its replacement; other planned work and cancellation history are retained.
Detailed activity includes the actor, timestamp and before/after changes.
Timeline entries cannot be updated/deleted through SQL or public APIs. Archive is a
soft operation, confirmed with a reason; restore is available to coordinators.

## Authorization and queries

No browser Supabase queries or Supabase Auth JWT assumptions were added. Next.js
services use verified Better Auth sessions and the server-only Drizzle/Postgres.js
runtime. RLS defaults deny public access, but a privileged server connection bypasses
RLS: explicit company, branch, role and assigned-record predicates protect queries.

Admin/Super Admin: authorized organizations. Sales Manager/CSE: assigned branches.
Other users: their assigned leads in permitted branches. Assignment changes require
coordination authority, an active same-branch employee, and current permissions.
Normal executives can create self-assigned leads. Parent directories derive access
from authorized assignments and linked visible leads, so reassignment does not leave
the former executive access to restricted projects just through an old owner field.

Duplicate checks normalize phones and check same-company matches plus same client/
site pairs. Warnings include only authorized lead references. Restricted matches
return no names/IDs and require coordinator review. A separate lead requires an
acknowledgement and reason. No unique phone constraint incorrectly prevents a
customer from having multiple projects.

Server-side filters: search, company, branch, employee, stage, outcome, priority,
source, territory, booking month/year, follow-up state and archive state, plus
customer/project relationship links. Pagination is deterministic with creation time
and ID ordering; table sizes are capped at 50. Each Kanban column starts with 10
records and loads further server pages independently. Counts reflect all matches.
Activity and follow-up history are independently paginated. Monetary calculations
use PostgreSQL numeric aggregates, and dates display in Asia/Kolkata.

All mutations verify Origin/CSRF constraints and input on the server, revalidate
authorization in a transaction, and serialize with account/permission changes.
Lead version checks reject stale edits rather than overwriting another user's work.
Lead activity and operational audit rows commit with the business changes.

## Database changes

- `0002_presales.sql`: lead fields, activity/follow-up tables, customer/project ownership.
- `0003_presales-relationships.sql`: composite company/branch relationships.
- `0004_presales-security.sql`: RLS/grant denial, activity immutability, validation
  constraints and indexes for assignment/pipeline/follow-up queries.

Additive fields preserve legacy records. Two final-stage constraints are `NOT VALID`
for pre-existing rows so migrations do not invent unknown legacy outcomes/reasons;
PostgreSQL enforces them on all new/updated rows. Review any old stage-7 records and
validate those constraints after correcting genuine legacy data. Contact snapshots
are nullable for legacy rows and fall back to their actual customer records.

## Tests and live Supabase acceptance

Verified on 24 October 2026:

| Check                                      | Result              |
| ------------------------------------------ | ------------------- |
| ESLint                                     | Pass, zero warnings |
| TypeScript and Next route types            | Pass                |
| Unit tests                                 | 10 passed           |
| Isolated PostgreSQL integration tests      | 30 passed           |
| Public desktop/mobile browser tests        | 8 passed            |
| Authenticated desktop/mobile browser tests | 4 passed            |
| Production build                           | Pass                |

Authenticated tests include existing employee administration and the complete
lead create/edit/assignment/filter/reload workflow on both viewport sizes.
Desktop/mobile lead-detail screenshots were visually reviewed. A sandbox worker
startup failure was resolved by running the build and browser suites outside the
sandbox; the final runs passed without code workarounds or production fallbacks.

The ignored `.env.local` currently has empty DATABASE_URL, DIRECT_URL and
BETTER_AUTH_SECRET. No live migration, live Supabase CRUD verification, deployment
or push has been performed. Populate the real settings, inspect the target schema,
apply `npm run db:migrate`, then use the actual administrator account to verify
create/edit/assignment/filter/reload against Supabase. Bootstrap remains a separate
one-time setup when no administrator exists. Never run isolated test fixtures on
the real project.

Run:

```sh
npm test
npm run test:integration
npm run lint
npm run typecheck
npm run build
npm run test:e2e
npm run test:e2e:auth
```

Unit tests cover Indian mobile formats, invalid numbers, optional initial final
value, Lost reasons, decimal/FY validation and bounded pagination. PostgreSQL
integration tests cover CRUD, duplicate acknowledgements, multiple projects,
assignment/tenant/branch permissions, version conflicts, follow-up completion,
timeline immutability, SQL filters/pagination, Won conversion and soft archive.
Authenticated browser tests exercise creation, editing, assignment, table filters,
drawer, Kanban movement, Lost, follow-ups, timeline notes and reload persistence
on desktop/mobile using the built Next.js app and real Postgres.js driver.

These tests use a disposable PostgreSQL engine; they never load real Supabase
secrets or create fake production customers. Live Supabase migration and acceptance
must be recorded separately after `.env.local` is ready. No external deployment is
part of this task. The application has no in-memory production fallback.

The subsequent detailed pre-sales increment implements site visits, initial
measurements, private attachments, quotation items/PDFs/revisions, showroom and
negotiation records, and quotation-backed conversion. See PRESALES_WORKFLOWS.md
for current behavior and acceptance evidence. External calendar integrations and
automated messaging remain separate integrations.

## Files and commands

New domain files: `src/lib/leads/{access,index,service,validation}.ts`.
New interactive UI: `src/features/leads/{lead-workspace,lead-form,lead-detail,
parent-workspace}.tsx`, `types.ts`, `utils.ts`, and
`src/features/dashboard/presales-overview.tsx`.
New lead detail/project pages and `/api/leads/**`, `/api/customers`, `/api/projects`
route handlers provide the documented routes above. Existing dashboard, lead and
customer pages, navigation, shell, HTTP error handling, role map and database
schema were updated. The obsolete unused foundation dashboard was removed.

New migrations: `drizzle/0002_presales.sql`, `0003_presales-relationships.sql`,
`0004_presales-security.sql` and their Drizzle metadata.
New tests: `tests/unit/presales.test.ts`, `tests/integration/presales.test.ts`,
`tests/browser-auth/presales.spec.ts`. Browser configurations isolate credentials
and database connections from `.env.local`.
Updated documentation: requirements, implementation plan, README and historical
Step 2 verification; this document records current acceptance evidence.

Commands executed include repository/file inspection, `git status --short`,
`git check-ignore .env.local`, `npm run db:generate` for reviewed migration
artifacts, `npx prettier --write` on changed files, `npm run check` (lint,
typecheck, unit, integration, build), standalone lint/build retries,
`npm run test:e2e`, and `npm run test:e2e:auth`. The targeted desktop pre-sales
browser test was also run while repairing its accessible selector.

Architecture references: [Next.js server data fetching](https://nextjs.org/docs/app/getting-started/fetching-data)
and [Supabase PostgreSQL connection modes](https://supabase.com/docs/guides/database/connecting-to-postgres).
