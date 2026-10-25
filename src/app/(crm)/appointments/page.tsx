import { PresalesModulePage } from "@/features/presales/module-page";
export const metadata = { title: "Appointments & site visits" };
export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  return <PresalesModulePage kind="appointments" searchParams={searchParams} />;
}
