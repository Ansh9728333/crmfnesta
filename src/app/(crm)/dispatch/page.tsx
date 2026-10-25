import { CommercePage } from "@/features/commerce/page";
export const metadata = { title: "Dispatch and delivery" };
export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  return <CommercePage searchParams={searchParams} mode="dispatch" />;
}
