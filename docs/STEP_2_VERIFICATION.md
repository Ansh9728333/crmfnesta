# Step 2 delivery and verification

Implemented on 24 October 2026. Supabase Auth has been replaced by Better Auth
Admin/Username authentication backed by Drizzle/Postgres.js. No deployment or
GitHub push was performed.

## Delivered

- `/login`: responsive username/password login, generic credential errors and no signup.
- `/change-password`: authenticated first-login/reset password change with current
  credential verification, new session cookie, old-session revocation and audit.
- Protected dashboard and existing modules with current server-side permissions.
- `/admin/employees`: real persisted employee CRUD (creation and edit), generated
  employee codes, roles, multiple organization/branch assignments, search/filters,
  status, last login, reset, activation/deactivation and session revocation.
- Creation modal, edit drawer and explicit confirmations for privileged changes.
- Organization-scoped role permission management and Add branch action.
- Official Better Auth generated user/account/session/verification/rate-limit schema.
- 31 PostgreSQL tables, foreign keys, workflow bounds, multiple production loads,
  S-Grip installation glass checks, tenant indexes and append-only audit logs.
- Schema migration plus reviewed security migration: no browser Data API access,
  RLS enabled, public grants revoked, restrictive private-Storage bucket policy.
- Server-only Storage client and authorized 60-second document-download endpoint.
- Persistent IP/account login limits and per-account password-change limits;
  exact-origin/CSRF checks, secure HTTPS cookies, no cookie-session cache.
- Sign-in, password and privileged account mutations serialized with transactional
  advisory locks to prevent races between credential verification and revocation.
- One-time CLI bootstrap with real email/branch configuration, no default password,
  no public bootstrap and refusal after any authentication user exists.
- Environment template, setup instructions, role defaults and security conventions.

## Files and folders

| Area               | Files                                                                                                                                                      |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Database           | `drizzle.config.ts`, `drizzle/0000_busy_starfox.sql`, `drizzle/0001_security-boundary.sql`, migration metadata, `src/lib/db/{index,schema,auth-schema}.ts` |
| Auth               | `src/lib/auth/{index,config,access,server,handler,validation,roles,bootstrap,password,rate-limit}.ts`, `src/lib/env.ts`, `src/lib/http.ts`                 |
| Employee services  | `src/lib/employees/{index,service}.ts`                                                                                                                     |
| Private documents  | `src/lib/documents/{service,storage}.ts`                                                                                                                   |
| Routes             | Login, forced password change, admin employees, Auth allowlist, account password, admin employee/permission/branch APIs, document download                 |
| UI                 | `src/features/auth/*`, `src/features/employees/employee-manager.tsx`, shadcn Dialog/AlertDialog/Input; shared shell and existing pages updated             |
| Operator tools     | `scripts/{migrate,bootstrap-admin,configure-storage,auth-schema.config}.ts`                                                                                |
| Tests              | Unit, PostgreSQL integration, public-browser and authenticated-browser suites; disposable test socket server and reserved fixtures                         |
| Configuration/docs | `.env.example`, package/lock files, CI, Playwright/Vitest configs, Prettier config, README, AGENTS, requirements and implementation plan                   |

Removed the old `src/lib/supabase` Auth helpers and `@supabase/ssr`. Supabase JS
remains server-only for private Storage. Business stage names and company names
have not changed.

## Commands and local acceptance

| Check                                        | Result                                                       |
| -------------------------------------------- | ------------------------------------------------------------ |
| ESLint                                       | Pass, zero warnings                                          |
| TypeScript                                   | Pass                                                         |
| Unit tests                                   | 4 passed                                                     |
| Database integration tests                   | 17 passed                                                    |
| Public desktop/mobile browser tests          | 8 passed                                                     |
| Authenticated desktop/mobile lifecycle tests | 2 passed                                                     |
| Production build                             | Pass                                                         |
| Current dependency audit                     | 0 vulnerabilities                                            |
| Migration/schema generation                  | Actual migrations applied in isolated tests; no schema drift |

Desktop/mobile login, create-employee modal and employee-directory screenshots
were generated for visual review under the ignored `test-results/` directory.

The following commands are the acceptance checks for this delivery:

```sh
npm run lint
npm run typecheck
npm test
npm run test:integration
npm run db:generate
npm run build
npm run test:e2e
npm run test:e2e:auth
npm audit
git diff --check
```

The generated auth schema uses the official `auth generate` tool. Schema generation
after the final model changes reports no pending schema changes. The migrations
are applied in both integration and authenticated browser test fixtures.

Integration tests use isolated PGlite PostgreSQL with the real Better Auth APIs and
the same Drizzle services. Authenticated browser tests additionally expose that
disposable engine through the PostgreSQL wire protocol and use the production
Postgres.js driver and built Next.js server. They never load live Supabase secrets,
create production employees or send emails. Test identities use reserved `.test`
addresses; these are not bootstrap defaults.

The suites cover Admin provisioning, duplicate usernames, scoped Admin authority,
forbidden employee administration, direct signup rejection, username login, wrong
credentials, first-login/reset password changes, inactive accounts, session
revocation/expiration, current permission enforcement, tenant/branch/assigned-order
isolation, default-deny table access, private-document authorization, restrictive
Storage policy behavior and login throttling. Browser flows also exercise create,
edit role, password reset, activation/deactivation, revoke and logout on both layouts.

## Live-project prerequisites and unverified checks

At the final configuration inspection, `.env.local` had not been created. Therefore
no live database migration, actual administrator bootstrap or Storage bucket
provisioning has been attempted. No live Supabase persistence or signed-download
claim is made. Local test success is not evidence of a deployed integration.

Once the real configuration is ready:

1. Inspect the target project for conflicting existing tables, then apply
   `npm run db:migrate` using DIRECT_URL.
2. Set real BOOTSTRAP_* values, run `npm run admin:bootstrap`, remove those values,
   and complete the initial administrator password change.
3. Configure the server-only Storage variables and run `npm run storage:configure`.
4. Verify real employee provisioning, login/logout, password changes, revocation,
   PostgreSQL persistence after restart and authorized/unauthorized file access.
5. After deployment is separately authorized, verify HTTPS/Secure cookies and
   login/logout on the deployed hostname. This delivery did not deploy the app.

At completion of Step 2, customer/lead/order CRUD and workflow UI were subsequent
phases. Common pre-sales CRUD and Won conversion have since been implemented;
see PRESALES_IMPLEMENTATION.md for current evidence and remaining live checks.
Document uploads, post-sales workflow modules, GitHub remote selection and
production deployment remain subsequent work.
