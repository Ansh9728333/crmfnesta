# Help Tickets

Workspace → **Help Tickets**, above Projects. Raise from a lead/project row or
search an existing client/project in the dialog. Client, company and location are
derived from authorized records; Raised By is the logged-in employee, never a
spoofable selection. Finesta Home, IBAX and S-Grip share one implementation.
General help works before Won conversion and after handover. Existing aftercare
Service Tickets retain their handover gates and independent workflow.

## Flow and form

`Raised → In Progress → Awaiting Confirmation → Closed`

The assigned resolver submits a written solution and optional proof. The creator
confirms and closes, or reopens with a mandatory reason. Recurrence can reopen a
closed ticket. Every resolution attempt, rejection, assignment and confirmation
remains in immutable history. Admin can reassign within the company/location with
a reason. Reassignment resets the active task while retaining previous evidence.

The resolver cannot confirm their own solution, including an Admin. Self-assigned
tickets need a separate Admin. A separate scoped Admin may confirm other tickets
when needed. Ticket actions never advance sales/production/handover stages.

Required: source lead/project, concern type, brief details, priority, active resolver.
Defaults: Quotation, Site Visit, Payment, Production, Delivery, Installation,
Service, Other. Admin can add/edit/soft-disable types, require supporting evidence
and configure an SLA in hours. Original concern, requirement and due date are
snapshots. Without an SLA, no date is invented. One supporting attachment is
optional unless required by the selected concern. Resolution proof is optional.

## Access and queries

- Company-scoped Admin/Super Admin manages tickets and settings. Normal users see
  their own raised/assigned tickets in currently assigned active branches.
- Sales Manager/CSE/Sales Executive initially get `help.read` + `help.raise`.
- Service Engineer/Post-Sales Coordinator get `help.read` + `help.resolve`.
- Other roles get no automatic Help permissions. Admin can grant the three
  permissions through existing Roles and permissions settings.
- Intake also requires existing lead/project access. Post-sales project access can
  follow an authorized order. Resolver selection requires active account/profile,
  exact company/location, read and resolve access. Ticket access grants no general
  lead, project, order or financial access; full-record links remain scoped.
- Mutations reauthorize after the shared transaction advisory lock. Optimistic
  versions reject stale updates; request UUIDs prevent duplicate creation. RLS,
  revoked browser grants, composite company FKs and SQL state/evidence guards apply.
- My Raised, Assigned to Me, Awaiting My Confirmation, Reopened and Overdue tabs;
  company/location/client/resolver/priority/status/date filters and 20-row SQL
  pagination. Date filters use inclusive IST days. Counts follow current filters.
- Detail drawer/full page show context, private files and complete named history.
  In-app assignment/confirmation/overdue alerts use current state and per-user
  read/dismiss receipts. Navigation/mutations and a 60-second poll refresh alerts.

## Files and rollout

Separate private bucket `siteflow-help-ticket-files`: PDF/JPEG/PNG, **10 MiB** max.
The existing 4 MiB document bucket is unchanged. An authorized server issues an
immutable signed upload path; the browser PUTs directly to Supabase to avoid
Vercel's body limit. Server rechecks authorization, actual size and magic bytes,
then verifies a 30-minute lease. Ticket submission claims the verified unused file
in the same database transaction. Downloads require current ticket scope, an audit
and a 60-second signed URL. Never log tokens or complete signed URLs.

Supabase upload capabilities last two hours. Abandoned uploads remain private and
unlinked. An operator may remove only **unclaimed objects older than three hours**,
retaining lease/audit records. Automatic orphan cleanup and malware scanning are
later work; signature validation is not a virus scan.

Apply reviewed migrations 0022/0023 through `npm run db:migrate`; run
`npx tsx --conditions=react-server scripts/configure-help-storage.ts` using authorized
server configuration. Bucket limits and restrictive default-deny Storage policies
apply. CSP allows direct uploads only to the configured project's Storage path.

No Google Forms/account integration or automatic email/SMS/WhatsApp sending is
claimed. [Official signed upload documentation](https://supabase.com/docs/reference/javascript/storage-from-createsigneduploadurl)
and [Storage access control](https://supabase.com/docs/guides/storage/security/access-control).

## Verification

Isolated database tests cover intake before handover, assignments, independent
confirmation, repeated resolution/reopening, Admin reassignment, unauthorized
branches/records, current permission revocation, idempotency, stale updates,
filtering/pagination, policy snapshots, verified evidence and immutable history.
Desktop/mobile browser tests use separate real database-backed creator/resolver
sessions, reload persistence, project context and drawer keyboard focus. Test
fixtures are never seeded into the production Supabase database.
