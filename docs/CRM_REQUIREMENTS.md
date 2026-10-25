# SiteFlow CRM requirements

## Scope and stack

Production-oriented B2C CRM for three companies. Next.js App Router, TypeScript,
Tailwind CSS, shadcn/ui, Lucide, Montserrat, Zod, Supabase PostgreSQL/private
Storage, Drizzle ORM with Postgres.js, and Better Auth with Admin and Username
plugins. **Supabase Auth is not used.** Source control: GitHub. Deployment:
Vercel, only after explicit authorization. Employee administration is implemented;
Common lead/pre-sales management is implemented with PostgreSQL services.
The unified post-sales engine, per-load planning/fulfillment, payment ledger and
shipping management, installation, audits, handover and customer service are implemented.
Management dashboards, reporting, Admin settings and in-app notifications are implemented.

## Companies

| Company      | Product           |
| ------------ | ----------------- |
| Finesta Home | Windows           |
| IBAX         | Shower Partitions |
| S-Grip       | Railings          |

The spelling is **IBAX**. All companies use the same workflows below.

## Pre-sales workflow (ordered)

1. Lead Generated
2. Site Visit Appointment
3. Site Visit and Initial Measurement
4. Quotation Submitted
5. Customer Showroom Visit
6. Negotiation / Quotation Revision
7. Order Won or Lost

Won and lost must be distinct outcomes. Won orders continue into post-sales.

## Post-sales workflow (ordered)

1. WhatsApp Group Created
2. Documents Uploaded
3. Final Survey Appointment
4. Final Survey and Measurement
5. Site Readiness Confirmed
6. Production Load Planning
7. Production Order Released
8. Factory Production and Readiness
9. Customer Payment Received
10. Material Dispatched
11. Material Delivered
12. Installation Started
13. Installation Completed
14. Service Engineer Audit
15. Site Handover
16. Testimonial and Google Review

## Production loads

Every company supports one or multiple production loads per order. Preserve the
parent order relationship and separate load progress. Allocate quantities by confirmed item; totals cannot exceed the confirmed quantity.
Prevent duplicate item rows within a load while allowing a single item to be split
across loads. Preserve pending unallocated quantities. Loads progress independently
and completing one must not complete the order. Final handover requires complete
allocation and all applicable allocated loads completed. Use transactional operations
and database constraints against concurrent over-allocation. Each load records its
ID/order, item quantities, owner, readiness, production order/start/estimate, factory
readiness, Accounts payment milestone, dispatch, delivery, installation, engineer
audit, completion date and immutable history. See PRODUCTION_LOADS.md.

## S-Grip installation

During railing installation show **Glass Required: Yes/No**. When Yes, track:

- Glass Measurement Taken
- Glass Template Prepared
- Glass Template Approved

These activities remain inside the existing order. Do not create a separate glass
production pipeline. No glass activities are required when Glass Required is No.

## Experience

Light neutral background, dark charcoal sidebar/header, red navigation/actions,
and blue, amber, green and red metric cards, following the user's dashboard reference.
Keep Montserrat typography and readable contrast (amber cards use dark text).
Responsive sidebar and desktop/mobile layouts. Clean tables, cards, filters,
status badges, forms, and drawers. Accessible labels, keyboard navigation,
visible focus states, and reduced-motion support.

## Integrity and security

- Never simulate persisted records, successful mutations, or a connected service.
- Never use localStorage as the CRM database.
- Validate all future input using Zod at the server boundary.
- Require verified identity and company membership for every data operation.
- Better Auth sessions are persisted in PostgreSQL and checked on the server.
- Do not use auth.uid(): there are no Supabase Auth JWTs. Deny public/anonymous
  Data API access. Server queries explicitly enforce organization and record scope,
  including when a privileged database connection bypasses RLS.
- Keep Storage private; authorize downloads server-side before issuing 60-second URLs.
- Never expose service-role keys or secrets to client code or source control.
- No deployment in this phase.

## Foundation acceptance

Working dashboard and placeholder module routes; reusable application shell and
UI components; documented setup, environment variables and architecture;
TypeScript, ESLint, automated tests and production build pass without requiring
database credentials. No sample customer data or invented business totals.

## Employee identity and access (Step 2 supersedes prior Auth design)

- Only authorized Admin/Super Admin users provision employees. No public signup,
  email sign-in, user discovery, public reset, or direct Admin plugin endpoints.
- Employees sign in at /login with unique, normalized username and password.
- Better Auth requires a real unique email during provisioning; it is not a login
  identifier. Do not invent deliverable emails. No emails are sent by this app.
- Store Better Auth-generated users, credential accounts, sessions, verification
  and persistent rate-limit records in PostgreSQL; never duplicate credentials.
- One-time local CLI bootstrap takes real details and an initial secret from the
  environment, runs transactionally, and closes permanently after any user exists.
- Passwords are hashed by Better Auth, never stored or displayed in plaintext.
  Admin selects the account username and password (minimum 12 chars), and assigns
  the employee's designation through canonical company/branch role assignments.
  No temporary account password is generated, and no first-login password change
  is required. Admin resets revoke existing sessions; employees can then sign in
  directly with the selected password. Authenticated own-password changes remain optional.
- Deny inactive users. Deactivation, password reset, role edits and explicit access
  revocation invalidate sessions. Re-read permissions on every service operation.
- Employee fields: name, generated employee code, username, email, mobile,
  department, status and one/multiple organization/centre/role assignments.
- Admin employee management supports listing/search/filters, creation, edit,
  roles/branches, activation, deactivation, password reset, last login, permissions,
  and session revocation. Confirm privileged changes. Disallow self-administration
  and require another authorized admin for changing the operator's account.
- Roles: Super Admin, Admin, Sales Manager, CSE, Sales Executive, Survey Engineer,
  Post-Sales Coordinator, Production Coordinator, Accounts, Installation Team,
  Service Engineer. Defaults are canonical in src/lib/auth/roles.ts.
- Admin authority is organization-scoped and non-delegable via permission toggles.
  Only Super Admin can grant or modify Admin/Super Admin assignments. An operator
  must administer every organization assigned to an employee before changing their
  global identity, credentials or status.
- Every business table is organization-scoped with composite foreign keys for
  parent relationships. Record-level services constrain assigned work for normal
  employees. Future CRUD must enforce the same access boundary.
- Persistent IP/account login limits, trusted origins/CSRF checks, httpOnly,
  SameSite=Lax cookies, Secure cookies on HTTPS, server-only secrets, audit logs.
- Runtime uses a serverless transaction pooler with prepare:false and max:1;
  migrations use DIRECT_URL. Production requires HTTPS.
- No deployment or external provisioning without the configured project and
  explicit scope. Local engine integration tests do not establish live Supabase
  connectivity or deployment acceptance.

## Common lead and pre-sales management

- Lead list, Kanban board, detail drawer and full detail page, Add/Edit form,
  SQL-backed search/filters/pagination, assignment, follow-ups and activity timeline.
- Fields: Client Name, Mobile No., Booking Month, Financial Year, Brand, Company,
  CSE Name, Site Address, Territory, SOE, Customer Type, Building Type, Order Type,
  Order Finalised Value, Order Qty, Pleated Mesh Qty, uPVC / Aluminium,
  Discount Offered, Lead Source, Assigned Executive, Priority, Expected Value,
  Next Follow-up, Next Action, Remarks and Status.
- Required at creation: company, branch, assigned employee, client name, valid
  Indian mobile, project name (or accessible existing project) and site address.
  Order Finalised Value is optional. New leads start at Lead Generated.
- Normalize supported Indian 10-digit, +91/91 and domestic trunk-prefix formats
  to +91 followed by a 10-digit mobile beginning with 6–9. Reject malformed or
  non-Indian international forms. Numbers are contact identifiers, not proof of ownership.
- Check same-company phone matches and same-name/site matches for possible
  duplicates. Require explicit acknowledgement/reason for a separate lead. Do not
  disclose restricted records; restricted matches require coordinator review.
- Link an existing customer or create one atomically with the project and lead.
  A customer can have multiple projects, and projects can have multiple enquiries.
- Customer/project links are fixed after creation. Lead contact/site snapshots can
  be edited without unexpectedly changing shared customer/project master records.
- Admin/Super Admin manage leads in their organizations. Sales Manager and CSE
  coordinate leads in their assigned branches. Other employees access assigned
  leads in authorized branches. Read/write permissions are checked on each request.
- Coordinators can reassign within authorized company/branch scope; ordinary
  executives assign only to themselves. Assignees must be active employees with
  lead read/write access in the target branch. CSE fields use actual active CSE accounts.
- Advance through stages in sequence. Lost can be recorded at any stage with a
  reason. Won requires the sixth stage first and a positive finalised INR value.
  Won creates one linked order at post-sales stage 1 in the same transaction.
  Closed outcomes cannot be silently reopened by the editor.
- Follow-ups retain planned/completed/cancelled records. Completing one requires
  notes; the earliest pending follow-up becomes the next action. Closing a lead
  cancels pending tasks. Rescheduling in the editor replaces the earliest pending
  task while preserving other planned tasks and retaining cancellation history.
- Preserve immutable create/edit/assignment/stage/follow-up/note/archive history.
  Optimistic versions reject stale writes. Archive/restore retain the entire record;
  won orders cannot be archived through lead management.
- Money uses PostgreSQL decimal values, not JavaScript arithmetic. Amounts are
  INR, quantities accept three decimal places, Financial Year uses YYYY-YY.
  Discount Offered remains descriptive text including its percent/amount units;
  SOE and Lead Source are separate descriptive fields. Times display in IST.
- Dashboard figures and stage counts come from permission-scoped SQL queries;
  no placeholder totals, localStorage persistence or simulated success messages.

## Detailed pre-sales modules

- Schedule site visits against an accessible lead, with an active sales employee,
  appointment date/time, scheduled/confirmed/completed/cancelled/no-show status,
  initial measurements with explicit units, observations and next follow-up.
  Completing a visit requires observations; terminal visits remain historical.
  Rescheduling/status/assignment/measurement changes retain immutable snapshots.
- Visit photos/documents use private Supabase Storage. Accept PDF/JPEG/PNG up to
  4 MiB, validate file signatures, generate unique object paths without overwrite,
  authorize the lead/appointment, and issue authorized 60-second download URLs.
- Item-wise quotations contain name/description, product company, quantity, unit
  rate, item discount, subtotal, final amount, customer notes and revision reason.
  Discounts are explicit INR amounts per item. Quantities have three decimal
  places; INR has two. Use exact decimal arithmetic and round each line half-up.
- One lead belongs to one company. Quotation item company and conversion company
  must match it; enquiries for another company use their own lead and quotation.
- Every issued quotation is an immutable version V1, V2, V3, etc. Never overwrite
  old items, commercial/customer snapshots, notes or amounts. Revisions after V1
  require a reason and an expected previous revision number to prevent stale saves.
  PDFs render the chosen immutable version and its original commercial snapshot.
- Record approved/accepted/rejected decisions separately with actor, timestamp and
  required evidence. These are staff-recorded customer references, not signatures.
  Only the latest complete quotation can receive a new decision or be converted.
- Showroom history contains occurrence date and outcome; Not Required requires a
  reason. Negotiations append dated outcome, notes and optional revised INR offers.
  Negotiated offers require a new approved quotation before affecting an order.
- Won requires an open lead at Negotiation / Quotation Revision, confirmed company,
  latest approved/accepted quotation, final value matching that quotation, confirmed
  final item quantities, and linked customer/project. Transactionally copy the
  quotation/items into one unique lead-linked order and initialize the exact shared
  post-sales workflow at stage 1. Initialization does not claim that stage completed.
- Lost requires a reason, records closure time automatically, cancels pending
  follow-ups and preserves visits, quotations, files, engagements and timeline.
  Closed records cannot receive new workflow activity or silently reopen.
- Pre-sales read/write actions preserve existing tenant/branch/assigned-lead scope,
  active session checks and module permissions. Migration RLS defaults deny public
  access; immutable historical tables reject SQL updates/deletes.

## Unified post-sales engine

- Use one canonical sixteen-stage engine for all three companies. A quotation-backed
  Won conversion transaction creates sixteen pending stage records. It does not
  claim that a WhatsApp group or any other activity has already been performed.
- Each stage stores its name/status, configured owner/reviewer roles, assigned
  employee, planned date, started date, submission/completion dates, notes, typed
  evidence, private attachments, approving employee and immutable audit history.
- Statuses: pending, in progress, awaiting approval, changes requested, completed.
  An owner starts work, saves evidence, and submits it; an authorized reviewer
  approves or requests changes with a reason. Approved stages cannot be overwritten.
- Coordinators with scoped orders.manage plan owners/targets, including future
  stages. Actual evidence and transitions are restricted to the current stage after
  all previous stages are approved. Admin cannot skip core prerequisites.
- Only active, permitted employees in the order branch may own stages. Assigned
  specialists and pending reviewers can read their authorized order context.
  Current grants are checked for every operation. Production release, payment and
  audit reviewers additionally need their respective module permission.
- Admin configures company-scoped responsibilities and additional required fields.
  Core requirements cannot be removed. New orders snapshot policies; optional
  explicit updates affect pending stages only and are audited. Started/completed
  stages retain their policy snapshots. Responsibility changes clear pending owners.
- Record WhatsApp group name, invitation link, actual creation date and documents.
  No automatic group creation, messaging or review sending is claimed.
- Record contract reference, approved payment/credit terms and cumulative INR due
  before dispatch. Zero due is allowed under documented credit terms. Verify actual
  cumulative receipts with references and documents; require coverage of the
  contractual amount before dispatch, not an assumed 100% payment threshold.
- Final survey measurements and documents require approval before production release.
  Readiness must pass; all companies support production-load planning. Approval of
  the load plan verifies the actual load count and existing item allocations. Create
  loads explicitly in Production Loads; empty historical drafts can be allocated.
- Installation completion requires checks for all loads. S-Grip Glass Required is
  recorded during installation start; when Yes, require ordered glass measurement,
  template preparation and template approval within this order before completion.
- Handover follows approved installation and a passed service engineer audit.
  Dispatch/delivery/installation/audit/handover/request evidence dates cannot precede
  their related prerequisite dates.
- Review requests occur after handover. Requested, received, declined and no-response
  outcomes are tracked. A positive review is never required. Optional testimonial
  and review URL requirements apply only to received reviews; declined/unanswered
  requests can complete without either.
- Document metadata is linked to an order and stage using a composite company FK;
  files use private Supabase Storage with bounded 4 MiB uploads and authorized
  60-second download links. Failed uploads cannot report success or create rows.
- Dashboard search, company/task filters, pagination, progress and overdue/unassigned/
  approval alerts use permission-scoped database queries. External notifications,
  bank reconciliation and external provider integrations remain later work.

## Payment, dispatch and delivery management

- Persist precise INR order value, milestones, due/received amounts, verified
  outstanding balance, payment mode, reference, payment date, receipt evidence,
  Accounts status and verifier/time. Support partial payments and installments.
- Admin configures explicit per-load milestone amounts/dates/contract references.
  Verified receipt allocations cannot exceed either the installment or milestone.
  Prevent duplicate active payment references and duplicate allocation rows.
- Require current permissions for every financial mutation. Preserve immutable
  decisions, evidence, allocation rows and before/after audits. Operational readers
  receive shipment evidence and funding summaries; Accounts receipt details,
  financial events and receipt downloads require payment permission.
- Each load supports factory readiness, dispatch approval, date, item quantities,
  transporter, vehicle, tracking/reference, private challan, expected delivery and
  status. Block approval/actual dispatch until required verified payments cover
  both the load milestones and the approved cumulative order contract.
- Multiple consignments may fulfill one load. Reserve item quantities at draft
  creation; release them when cancelling an unshipped draft. Never over-ship.
- Delivery records actual date, site received quantities, recipient, damaged subset,
  missing observations, remarks and private proof. Confirm multiple partial receipts
  transactionally; never receive more than shipped. Missing observations remain
  eligible for a later delivery. Unconfirmed drafts may be cancelled with history.
- Delivered means physical material received; damage remains flagged for explicit
  installation/engineer review. Do not silently equate delivery with quality approval.
- Payment/dispatch dashboards use server-side filters and pagination. Shipments,
  receipts and ledger data drive load/order gates; old manual shipping/payment
  shortcuts cannot bypass verification. See PAYMENTS_DISPATCH_DELIVERY.md.

## Installation, S-Grip glass, handover and service

- Persist per-load installation team/members, planned/actual/completed dates,
  installed item quantities, pending quantities, photos, status and remarks.
  Confirmed delivery precedes installation. Quantities cannot exceed load allocations.
- S-Grip alone requires Glass Required Yes/No during installation. No skips the
  checklist. Yes records dimensions/units, responsible employee/date, uploaded
  prepared template, preparing employee/date and approver/date. Ordered evidence
  remains within the same installation/order; never create a separate glass pipeline.
- Assigned service engineers record inspection date, canonical quality checks,
  findings/photos, assigned corrective actions with due dates/resolutions and final
  approval. Failed checks/open punch items block approval; preserve approval history.
- Handover requires all applicable loads/installation complete, approved audits,
  required glass approval, mandatory handover certificate/installation report/warranty
  document, approved preceding workflow stages and explicit customer acceptance.
  Save actual date, representative, signed reference and confirming employee/time.
- After confirmed handover, track actual Google-review/testimonial requests,
  feedback status, optional low or high rating, comments and publication consent.
  Positive reviews are never required. No automatic messaging is claimed.
- Persist service/complaint tickets after handover with active assigned engineer,
  priority, due date, status, evidence, resolution and audited reassignment/reopening.
  Service work remains available after the order workflow closes.
- Current access/branch/record permissions apply to every action. Private files,
  immutable history, exact quantity counters and transactional gates prevent manual
  shortcuts. See INSTALLATION_AFTERCARE.md for behavior and live prerequisites.

## Management, reports and Admin configuration

- Provide all nineteen management KPIs defined in MANAGEMENT_REPORTING.md using
  permission-scoped real PostgreSQL aggregates, never sample metrics. Keep financial
  sums independent of load/item/installment joins. Only verified receipts count as
  received and reduce outstanding balances; restricted figures are not fake zeros.
- Filters: company, recorded Financial Year, inclusive IST date range, territory,
  assigned sales executive and report-appropriate status. Use bounded SQL pagination.
- Reports: company sales, employee performance, pre-sales conversion, quotation
  revisions, production loads, payment collections, dispatch delays, installation
  progress, engineer audits and site handovers. Preserve quotation history.
- CSV and genuine XLSX exports enforce report, module, company/branch and record
  access, use all matching rows independently of page, audit downloads and protect
  against formula injection/precision loss. Explicitly reject oversized exports.
- Admin manages employees, canonical role permissions, company contact/intake,
  workflow responsibilities/mandatory fields, payment templates and actual milestones,
  territories, document requirements, product categories, SLA and delay rules.
  Preserve canonical company identities, roles, ordered stages and approved history.
- Settings use optimistic versions, soft disable and before/after audits. Active
  territories constrain new selections. Templates never bypass contractual gates.
  New orders snapshot additional required documents; historical requirements persist.
- In-app overdue notifications use current sources and recorded target dates for
  follow-ups, production, payments, installation and audits. Save per-user read/dismiss
  decisions, hide resolved sources and re-evaluate changed due dates. No external
  notification sending is claimed. See MANAGEMENT_REPORTING.md for exact definitions.
