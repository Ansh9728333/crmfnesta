import { AftercarePage } from "@/features/aftercare/page";
export const metadata = { title: "Installation, audit & handover" };
export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  return <AftercarePage searchParams={searchParams} mode="installations" />;
}
