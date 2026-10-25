"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole, Sprout } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
export function LoginForm() {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const router = useRouter();
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-[#20242d] p-14 text-white lg:flex">
        <div className="flex items-center gap-3 text-2xl font-semibold">
          <Sprout size={34} /> SiteFlow CRM
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-white/60">
            ONE CONNECTED WORKSPACE
          </p>
          <h1 className="mt-6 max-w-lg text-5xl font-medium leading-tight">
            Good relationships.
            <br />
            Thoughtfully managed.
          </h1>
          <p className="mt-6 max-w-md text-sm leading-7 text-white/70">
            From the first enquiry to the final handover, give every customer a considered
            experience.
          </p>
        </div>
        <p className="text-xs text-white/60">Finesta Home / IBAX / S-Grip</p>
      </section>
      <section className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <span className="mb-7 inline-flex rounded-xl bg-accent p-3 text-primary">
            <LockKeyhole size={25} />
          </span>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary lg:hidden">
            SiteFlow CRM
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight">Welcome back.</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Sign in with the account provided by your administrator.
          </p>
          <form
            className="mt-8 space-y-5"
            onSubmit={async (event) => {
              event.preventDefault();
              setPending(true);
              setError("");
              const values = new FormData(event.currentTarget);
              try {
                const response = await fetch("/api/auth/sign-in/username", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    username: values.get("username"),
                    password: values.get("password"),
                  }),
                });
                const body = await response.json();
                if (!response.ok) setError(body.message ?? "Invalid username or password");
                else {
                  router.replace("/");
                  router.refresh();
                }
              } catch {
                setError("Sign-in service unavailable. Please try again.");
              } finally {
                setPending(false);
              }
            }}
          >
            <div>
              <label htmlFor="username" className="text-xs font-medium">
                Username
              </label>
              <Input
                className="mt-2 bg-white"
                id="username"
                name="username"
                autoComplete="username"
                required
                maxLength={40}
                autoCapitalize="none"
                spellCheck={false}
              />
            </div>
            <div>
              <label htmlFor="password" className="text-xs font-medium">
                Password
              </label>
              <Input
                className="mt-2 bg-white"
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                maxLength={128}
              />
            </div>
            {error && (
              <p
                role="alert"
                className="rounded-lg border border-destructive/20 bg-white p-3 text-xs leading-5 text-destructive"
              >
                {error}
              </p>
            )}
            <Button className="w-full" type="submit" disabled={pending}>
              {pending ? "Signing in…" : "Sign in"}
            </Button>
          </form>
          <p className="mt-7 text-xs leading-6 text-muted-foreground">
            Need access or a password reset? Contact your administrator. Employee accounts are
            created internally.
          </p>
        </div>
      </section>
    </div>
  );
}
