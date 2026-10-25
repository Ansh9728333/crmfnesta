import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from ".";
import { getDb } from "../db";
import { AccessError, resolveAccess } from "./access";
export async function requireAccess(allowPasswordChange = false) {
  try {
    return await resolveAccess(getDb(), getAuth(), await headers(), allowPasswordChange);
  } catch (error) {
    if (error instanceof AccessError && error.status === 428) redirect("/change-password");
    if (error instanceof AccessError && error.status === 403) redirect("/login?disabled=1");
    redirect("/login");
  }
}
