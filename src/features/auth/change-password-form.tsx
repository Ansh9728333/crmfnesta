"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LogoutButton } from "./logout-button";
export function ChangePasswordForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <section className="w-full max-w-md rounded-2xl border bg-white p-8">
        <p className="text-xs font-semibold text-primary">SITEFLOW CRM · ACCOUNT SECURITY</p>
        <h1 className="mt-4 text-2xl font-semibold">Change your password</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          You can update your password here. Use at least 12 characters.
        </p>
        <form
          className="my-7 space-y-5"
          onSubmit={async (event) => {
            event.preventDefault();
            setError("");
            const form = new FormData(event.currentTarget);
            if (form.get("newPassword") !== form.get("confirmPassword")) {
              setError("New passwords must match");
              return;
            }
            setPending(true);
            try {
              const response = await fetch("/api/account/password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  currentPassword: form.get("currentPassword"),
                  newPassword: form.get("newPassword"),
                }),
              });
              const data = await response.json();
              if (!response.ok) setError(data.error ?? "Password change failed");
              else {
                router.replace("/");
                router.refresh();
              }
            } catch {
              setError("Service unavailable. Please try again.");
            } finally {
              setPending(false);
            }
          }}
        >
          {[
            ["currentPassword", "Current password", "current-password"],
            ["newPassword", "New password", "new-password"],
            ["confirmPassword", "Confirm new password", "new-password"],
          ].map(([name, label, autoComplete]) => (
            <div key={name}>
              <label htmlFor={name} className="text-xs font-medium">
                {label}
              </label>
              <Input
                className="mt-2"
                id={name}
                name={name}
                type="password"
                autoComplete={autoComplete}
                required
                minLength={name === "currentPassword" ? 1 : 12}
                maxLength={128}
              />
            </div>
          ))}
          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
          <Button className="w-full" disabled={pending}>
            {pending ? "Saving…" : "Change password"}
          </Button>
        </form>
        <LogoutButton />
      </section>
    </main>
  );
}
