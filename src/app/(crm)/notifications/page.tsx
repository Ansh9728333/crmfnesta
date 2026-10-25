import { headers } from "next/headers";
import { getNotificationService } from "@/lib/management";
import { NotificationCenter } from "@/features/management/notifications";
import { requireAccess } from "@/lib/auth/server";
export const metadata = { title: "Notifications" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAccess();
  const q = await searchParams,
    d = await getNotificationService().list(await headers(), q);
  return <NotificationCenter data={JSON.parse(JSON.stringify(d))} unread={q.unread ?? ""} />;
}
