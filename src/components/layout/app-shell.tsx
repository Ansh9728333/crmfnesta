"use client";
import { NotificationBell } from "@/features/management/notifications";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowUpRight,
  CalendarDays,
  ChartNoAxesCombined,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  FileStack,
  FileText,
  HardHat,
  Layers3,
  LayoutDashboard,
  Menu,
  Settings2,
  Sprout,
  Truck,
  Users,
} from "lucide-react";
import { modules } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTitle, SheetTrigger, SheetClose } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { LogoutButton } from "@/features/auth/logout-button";
import { modulePermission, type Permission } from "@/lib/auth/roles";

type Employee = {
  name: string;
  roles: string[];
  permissions: Permission[];
  canManageEmployees: boolean;
};

const icons = {
  leads: Users,
  customers: ClipboardList,
  projects: Layers3,
  appointments: CalendarDays,
  quotations: FileText,
  orders: Layers3,
  production: Truck,
  payments: FileText,
  dispatch: Truck,
  installations: HardHat,
  service: HardHat,
  documents: FileStack,
  reports: ChartNoAxesCombined,
  settings: Settings2,
};

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-3 px-3 py-7" aria-label="SiteFlow CRM home">
      <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-white">
        <Sprout size={24} />
      </span>
      <span className="text-xl font-bold tracking-tight">
        SiteFlow
        <span className="mt-0.5 block text-[10px] font-medium tracking-[0.25em] text-muted-foreground">
          CUSTOMER RELATIONSHIPS
        </span>
      </span>
    </Link>
  );
}

function Navigation({ mobile = false, employee }: { mobile?: boolean; employee: Employee }) {
  const path = usePathname();
  const item = (href: string, title: string, Icon: typeof Users) => {
    const active = path === href || (href !== "/" && path.startsWith(`${href}/`));
    const link = (
      <Link
        href={href}
        prefetch={false}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors hover:bg-accent",
          active ? "bg-primary text-white hover:bg-primary" : "text-muted-foreground",
        )}
      >
        <Icon size={18} strokeWidth={1.7} />
        {title}
        {active && <ChevronRight size={14} className="ml-auto opacity-60" />}
      </Link>
    );
    return mobile ? (
      <SheetClose asChild key={href}>
        {link}
      </SheetClose>
    ) : (
      <div key={href}>{link}</div>
    );
  };
  return (
    <nav aria-label="Main navigation" className="space-y-6 px-3">
      {employee.canManageEmployees && item("/admin/employees", "Employees", Users)}
      {item("/", "Overview", LayoutDashboard)}
      {["Workspace", "Operations", "Insights"].map((group) => (
        <div key={group}>
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {group}
          </p>
          <div className="space-y-1">
            {modules
              .filter(
                (m) =>
                  m.group === group &&
                  (employee.permissions.includes(modulePermission[m.slug]) ||
                    (m.slug === "installations" &&
                      (employee.permissions.includes("orders.manage") ||
                        employee.permissions.includes("audits.manage")))),
              )
              .map((m) => item(`/${m.slug}`, m.title, icons[m.slug]))}
          </div>
        </div>
      ))}
    </nav>
  );
}

export function AppShell({
  children,
  employee,
}: {
  children: React.ReactNode;
  employee: Employee;
}) {
  const path = usePathname();
  const title =
    path === "/notifications"
      ? "Notifications"
      : path.startsWith("/admin/employees")
        ? "Employees"
        : (modules.find((m) => path === `/${m.slug}` || path.startsWith(`/${m.slug}/`))?.title ??
          "Overview");
  return (
    <div className="min-h-screen">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-white focus:p-4"
      >
        Skip to content
      </a>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r bg-white lg:flex">
        <Brand />
        <div className="flex-1 overflow-y-auto pb-5">
          <Navigation employee={employee} />
        </div>
        <div className="m-4 rounded-xl border bg-background p-4">
          <span className="flex items-center gap-2 text-xs font-semibold">
            <CircleHelp size={16} /> Built for your next chapter
          </span>
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            Three brands. One connected customer journey.
          </p>
          <Link
            href="/settings"
            className="mt-3 flex items-center gap-2 text-xs font-semibold text-primary"
          >
            Workspace setup <ArrowUpRight size={14} />
          </Link>
        </div>
        <div className="flex items-center gap-3 border-t p-5">
          <span className="flex size-9 items-center justify-center rounded-full bg-accent text-xs font-bold text-primary">
            SF
          </span>
          <div>
            <p className="text-xs font-semibold">{employee.name}</p>
            <p className="mt-1 text-[10px] text-muted-foreground">{employee.roles.join(", ")}</p>
          </div>
        </div>
      </aside>
      <div className="lg:pl-60">
        <header className="flex h-[76px] items-center justify-between border-b bg-white/90 px-5 sm:px-8 lg:px-10">
          <div className="flex items-center gap-3">
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden"
                  aria-label="Open navigation"
                >
                  <Menu size={20} />
                </Button>
              </SheetTrigger>
              <SheetContent
                aria-describedby={undefined}
                side="left"
                className="w-72 overflow-y-auto p-0"
              >
                <SheetTitle className="sr-only">Navigation</SheetTitle>
                <Brand />
                <Navigation mobile employee={employee} />
              </SheetContent>
            </Sheet>
            <span className="hidden text-xs text-muted-foreground sm:inline">Workspace</span>
            <ChevronRight className="hidden text-muted-foreground sm:block" size={13} />
            <span className="text-xs font-medium">{title}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden rounded-full border px-3 py-1.5 text-[10px] font-medium text-muted-foreground sm:block">
              {employee.name}
            </span>
            <NotificationBell />
            <LogoutButton />
            <span
              className="flex size-8 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-white"
              aria-label="SiteFlow workspace"
            >
              SF
            </span>
          </div>
        </header>
        <main
          id="main-content"
          className="mx-auto max-w-[1600px] px-5 py-7 sm:px-8 lg:px-10 lg:py-9"
        >
          {children}
        </main>
        <footer className="mx-5 flex flex-wrap justify-between gap-2 border-t py-5 text-[10px] text-muted-foreground sm:mx-8 lg:mx-10">
          <span>SiteFlow CRM · Designed around your customer</span>
          <span>Finesta Home / IBAX / S-Grip</span>
        </footer>
      </div>
    </div>
  );
}
