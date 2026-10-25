import { headers } from "next/headers";
import { requireAccess } from "@/lib/auth/server";
import { adminOrganizations } from "@/lib/auth/access";
import { getEmployeeService } from "@/lib/employees";
import { EmployeeManager } from "@/features/employees/employee-manager";
export const metadata = { title: "Employees" };
export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ panel?: string }>;
}) {
  const access = await requireAccess();
  if (!adminOrganizations(access).length)
    return (
      <section>
        <h1 className="text-2xl font-semibold">Access restricted</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Employee management is available to administrators only.
        </p>
      </section>
    );
  const directory = await getEmployeeService().list(await headers());
  return (
    <EmployeeManager
      openPermissions={(await searchParams).panel === "permissions"}
      initial={JSON.parse(JSON.stringify(directory))}
    />
  );
}
