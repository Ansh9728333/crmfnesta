import { requireAccess } from "@/lib/auth/server";
import { ChangePasswordForm } from "@/features/auth/change-password-form";
export const dynamic = "force-dynamic";
export const metadata = { title: "Change password" };
export default async function ChangePasswordPage() {
  await requireAccess(true);
  return <ChangePasswordForm />;
}
