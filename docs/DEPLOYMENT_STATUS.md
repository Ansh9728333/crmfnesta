# Live deployment record

Date: 25 October 2026. Status: **LIVE — production build and HTTPS/auth checks passed**.

Deployed application release: `c17d8f0` — complete visible Help intake and Admin
permission compatibility (main feature `4e23d47`, building on `ba0f4b7`).
Vercel deployment: `dpl_7BG8XQ6GTwjA3HULd8TM1eBkKpyN`.

| Resource                | Target                                             |
| ----------------------- | -------------------------------------------------- |
| Source                  | https://github.com/Ansh9728333/crmfnesta           |
| Release branch          | main                                               |
| Application             | SiteFlow CRM                                       |
| Vercel project          | crmfnesta, Bajrang's projects workspace            |
| Intended production URL | https://crmfnesta.vercel.app                       |
| Function region         | Singapore, sin1                                    |
| Database                | Supabase PostgreSQL 17.11, Singapore shared pooler |

The user explicitly authorized live deployment/source push, separately approved the
live Super Admin, then requested Admin-selected passwords without a forced first-login
change. Production uses normal Better Auth services; local test account passwords
and customer fixtures are not copied.
Bootstrap credentials are absent from Vercel's runtime configuration. Login details
are provided only in the ignored local production account file.

## Verified infrastructure

- Initial public schema was empty. Applied reviewed migrations 0000–0025 through
  the migration runner, then verified all 26 ledger hashes against source bytes.
  Migration 0021 retires legacy first-login flags with immutable policy audits and
  preserves credential hashes. SQL bytes are preserved in Git across checkouts.
- Verified database TLS chain/hostname using the Supabase Root 2021 CA. Server
  verification remains enabled for both migration and transaction-pooler clients.
- All 57 application tables enable RLS, browser roles have no effective grants,
  and both document/Help buckets have restrictive server-only policies.
- Real private bucket upload, anonymous denial and short-lived signed download
  preserve PDF bytes. The unique infrastructure probe was removed afterward;
  no customer documents were created, changed or deleted.
- Eight production variables are stored in Vercel; server secrets were sent through
  stdin, not command-line values or source files. DIRECT_URL remains operator-only.
- Git secret scan found no current credentials/private keys/token patterns in source.
  `.env*`, `.local`, private keys and local test fixtures are excluded from CLI upload.
- Initial main-branch full CI passed: [hosted checks](https://github.com/Ansh9728333/crmfnesta/actions/runs/40165144302).

## Open operational items

- The user requested continuing with the same chat-shared legacy server key after
  the exposure warning. The database password was also supplied in chat. Both are
  confined to private configuration, but their disclosure cannot be undone by
  ignoring files. Rotate/retire them in Supabase, update runtime/operator values
  together and re-verify. A new server secret alone does not revoke a legacy key.
- Vercel could not connect the GitHub repository because the Vercel account needs
  a GitHub Login Connection. CLI deployment works independently. Until that is
  connected, a Git push does not automatically redeploy this application.
- Backup/Storage restore drills, independent-connection business concurrency,
  production-scale performance and full live business-user acceptance have not
  been performed. Isolated tests do not establish those results.
- No automated WhatsApp, review request, email or SMS sending is claimed.

## Production verification

Production URL: [SiteFlow CRM](https://crmfnesta.vercel.app).
The Vercel build ran a clean `npm ci` (zero reported dependency vulnerabilities),
compiled/typechecked Next.js and reached Ready. Inspection confirms runtime functions
in sin1; the build machine location is separate from the function region.

[Release CI](https://github.com/Ansh9728333/crmfnesta/actions/runs/40168634587)
passed for the exact deployed application commit. Live checks verified:

- HTTPS sign-in page, no-store, nonce CSP and security headers.
- Anonymous employee API denial and blocked raw Admin-plugin endpoints.
- Real administrator sign-in with Secure/HttpOnly/SameSite cookies.
- Direct dashboard login with the existing password and scoped Admin API access.
- Optional password-change page, sign-out and server session revocation.
- Charcoal navigation/header, coloured real-data KPIs and collection/workload panels.
- Live Admin account form: empty Admin-selected password field, designation selector
  and no temporary-password prompt. No employee was created or modified for this check.
- Desktop/mobile dashboard, mobile drawer and no horizontal overflow. Screenshots
  show dashboards or empty account fields and contain no password input values.

Existing passwords were not changed by automation. Admin selects employee usernames,
passwords and canonical designation/role assignments. Creation/reset permits direct
sign-in without a temporary credential or compulsory password change. Resets and
designation edits still revoke sessions. No lead/order/customer test records were
inserted into production. Full live business acceptance and the operational items
above remain outstanding. Subsequent documentation-only commits do not change the
deployed application; Git-based automatic deployment is not connected yet.

## Help Tickets release — 25 October 2026

Approved feature commit `ba0f4b7` is pushed to main and deployed at the existing
production domain. Unique deployment:
https://crmfnesta-pbvcxopis-bajrangs-projects-fe910f90.vercel.app.
Vercel reports READY; production HTTPS verification returns the real sign-in page.
The deployed commit's complete hosted CI passed:
https://github.com/Ansh9728333/crmfnesta/actions/runs/40175970887.

- Local lint, TypeScript, 49 unit, 66 isolated database, 10 public browser and 18
  authenticated desktop/mobile browser checks pass; production build passes.
- Live migration preflight verified the unchanged previous 22 hashes; additive
  0022/0023 applied with all 24 hashes matching. All 57 tables have RLS and browser
  grants are revoked. Both restrictive private Storage policies are present.
- Separate private 10 MiB Help bucket configured. Real direct signed 10 MiB upload,
  overwrite denial, byte integrity, signed download, anonymous denial and oversize
  rejection pass. Unique infrastructure objects were removed in finally.
- A 336-file source secret scan passed. Staged new SQL bytes match their applied
  artifacts. Vercel manifest includes 303 regular files and empty directory markers;
  local secrets/databases, environment files and test contents are excluded.
- Live existing-password login, anonymous Help API denial, real Supabase ticket
  list/source queries, scoped Admin concern settings, private no-store/CSP, and
  desktop/mobile Help pages/empty create forms pass. Existing general auth/security,
  optional own-password and sign-out/revocation checks remain successful.
- No production employee, customer, lead, project, order or ticket test fixture was
  created or modified. Full lifecycle writes were exercised in isolated databases;
  customer-specific live business acceptance remains an operator task.

The module is first in Workspace, above Projects. Help is available before and
after an order; existing handover-only service tickets retain their gates. Default
access stays with sales intake/service resolution roles, and Admin controls other
grants. Existing passwords were not changed. Automatic external messaging, orphan
upload cleanup and malware scanning are not implemented; see HELP_TICKETS.md.
Operational recovery/performance/credential-rotation items above remain applicable.

## Help intake refinement — 25 October 2026

Release `4e23d47` is live at the existing domain, with unique deployment
https://crmfnesta-9ucuyxmnc-bajrangs-projects-fe910f90.vercel.app.
Its full hosted CI passed:
https://github.com/Ansh9728333/crmfnesta/actions/runs/40178307020.
Lint, TypeScript, 49 unit, 68 isolated database, 10 public and 18 authenticated
browser checks plus production build pass. Focused database tests also cover
assigned Accounts proof uploads and legacy-version inserts during rolling release.

Migrations 0024/0025 add immutable typed locations and allow customer-only intake.
All 26 hashes match; 57-table RLS, revoked browser grants and both private Storage
guards remain verified. No broad role grants or new branches were created. Help
intake exposes minimal name/mobile/project context for all clients in an authorized
company. Other CRM record permissions stay independent. All active company employees
can be selected; a named assignment authorizes only that ticket. The actual session
submitter and independent confirmation requirements remain enforced.

Live desktop/mobile checks pass: every question exists before client selection,
location accepts typed input, client/employee option counts match real scoped
Supabase responses, submitter is readonly, and notifications query succeeds. General
login/Admin/security headers/logout checks also pass. Verification never submitted
a Help form or created/changed production CRM/customer/employee records. A 340-file
source secret scan and staged SQL-byte check passed; the Vercel manifest excludes
local credentials/databases/tests (307 regular application files).

Final compatibility follow-up `c17d8f0` is deployed as
`dpl_7BG8XQ6GTwjA3HULd8TM1eBkKpyN` at the existing URL (unique deployment:
https://crmfnesta-gngywlggf-bajrangs-projects-fe910f90.vercel.app).
Its full hosted CI passed:
https://github.com/Ansh9728333/crmfnesta/actions/runs/40179101138.
Retired permission strings are filtered from the Admin editor's hidden selection,
so existing role settings remain editable. Isolated browser fixtures include those
legacy grant rows; four focused desktop/mobile Help/Admin checks pass after the
full local quality suite. Final live Help form checks pass again without submission.
No production permissions, credentials or CRM records were changed for testing.
