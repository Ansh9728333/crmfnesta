import { headers } from "next/headers";
import { requireAccess } from "@/lib/auth/server";
import { adminOrganizations } from "@/lib/auth/access";
import { getOrderService } from "@/lib/orders";
import { WorkflowConfiguration } from "@/features/orders/configuration";
export const metadata = { title: "Post-sales configuration" };
export default async function Page() {
  const access = await requireAccess();
  if (!adminOrganizations(access).length)
    return (
      <section>
        <h1 className="text-2xl font-semibold">Administrator access required</h1>
        <p className="mt-3 text-sm">Stage policies are managed by organization administrators.</p>
      </section>
    );
  const initial = await getOrderService().configuration(await headers());
  return <WorkflowConfiguration initial={JSON.parse(JSON.stringify(initial))} />;
}
