# Live deployment record

Date: 25 October 2026. Status: production deployment pending final build.

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

Production HTTP/auth verification and the deployed release identifier will be added
after the build finishes. Do not interpret the intended URL alone as proof of release.
