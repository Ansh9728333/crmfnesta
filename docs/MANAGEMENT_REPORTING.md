# Management dashboard, reports and Admin Panel

## Routes and permissions

- `/`: management dashboard for employees with `reports.read`. Other employees
  retain their permitted operational/pre-sales workspace.
- `/reports`: ten database-backed, filtered reports with SQL pagination and CSV/XLSX export.
- `/settings`: organization-scoped Admin Panel for companies, territories, product
  categories, payment milestone templates, document requirements and SLA rules.
- `/admin/employees`: existing employee lifecycle and canonical role permissions.
  The Admin Panel's Roles and permissions link opens its permission editor directly.
- `/orders/settings`: existing shared workflow responsibilities and mandatory fields.
- `/payments?orderId=<id>`: actual per-order/per-load payment milestones. Active
  company templates prefill their percentage, due date and before-dispatch condition;
  Admin still reviews and explicitly saves the contract, amount and load.
- `/notifications`: current overdue work with per-user read/dismiss persistence.

Every operation checks a real Better Auth session, active employee/branch,
organization assignments, current role grants and the existing record scope.
`reports.read` does not grant underlying lead/order access. Collection reports,
exports and financial KPIs additionally require scoped payment permission.
Restricted KPI values are null and display Restricted; they are never simulated zeroes.
Non-admin managers cannot modify settings or grant administrative authority.
Canonical companies, eleven employee roles and shared seven/sixteen-stage workflows
remain intact. No extra glass pipeline is introduced.

## Common filters and date basis

Company, recorded Financial Year (`YYYY-YY`), inclusive IST date range, exact
territory, assigned sales executive and status are applied in SQL. The date range
uses lead creation for lead cohorts, order creation for order/fulfillment cohorts,
quotation issue date for quotation versions and receipt date for collection reports.
An order's sales dimensions come from its related lead. Archived leads are excluded.
Report status filters apply to the report's own entity; a completed load can appear
while its parent order remains open. Dashboard status is the lifecycle cohort.

## Nineteen KPI definitions

| KPI                      | Source and definition                                                                   |
| ------------------------ | --------------------------------------------------------------------------------------- |
| Total Leads              | Permitted non-archived lead cohort                                                      |
| Active Leads             | Cohort leads without Won/Lost outcome                                                   |
| Won Orders               | Actual orders linked to Won leads                                                       |
| Lost Orders              | Leads closed Lost; no fictitious order is created                                       |
| Conversion Rate          | Won leads / total cohort leads, percentage rounded in SQL                               |
| Expected Pipeline Value  | Entered expected values for active cohort leads                                         |
| Confirmed Order Value    | Sum of actual final order values, once per order                                        |
| Pending Follow-ups       | Pending task rows for cohort leads                                                      |
| Pending Surveys          | Distinct orders with incomplete final appointment/measurement stages                    |
| Orders in Production     | Distinct orders with released/in-production/factory-ready allocated loads               |
| Active Production Loads  | Allocated loads not marked complete                                                     |
| Delayed Production Loads | Unfinished production past its recorded estimate plus SLA grace                         |
| Payments Received        | Verified receipts for permitted orders in the selected order cohort                     |
| Outstanding Payments     | Order value less all verified receipts, calculated per order before summing             |
| Pending Dispatches       | Factory-ready/dispatched loads with unshipped quantities or draft/approved consignments |
| Pending Installations    | Delivered or installation-started loads                                                 |
| Pending Engineer Audits  | Installed loads awaiting engineer approval                                              |
| Pending Site Handovers   | Orders at stage 15 without confirmed customer handover                                  |
| Open Service Tickets     | Tickets outside resolved/closed states                                                  |

Money remains PostgreSQL numeric/exact decimal text. Pending/rejected receipts do
not reduce outstanding balances. Outstanding is the total uncollected order value,
not necessarily the contractually due amount today. Payment notifications use actual
due milestones instead. Child records are aggregated separately to prevent item,
load, quote-version or installment joins from multiplying financial totals.

## Reports and exports

Company-wise Sales; Employee Performance; Pre-Sales Conversion; Quotation Revision;
Production Load; Payment Collection; Dispatch Delay; Installation Progress; Engineer
Audit; Site Handover. Revision reports preserve every immutable version and use the
previous quotation amount even when that version falls outside the chosen dates.
Dispatch delay compares actual/planned dispatch against the stage-10 planned date;
missing plans are not represented as known delays. Production reports use estimates.

Each report uses the same permission/filter query for its table and exports. Tables
have 25-row server pages. Exports include the complete filtered result, independent
of the current page, up to 10,000 rows; larger requests return an explicit error and
require narrower filters. Exports recheck access under the shared mutation advisory
lock so account/grant changes cannot race file creation. Export audits retain actor,
company, format, filters and row count; file contents and credentials are not logged.

CSV uses UTF-8 BOM, CRLF, quoted fields and escaping for quotes/newlines/commas.
Formula-leading cells are neutralized. XLSX files are real ExcelJS workbooks with
literal string cells, frozen headers, filters, styling and filter metadata. Exact
financial/quantity decimals remain text to avoid Excel/JavaScript precision loss.
Timestamp strings in exports retain their recorded offsets; UI timestamps display
in IST. Download responses are private/no-store attachments. No public signed or
permanent export URLs are created. ExcelJS's UUID dependency is overridden to the
patched compatible 11.x release; the installation audit reported zero vulnerabilities.

## Admin configuration

Company profiles manage legal/contact/GSTIN details and availability for new leads.
Disabling intake does not revoke employee access or interrupt existing orders.
Canonical company names/codes cannot change. Territories and product categories
have real scoped records, descriptions/units and active state; identity codes are
immutable and changes are versioned. Once territories are configured, new nonblank
territory values must match an active entry. Existing unchanged historical values
remain editable without rewriting their history. Product categories form the
company classification catalog; historical quotations are preserved.

Payment templates specify an exact percentage of confirmed order value, due offset
from order date and a before-dispatch condition. Applying one never bypasses existing
contract, receipt verification, allocation, funded-milestone or dispatch checks.
Template edits do not rewrite already saved order milestones.

New orders snapshot active named document requirements by stage. Existing orders
retain names/requirements even when the catalog changes or is disabled. Required
files are tagged to the order's snapshot, scoped by company/stage, and checked on
submission/approval and final handover. Core documents and checks cannot be removed.
Shared workflow roles and core mandatory fields continue through the existing
workflow configuration service; no duplicate workflow engine is created.

SLA settings add 0–720 grace hours to recorded follow-up, production, payment,
dispatch, installation or audit targets. Zero is the default grace when no active
rule exists. No target date means unknown lateness, not an invented deadline.
Settings are scoped Admin mutations with optimistic versions, immutable identity,
soft disable and before/after audit history. No hard deletion destroys references.

## In-app notifications

Live scoped SQL sources identify overdue active-lead follow-ups, unfinished
production estimates, unfunded due milestones, installation start/completion plans
and required audit plans. Notifications disappear when the source work resolves.
Per-user read/dismiss rows are matched to kind, entity and effective due date;
rescheduled work can alert again. Decisions are authorized against the current
source query in the mutation transaction. The bell uses a count-only query and
refreshes on navigation, visibility changes, relevant decisions/settings changes
and each minute while the page is visible. No email, WhatsApp or external push is sent.

## Migrations, query execution and acceptance

Reviewed migrations 0018–0020 add scoped Admin configuration, per-user notification
receipts, document tags/snapshots, RLS/browser-role revocations, identity and version
guards, catalog constraints, immutable order document policies and reporting/due-date
indexes. There are 53 tables. Apply with `npm run db:migrate`, never `db push`.
No target migration is attempted without real project credentials. Existing stage
document snapshots default empty so migrations do not invent historical obligations.

Queries use scoped CTEs, grouped aggregates, indexed parent/owner/cohort/due-date
conditions and bounded SQL pages. Employee aggregates are grouped rather than
repeated per employee; installation quantities are aggregated within visible orders.
Permission checks apply even with a privileged connection that bypasses RLS.

Automated acceptance uses disposable PGlite and real authenticated services, plus
production-build desktop/mobile browsers. It covers role and company boundaries,
revoked grants, exact verified/outstanding totals, child-record aggregation, all ten
reports, filters, multi-page CSV/XLSX exports, formula safety, Admin versions,
territories, intake controls, immutable document snapshots and notification decisions.
Live Supabase persistence, target migration, Storage transport and large-scale
independent-connection query plans remain separate acceptance requirements.

Official references: [Next.js Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers)
and [ExcelJS](https://github.com/exceljs/exceljs).

The runtime shares one Postgres.js pool across SSR and route-handler bundles within
a Node worker. It does not cache sessions, permissions or query results. Sidebar
links avoid speculative prefetch of every protected module. Restart the server
after changing database connection credentials.

Verified 24 October 2026: lint, TypeScript, production build, 37 unit tests, 52
isolated database integration tests, 8 public browser checks and 16 authenticated
desktop/mobile browser tests pass. The management UI, nineteen KPIs, date filters,
CSV/XLSX downloads, Admin edits, notification persistence, focus and overflow were
tested. Desktop dashboard and mobile report screenshots were visually reviewed.
The final production dependency audit reports zero vulnerabilities. Real Supabase
credentials remain empty; no target migration, deployment or source push was run.
