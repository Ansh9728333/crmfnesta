import { PresalesModulePage } from "@/features/presales/module-page";
export const metadata = { title: "Quotations" };
export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  return <PresalesModulePage kind="quotations" searchParams={searchParams} />;
}
