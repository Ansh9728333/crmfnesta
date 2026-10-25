# Live deployment record

Date: 25 October 2026. Status: **LIVE — production build and HTTPS/auth checks passed**.

Deployed application release: `2357ee3`.
Vercel deployment: `dpl_CB3wbcVUeHgt8FotmG5bkP1VUWbg`.

| Resource                | Target                                             |
| ----------------------- | -------------------------------------------------- |
| Source                  | https://github.com/Ansh9728333/crmfnesta           |
| Release branch          | main                                               |
| Application             | SiteFlow CRM                                       |
| Vercel project          | crmfnesta, Bajrang's projects workspace            |
| Intended production URL | https://crmfnesta.vercel.app                       |
| Function region         | Singapore, sin1                                    |
| Database                | Supabase PostgreSQL 17.11, Singapore shared pooler |

The user explicitly authorized live deployment/source push and separately approved
the live Super Admin. Production uses fresh admin/auth secrets and existing normal
Better Auth services; local test accounts/passwords/customer fixtures are not copied.
Bootstrap credentials are absent from Vercel's runtime configuration. Login details
are provided only in the ignored local production account file.

## Verified infrastructure

- Initial public schema was empty. Applied reviewed migrations 0000–0020 through
  the migration runner, then verified all 21 ledger hashes against source bytes.
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

[Release CI](https://github.com/Ansh9728333/crmfnesta/actions/runs/40165756312)
passed for the exact deployed application commit. Live checks verified:

- HTTPS sign-in page, no-store, nonce CSP and security headers.
- Anonymous employee API denial and blocked raw Admin-plugin endpoints.
- Real administrator sign-in with Secure/HttpOnly/SameSite cookies.
- Mandatory first-login password-change redirect and 428 API restriction.
- Password-change page rendering, sign-out and server session revocation.
- Desktop browser login/sign-out and a responsive mobile sign-in page without
  horizontal overflow. Screenshots were saved only before credentials were filled.

The temporary production password was not changed by automation. The administrator
must choose a new password at first login. No lead/order/customer test records were
inserted into production. Full live business acceptance and the operational items
above remain outstanding. Subsequent documentation-only commits do not change the
deployed application; Git-based automatic deployment is not connected yet.
