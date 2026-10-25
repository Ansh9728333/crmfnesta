import Link from "next/link";
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-5 p-8 text-center">
      <p className="text-xs font-semibold text-primary">SITEFLOW CRM · 404</p>
      <h1 className="text-3xl font-semibold">This page isn’t on the map.</h1>
      <p className="text-sm text-muted-foreground">
        Return to your workspace to find your next step.
      </p>
      <Link href="/" className="rounded-lg bg-primary px-5 py-3 text-sm text-white">
        Back to overview
      </Link>
    </main>
  );
}
