# SiteFlow CRM production-readiness audit

Update, 25 October 2026: the user subsequently authorized the live rollout.
See [deployment record](DEPLOYMENT_STATUS.md) for verified Supabase/Vercel production
results and still-open operational work. The audit below preserves the 24 October
state and must not be read as the current deployment status.

Audit date: 24 October 2026. Release decision: **HOLD for live acceptance**.
No deployment, push, external provisioning, live migration or customer messaging
was performed. This is a repository audit and isolated test result, not a
penetration-test certification or evidence that a Supabase project is configured.

## Findings and corrections

| ID     | Severity | Finding                                                                                                                               | Correction and regression coverage                                                                                                                                                                                                                                                                                                                            |
| ------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SEC-01 | High     | Postgres.js `ssl: "require"` disabled server certificate validation. Encryption alone did not authenticate the remote database.       | Runtime and migration runner now share verified TLS options. Optional `DATABASE_SSL_CA` supplies the project's trusted PEM certificate. Loopback alone permits plaintext isolated testing. Unit tests cover remote hosts, weaker URL options, CA and loopback. Actual project certificate acceptance remains a release gate.                                  |
| SEC-02 | Medium   | API and username-login JSON bodies were fully buffered before checking size; character counts also underestimated UTF-8 payload size. | A streaming byte limit cancels oversized requests, including chunked bodies, rejects invalid UTF-8 and checks declared lengths early. JSON API limit 32 KiB; auth POST limit 4 KiB. Auth reconstructs only the bounded request for Better Auth. Unit and real-auth integration tests cover rejection.                                                         |
| SEC-03 | Medium   | Several auth/API error paths lacked explicit cache protection.                                                                        | All shared API error and explicit auth rejection/unavailable paths now use private/no-store. Browser tests cover denied auth routes and unavailable protected APIs. Success responses retain no-store.                                                                                                                                                        |
| SEC-04 | Medium   | Browser responses had no application CSP or explicit framing/content-type policy.                                                     | Per-document random nonces, strict-dynamic scripts, no objects/frames, same-origin connections/forms, nosniff, DENY framing, no-referrer, restricted browser permissions and HSTS. Root rendering is dynamic so login also gets a fresh nonce. Production browser tests verify nonce rotation, script nonces and blocked inline HTML event-handler injection. |
| OPS-01 | Low      | CI actions used movable version tags and checkout retained credentials.                                                               | Action revisions were verified against official upstream v7 tags and pinned to commit SHAs; checkout credentials disabled. Read-only token permissions retained. Dependency audit added; Dependabot prepares reviewed npm/action updates. No deployment credentials are needed by checks.                                                                     |

CSP intentionally permits inline **styles** for Radix positioning and progress bars;
initial scripts require a nonce and their trusted loaders inherit authority through
strict-dynamic. Inline HTML event handlers are blocked. Development alone permits
eval and WebSockets. Application
connections are same-origin: Storage signing/upload happens on the server, and
downloads navigate to short-lived URLs. Future analytics/integrations require a
reviewed CSP update. Vercel preview toolbar injection may need to be disabled rather
than weakening the production policy. CSP proxy handles document responses; API
authorization remains in each service, not in the proxy.

## Security boundary review

- Better Auth is the authentication authority. Supabase provides PostgreSQL and
  private Storage; Supabase Auth and browser JWT/RLS identity are not used.
- Public auth allowlist is username sign-in, sign-out and session retrieval only.
  Provisioning, password resets and grants go through scoped Admin services.
  Database sessions, active profiles/branches, first-login password state and
  current role grants are re-evaluated. Session cache is disabled.
- Mutation origin checks reject missing/foreign origins. Cookies are HttpOnly,
  SameSite Lax and Secure on HTTPS. Database-backed IP/account login throttles
  survive instances; the IP header configuration assumes Vercel's trusted ingress.
  Another hosting proxy needs a separate header/spoofing review.
- Privileged transactions serialize with the shared advisory lock before resolving
  authority. Branch/record predicates apply even when the server connection bypasses
  RLS. Composite tenant/parent keys and database guards defend relationships.
- Application tables enable RLS and revoke browser-role access. A restrictive
  Storage policy excludes the private bucket even if another permissive policy
  exists. The real project must be inspected for drift and unexpected grants.
- Quotation revisions, financial allocations, fulfilled quantities and approved
  evidence retain history. Exact SQL numeric/Decimal calculations avoid floating
  point authoritative totals. Report exports reauthorize, audit and protect CSV
  formulas and Excel precision; downloads cap at 10,000 matching rows.
- Private files are authorized before signing; signatures expire in 60 seconds.
  File type/signature and bounded 4 MiB uploads are checked. A signed URL remains
  usable until expiry after revocation: this is the explicit maximum exposure.
- No production localStorage/in-memory fallback, synthetic customer data, provider
  success emulation or automatic WhatsApp/review message claims were introduced.
  Shared error responses omit raw SQL/provider errors; no customer or credential
  logging was added. Platform log access and drains still need operational review.

## Workflow verification map

| Workflow                   | Automated evidence                                                                                                                                                                                                                                        |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Employees and security     | Provision/edit, normalized unique usernames, first-login change, forbidden public endpoints, role/tenant isolation, reset/deactivation/revocation, expired sessions, origin and rate limits, private file denials, immutable audits.                      |
| Common pre-sales           | Lead/customer/project CRUD, assignment, filters/pagination/reload, mobile validation/duplicates, follow-ups, visit evidence, showroom/negotiation and quotation V1/V2 history, accepted-quote Won conversion and Lost reason, duplicate-order prevention. |
| Shared post-sales          | Canonical sixteen stages, responsibilities, mandatory fields/documents, approval/status history, preceding-stage gates and unauthorized transition denials. WhatsApp is recorded evidence only.                                                           |
| Production                 | Finesta Home, IBAX and S-Grip: 40 items split 30/10, exact per-item allocation, pending quantities, invalid/concurrent over-allocation attempts, independent timelines and load completion without parent completion.                                     |
| Accounts and logistics     | Multiple/partial installments, receipt verification and financial scope, allocation caps, blocked unpaid dispatch, valid dispatch and partial delivery, received/damaged/missing quantities.                                                              |
| Installation and aftercare | Per-load installation entries; S-Grip Yes/No and ordered glass evidence; engineer findings/punch resolution/approval; all-load, installation, glass, audit and document handover gates; declined feedback and assigned/reopened service tickets.          |
| Management                 | Nineteen KPIs, verified financial aggregates without join duplication, all ten reports, scoped filters/pagination/exports, Admin versioning, intake/territory rules, document snapshots, notifications and reload.                                        |
| Browser behavior           | Public and authenticated desktop/mobile suites exercise real isolated database APIs, persistent reload, forms/navigation, focus and horizontal overflow. Browser fixtures never use the live project.                                                     |

See phase-specific documents for exact domain semantics. Integration scenarios run
the complete service lifecycle; browser tests exercise representative user journeys
across every implemented module. This does not mean every combination has been
clicked in a live environment. Storage browser fixtures cannot prove Supabase
upload/signing availability. PGlite cannot establish production multi-session lock,
network/TLS or query-plan behavior.

## Verification record

| Command                       | Result                                                                  |
| ----------------------------- | ----------------------------------------------------------------------- |
| `npm run lint`                | Passed, zero warnings.                                                  |
| `npm run typecheck`           | Passed.                                                                 |
| `npm test`                    | 45 passed across 10 unit files.                                         |
| `npm run test:integration`    | 53 passed across 3 isolated database files.                             |
| `npm run build`               | Passed; authenticated pages and nonce-bearing login render dynamically. |
| `npm run test:e2e`            | 10 passed, public desktop/mobile and browser security.                  |
| `npm run test:e2e:auth`       | 16 passed, authenticated desktop/mobile lifecycle.                      |
| `npm audit --omit=dev --json` | Zero known production vulnerabilities.                                  |

Environment presence and ignore checks confirmed secrets remain empty and ignored.
Targeted source/script/document scans found no matching private-key, Supabase secret
or GitHub token patterns; this does not replace hosted secret scanning or a review
of the initial commit. No GitHub-hosted CI run was possible without a configured
remote. Checks used the installed lockfile dependencies; hosted `npm ci` remains
part of release acceptance.

The first build exposed a TypeScript issue in the new browser assertion, which was
corrected. A subsequent stale OneDrive output-directory EPERM was resolved by
removing only the verified workspace `.next` directory and rebuilding. The initial
CSP injection test used a trusted dynamic loader; its corrected HTML event-handler
attack is blocked. Final checks above passed after those corrections.

The production dependency audit returned zero known vulnerabilities on this date;
this is time-bound and not a guarantee of absence of vulnerabilities.

## Outstanding release gates

1. Configure and test the actual target. Presence-only inspection found empty
   DATABASE_URL, DIRECT_URL, BETTER_AUTH_SECRET, SUPABASE_URL and
   SUPABASE_SERVICE_ROLE_KEY. No secret values were printed.
2. Apply/re-run migrations 0000–0020 in staging through the reviewed runner;
   verify target ledger, grants/RLS, actual private Storage policy, byte uploads,
   MIME rejection, signed download expiry and unauthorized access.
3. Repeat allocation/payment/Won races from independent PostgreSQL connections.
   Load-test scoped reports/exports and advisory-lock contention at expected
   instance concurrency. Record query plans, latency and pool headroom.
4. Perform database **and Storage object** backup/restore drills. Record real RPO,
   RTO, backup retention and reconciliation results. A written procedure is not
   proof that recovery works.
5. Configure GitHub remote/protection, real hosted CI, Vercel environments/domain,
   trusted proxy behavior, operational monitoring and incident ownership. None
   of these account settings was verified or changed in this audit.
6. Obtain explicit deployment authorization after staging acceptance and reviewing
   the deployment checklist. Source is currently untracked and no Git remote is
   configured; create/review a reproducible release commit before any deployment.

## Official references reviewed

- [Next.js nonce-based CSP](https://nextjs.org/docs/app/guides/content-security-policy)
  and [response headers](https://nextjs.org/docs/app/api-reference/config/next-config-js/headers).
- [Supabase production checklist](https://supabase.com/docs/guides/deployment/going-into-prod),
  [network restrictions](https://supabase.com/docs/guides/platform/network-restrictions)
  and [database backups](https://supabase.com/docs/guides/platform/backups).
- [GitHub Actions secure use](https://docs.github.com/en/actions/reference/security/secure-use)
  and official [checkout](https://github.com/actions/checkout) /
  [setup-node](https://github.com/actions/setup-node) v7 repositories.
- [Vercel environments](https://vercel.com/docs/deployments/environments).

The TLS finding was confirmed directly in installed Postgres.js source and options
precedence, rather than inferred from the word "require".
