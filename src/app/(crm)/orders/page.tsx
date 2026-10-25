import { headers } from "next/headers";
import Link from "next/link";
import { requireAccess } from "@/lib/auth/server";
import { eligibleAssignments } from "@/lib/leads/access";
import { getOrderService } from "@/lib/orders";
import { orderFiltersSchema } from "@/lib/orders/validation";
import { OrderDashboard } from "@/features/orders/dashboard";
export const metadata = { title: "Order management" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const access = await requireAccess();
  if (!eligibleAssignments(access, "orders.read").length)
    return (
      <section>
        <h1 className="text-2xl font-semibold">Access restricted</h1>
        <p className="mt-3 text-sm">Your role does not include order management.</p>
      </section>
    );
  const parsed = orderFiltersSchema.safeParse(await searchParams);
  if (!parsed.success)
    return (
      <p>
        Invalid order filters.{" "}
        <Link href="/orders" className="underline">
          Clear filters
        </Link>
      </p>
    );
  const result = await getOrderService().list(await headers(), parsed.data);
  return <OrderDashboard result={JSON.parse(JSON.stringify(result))} filters={parsed.data} />;
}
