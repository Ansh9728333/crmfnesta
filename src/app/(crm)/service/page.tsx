import { AftercarePage } from "@/features/aftercare/page";
export const metadata = { title: "Customer service" };
export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  return <AftercarePage searchParams={searchParams} mode="service" />;
}
