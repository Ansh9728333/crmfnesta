# Live deployment record

Date: 25 October 2026. Status: **LIVE — production build and HTTPS/auth checks passed**.

Deployed application release: `417871d` (theme/account changes in `b5d5791`, followed
by a confirmation-message clarification).
Vercel deployment: `dpl_3AwgW6PnF2HwG2hQiMG3uAhYfPUp`.

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

- Initial public schema was empty. Applied reviewed migrations 0000–0021 through
  the migration runner, then verified all 22 ledger hashes against source bytes.
  Migration 0021 retires legacy first-login flags with immutable policy audits and
  preserves credential hashes. SQL bytes are preserved in Git across checkouts.
- Verified database TLS chain/hostname using the Supabase Root 2021 CA. Server
  verification remains enabled for both migration and transaction-pooler clients.
- All 53 application tables enable RLS, browser roles have no effective grants,
  and Storage has the restrictive server-only policy.
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
