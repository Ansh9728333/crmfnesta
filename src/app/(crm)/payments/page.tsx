import { CommercePage } from "@/features/commerce/page";
export const metadata = { title: "Payment management" };
export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  return <CommercePage searchParams={searchParams} mode="payments" />;
}
