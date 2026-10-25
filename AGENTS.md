# Project conventions

## Scope

Read docs/CRM_REQUIREMENTS.md and IMPLEMENTATION_PLAN.md before changing workflows.
Keep the exact company names and ordered stages. Implement only the requested
phase. Do not deploy, push, or provision external resources without authorization.

## Architecture

- App Router routes live in src/app. Use Server Components by default.
- src/components/ui contains shadcn/ui primitives; shared shell in components/layout.
- src/features contains domain UI; src/lib contains shared configuration and clients.
- Keep workflow definitions in src/lib/domain; do not duplicate stage strings.
- Use @/* imports, strict TypeScript, descriptive names, and small typed components.
- Use Tailwind semantic tokens, Montserrat, Lucide, and accessible UI primitives.
- Client Components are limited to interactive boundaries. Prefer URL query state
  for shareable filters. No localStorage CRM persistence.

## Security

- No hardcoded credentials, fake APIs, fake mutation success, or invented records.
- Use Better Auth with Admin/Username plugins and Drizzle/Postgres.js. Do not use
  Supabase Auth or auth.uid(). Remove obsolete Supabase SSR authentication patterns.
- Validate database-backed Better Auth sessions, active profiles, first-login state,
  organization/branch role assignments and record permissions on every operation.
- Public Auth routes are an explicit allowlist. Never expose Admin plugin endpoints,
  signup, user discovery or email login. Provision through the scoped server service.
- Use Admin APIs for credentials and account management, including username data.
  Never write password hashes manually. Require real unique emails; send no emails
  to synthetic addresses. No hardcoded bootstrap credentials or public bootstrap.
- Use force-dynamic for authenticated pages; never cache personalized responses.
- Enable RLS with no anonymous/authenticated allow policies; revoke browser grants.
  A privileged server DB connection bypasses RLS: explicit service scope checks are
  mandatory. Authorize private Storage server-side before issuing short-lived URLs.
- Database migrations and auth schema generation are reviewed artifacts. Use the
  installed official `auth generate` CLI; preserve auth schema provenance. Apply
  schema/security changes together with the migration runner, never db push.
- Keep privileged account mutations, session invalidation and audits transactional.
  Serialize privileged mutations to prevent concurrent role-change authorization races.
- Validate untrusted inputs with Zod. Keep secret/admin clients server-only.
- Keep .env files ignored; only commit .env.example with empty values.
- Do not log customer data, credentials, tokens, or full signed URLs.
- Never bypass auth when configuration is missing: protected pages redirect to
  login and APIs fail closed. Only login and static error pages are public.

## Quality

Run npm run lint, npm run typecheck, npm test, npm run test:integration and npm run build for substantive
changes. Test domain invariants and user behavior, not implementation details.
Check mobile navigation and keyboard focus. Honest empty/error/loading states are
required. Keep npm's package-lock.json current and use npm ci in CI.
Document material limitations. Never claim an integration works without testing it.
PGlite is an isolated test engine only, never a production fallback. Do not load
real .env.local credentials in test suites or run destructive tests on Supabase.

## Fulfillment and customer care

- Installation and engineer-audit records belong to existing production loads in
  the same order/company. Installed quantities come from append-only item entries;
  never update internal quantity counters directly or use floating-point totals.
- Use the dedicated aftercare service for installation, glass, audit, completion,
  handover, feedback and tickets. Generic production status forms must not bypass
  those evidence gates. Canonical order stages 12–16 verify the actual records.
- S-Grip glass is an ordered checklist within the existing installation/order.
  Never introduce a separate glass production/dispatch/installation pipeline.
- Preserve approved audit/glass evidence and confirmed handovers. Record corrections,
  assignments, feedback edits and ticket reopening as audited service operations.
  Customer care can continue after the order workflow is complete.
- Feedback requests must follow confirmed handover. A declined request or low rating
  is valid. Do not claim to send messages or require a positive public review.
