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
  Search,
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
    <Link
      href="/"
      className="flex h-[76px] items-center gap-3 border-b border-white/10 bg-[#20242d] px-5 text-white"
      aria-label="SiteFlow CRM home"
    >
      <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-white">
        <Sprout size={24} />
      </span>
      <span className="text-xl font-bold tracking-tight">
        SiteFlow
        <span className="mt-0.5 block text-[9px] font-medium tracking-[0.2em] text-slate-400">
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
          "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors",
          active
            ? "bg-primary text-white shadow-sm"
            : "text-slate-300 hover:bg-white/10 hover:text-white",
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
    <nav aria-label="Main navigation" className="space-y-6 px-3 pt-5">
      <div className="space-y-1">
        {item("/", "Dashboard", LayoutDashboard)}
        {employee.canManageEmployees && item("/admin/employees", "Employees", Users)}
      </div>
      {["Workspace", "Operations", "Insights"].map((group) => (
        <div key={group}>
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-rose-300">
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
  const initials = employee.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const title =
    path === "/notifications"
      ? "Notifications"
      : path.startsWith("/admin/employees")
        ? "Employees"
        : (modules.find((m) => path === `/${m.slug}` || path.startsWith(`/${m.slug}/`))?.title ??
          "Dashboard");
  return (
    <div className="min-h-screen">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-white focus:p-4"
      >
        Skip to content
      </a>
      <aside className="crm-sidebar fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-white/10 lg:flex">
        <Brand />
        <div className="flex-1 overflow-y-auto pb-5">
          <Navigation employee={employee} />
        </div>
        <div className="m-4 rounded-xl border border-white/10 bg-white/5 p-3">
          <span className="flex items-center gap-2 text-xs font-semibold">
            <CircleHelp size={16} /> Your connected workspace
          </span>
          {employee.canManageEmployees && (
            <Link
              href="/settings"
              className="mt-3 flex items-center gap-2 text-xs font-semibold text-rose-300 hover:text-white"
            >
              Workspace setup <ArrowUpRight size={14} />
            </Link>
          )}
        </div>
        <div className="flex items-center gap-3 border-t border-white/10 p-5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#285de5] text-xs font-bold text-white">
            {initials}
          </span>
          <div>
            <p className="text-xs font-semibold">{employee.name}</p>
            <p className="mt-1 text-[10px] text-slate-400">{employee.roles.join(", ")}</p>
          </div>
        </div>
      </aside>
      <div className="lg:pl-60">
        <header className="crm-topbar flex h-[76px] items-center justify-between gap-4 border-b border-white/10 px-5 sm:px-8 lg:px-10">
          <div className="flex items-center gap-3">
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/10 hover:text-white lg:hidden"
                  aria-label="Open navigation"
                >
                  <Menu size={20} />
                </Button>
              </SheetTrigger>
              <SheetContent
                aria-describedby={undefined}
                side="left"
                className="crm-sidebar w-72 overflow-y-auto border-white/10 p-0 [&>button]:text-white"
              >
                <SheetTitle className="sr-only">Navigation</SheetTitle>
                <Brand />
                <Navigation mobile employee={employee} />
              </SheetContent>
            </Sheet>
            <span className="hidden text-xs text-slate-400 sm:inline">Workspace</span>
            <ChevronRight className="hidden text-slate-400 sm:block" size={13} />
            <span className="text-xs font-medium">{title}</span>
          </div>
          {employee.permissions.includes("leads.read") && (
            <form
              action="/leads"
              role="search"
              aria-label="Global lead search"
              className="hidden w-full max-w-sm items-center rounded-full bg-white pl-4 text-foreground focus-within:ring-2 focus-within:ring-amber-300 md:flex"
            >
              <input
                aria-label="Search all leads"
                name="q"
                type="search"
                placeholder="Search leads, names or mobile…"
                maxLength={200}
                className="h-9 min-w-0 flex-1 rounded-full bg-transparent text-xs outline-none"
              />
              <button
                type="submit"
                aria-label="Submit global lead search"
                className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-primary"
              >
                <Search size={17} />
              </button>
            </form>
          )}
          <div className="flex items-center gap-3">
            <span className="hidden max-w-40 truncate rounded-full border border-white/15 px-3 py-1.5 text-[10px] font-medium text-slate-300 2xl:block">
              {employee.name}
            </span>
            <NotificationBell className="text-slate-200 hover:bg-white/10 hover:text-white" />
            <LogoutButton className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white" />
            <span
              className="hidden size-8 shrink-0 items-center justify-center rounded-full bg-[#285de5] text-[10px] font-semibold text-white sm:flex"
              aria-label="SiteFlow workspace"
            >
              {initials}
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
