import { AppShell } from "@/components/layout/app-shell";
import { requireAccess } from "@/lib/auth/server";
import { accessiblePermissions } from "@/lib/auth/access";
export const dynamic = "force-dynamic";

export default async function CrmLayout({ children }: { children: React.ReactNode }) {
  const access = await requireAccess();
  return (
    <AppShell
      employee={{
        name: access.user.name,
        roles: [...new Set(access.assignments.map((a) => a.role))],
        permissions: accessiblePermissions(access),
        canManageEmployees: access.assignments.some((a) =>
          ["Admin", "Super Admin"].includes(a.role),
        ),
      }}
    >
      {children}
    </AppShell>
  );
}
