# Dashboard theme and Admin-managed accounts

Requested on 25 October 2026.

The shared shell uses a charcoal header/sidebar, red active navigation, a light
neutral workspace and Montserrat. KPI cards use blue, amber, green and red with
readable foregrounds; amber uses dark text. Shared form/button/table tokens apply
the theme throughout the CRM. Mobile navigation remains a keyboard-accessible
drawer. Global lead search uses the real permission-scoped lead route.

Management retains all nineteen SQL-backed KPIs. Operational workload bars compare
actual pending counts; collection panels show existing exact financial values.
No sample metrics, invented traffic history or external analytics are introduced.
Financial restrictions, scoped filters, tables and exports remain unchanged.
Pre-sales and order overviews reuse the metric-card primitive.

## Accounts

Only scoped Admin/Super Admin services provision employees or reset passwords.
Admin selects each employee's username, password and designation. Designation maps
to the existing canonical company/branch access-role assignment; it cannot grant
privileges beyond the operator's authority. Department remains a separate field.

The selected password is the employee's login password, with the existing minimum
12 characters. There is no temporary-password generation or compulsory first-login
change. Resetting passwords still revokes existing sessions; role/designation changes
and deactivation also invalidate access. Better Auth continues hashing credentials;
public signup/raw Admin endpoints, browser persistence and plaintext DB passwords
remain forbidden. Optional authenticated own-password changes remain available.

Reviewed migration 0021 changes the profile default to false and retires existing
pending first-login flags under the shared privileged-mutation lock. Each affected
company/user receives an immutable policy audit entry. It does not alter password
hashes, identity, roles, permissions, active status, customer records or workflow
stages. Apply it only through `npm run db:migrate` with the rest of the ledger.

The local test harness requires an explicitly supplied account password in its
ignored setup file and generates only its session secret. Existing accounts and
passwords persist; rerunning bootstrap never resets a user's password.

Acceptance covers direct create/reset login, forbidden employee provisioning,
designation-based access, session revocation, legacy-flag migration with unchanged
credential hashes, all CRM regressions and desktop/mobile theme/layout checks.

Verification: 45 unit, 54 isolated database, 10 public browser and 16 authenticated
desktop/mobile checks pass, plus lint, strict TypeScript and production build.
Final employee/dashboard browser checks were repeated after visual refinements.
SQL artifacts preserve original applied bytes across Git checkouts; historical
newline-only normalization was corrected without changing SQL or ledger history.
