"use client";

import { useState } from "react";
import { Plus, Search, ShieldCheck, Users, X } from "lucide-react";
import type { employeeService } from "@/lib/employees/service";
import { roles, permissions, type Role, type Permission } from "@/lib/auth/roles";
import type { EmployeeInput } from "@/lib/auth/validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";

type Directory = Awaited<ReturnType<ReturnType<typeof employeeService>["list"]>>;
type Employee = Directory["employees"][number];
type Action = "activate" | "deactivate" | "reset-password" | "revoke-sessions";
const selectStyle = "h-10 w-full rounded-md border bg-white px-3 text-xs";

export function EmployeeManager({
  initial,
  openPermissions = false,
}: {
  initial: Directory;
  openPermissions?: boolean;
}) {
  const [data, setData] = useState(initial);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [role, setRole] = useState("all");
  const [centre, setCentre] = useState("all");
  const [editing, setEditing] = useState<Employee | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirm, setConfirm] = useState<{ employee: Employee; action: Action } | null>(null);
  const [managingPermissions, setManagingPermissions] = useState(openPermissions);
  const [creatingCentre, setCreatingCentre] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const filtered = data.employees.filter(
    (e) =>
      `${e.name} ${e.username} ${e.code}`.toLowerCase().includes(search.toLowerCase()) &&
      (status === "all" || e.active === (status === "active")) &&
      (role === "all" || e.assignments.some((a) => a.role === role)) &&
      (centre === "all" || e.assignments.some((a) => a.centreId === centre)),
  );

  async function refresh() {
    const response = await fetch("/api/admin/employees", { cache: "no-store" });
    if (!response.ok)
      throw new Error("Saved, but the employee list could not refresh. Reload the page.");
    setData(await response.json());
  }
  async function mutate(url: string, method: string, body: unknown) {
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "The operation could not be completed");
    await refresh();
  }
  const orgName = (id: string) =>
    data.organizations.find((o) => o.id === id)?.name ?? "Organization";
  const centreName = (id: string) => data.centres.find((c) => c.id === id)?.name ?? "Branch";
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">
            PEOPLE & ACCESS
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">A team built to deliver.</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Manage employee accounts, branch assignments and workspace access.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setManagingPermissions(true)}>
            <ShieldCheck size={16} /> Permissions
          </Button>
          <Button
            onClick={() => {
              setNotice("");
              setCreating(true);
            }}
          >
            <Plus size={16} /> Create employee
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap gap-4 rounded-xl border bg-white p-5">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <Users size={17} className="text-primary" />
          {data.employees.length} employees
        </span>
        <span className="text-sm text-muted-foreground">
          {data.employees.filter((e) => e.active).length} active
        </span>
        <span className="text-sm text-muted-foreground">{data.centres.length} branches</span>
      </div>
      {notice && (
        <p role="status" className="rounded-lg border bg-accent p-4 text-xs text-primary">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <section className="overflow-hidden rounded-xl border bg-white">
        <div className="grid gap-3 border-b p-4 sm:grid-cols-2 xl:grid-cols-[2fr_1fr_1fr_1fr]">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-3 text-muted-foreground" />
            <Input
              aria-label="Search employees"
              placeholder="Search name, username or code"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            aria-label="Filter by designation"
            className={selectStyle}
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="all">All designations</option>
            {roles.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
          <select
            aria-label="Filter by branch"
            className={selectStyle}
            value={centre}
            onChange={(e) => setCentre(e.target.value)}
          >
            <option value="all">All branches</option>
            {data.centres.map((c) => (
              <option key={c.id} value={c.id}>
                {orgName(c.organizationId)} · {c.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by status"
            className={selectStyle}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-left text-xs">
            <caption className="sr-only">Employees and access assignments</caption>
            <thead className="bg-background text-[10px] uppercase tracking-wide text-muted-foreground">
              <tr>
                {[
                  "Employee code",
                  "Name",
                  "Username",
                  "Designation",
                  "Centre / Branch",
                  "Status",
                  "Last login",
                  "Actions",
                ].map((t) => (
                  <th key={t} className="px-4 py-4 font-medium">
                    {t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr className="border-t" key={e.id}>
                  <td className="px-4 py-5 font-mono text-[10px]">{e.code}</td>
                  <td className="px-4 py-5">
                    <p className="font-semibold">{e.name}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">{e.department}</p>
                  </td>
                  <td className="px-4 py-5">{e.username}</td>
                  <td className="px-4 py-5">
                    <div className="space-y-1">
                      {[...new Set(e.assignments.map((a) => a.role))].map((r) => (
                        <p key={r}>{r}</p>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-5">
                    <div className="space-y-1">
                      {e.assignments.map((a) => (
                        <p key={a.id} className="text-[10px]">
                          {orgName(a.organizationId)} · {centreName(a.centreId)}
                        </p>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-5">
                    <Badge variant={e.active ? "secondary" : "outline"}>
                      {e.active ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  <td className="px-4 py-5 text-[10px]">
                    {e.lastLoginAt
                      ? new Date(e.lastLoginAt).toLocaleString("en-IN", {
                          timeZone: "Asia/Kolkata",
                          dateStyle: "medium",
                          timeStyle: "short",
                        })
                      : "Never"}
                  </td>
                  <td className="px-4 py-5">
                    {e.id === data.currentUserId ? (
                      <span className="text-muted-foreground">Your account</span>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setNotice("");
                            setEditing(e);
                          }}
                        >
                          Edit / Change designation
                        </Button>
                        {(
                          [
                            "reset-password",
                            e.active ? "deactivate" : "activate",
                            "revoke-sessions",
                          ] as Action[]
                        ).map((a) => (
                          <Button
                            size="sm"
                            variant="ghost"
                            key={a}
                            onClick={() => {
                              setError("");
                              setConfirm({ employee: e, action: a });
                            }}
                          >
                            {a === "reset-password"
                              ? "Reset password"
                              : a === "revoke-sessions"
                                ? "Revoke sessions"
                                : e.active
                                  ? "Deactivate"
                                  : "Activate"}
                          </Button>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length && (
            <div className="p-12 text-center">
              <h2 className="text-base font-semibold">No employees match these filters</h2>
              <p className="mt-2 text-xs text-muted-foreground">
                Adjust your search or create an employee account.
              </p>
            </div>
          )}
        </div>
      </section>
      <div>
        <Button variant="outline" size="sm" onClick={() => setCreatingCentre(true)}>
          <Plus size={14} /> Add branch
        </Button>
      </div>
      <Dialog open={creatingCentre} onOpenChange={setCreatingCentre}>
        <DialogContent>
          <DialogTitle>Add branch</DialogTitle>
          <DialogDescription>
            Create a real branch in an organization you administer. It becomes available for
            employee assignments.
          </DialogDescription>
          <form
            className="space-y-4"
            onSubmit={async (event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              setBusy(true);
              setError("");
              try {
                await mutate("/api/admin/centres", "POST", {
                  organizationId: form.get("organizationId"),
                  name: form.get("name"),
                });
                setCreatingCentre(false);
                setNotice("Branch created.");
              } catch (e) {
                setError(e instanceof Error ? e.message : "Unable to create branch");
              } finally {
                setBusy(false);
              }
            }}
          >
            <label className="block text-xs">
              Organization
              <select className={`${selectStyle} mt-2`} name="organizationId" required>
                {data.organizations.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs">
              Branch name
              <Input className="mt-2" name="name" minLength={2} maxLength={100} required />
            </label>
            {error && (
              <p role="alert" className="text-xs text-destructive">
                {error}
              </p>
            )}
            <Button disabled={busy}>{busy ? "Creating…" : "Create branch"}</Button>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          <DialogTitle>Create employee</DialogTitle>
          <DialogDescription>
            Use a real, unique email. No invitation or password email is sent. Share the
            Admin-selected password through an approved private channel. The employee can sign in
            directly.
          </DialogDescription>
          {creating && (
            <EmployeeForm
              directory={data}
              onSave={async (body) => {
                await mutate("/api/admin/employees", "POST", body);
                setCreating(false);
                setNotice("Employee created with the Admin-selected password and designation.");
              }}
            />
          )}
        </DialogContent>
      </Dialog>
      <Sheet
        open={!!editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      >
        <SheetContent className="w-full overflow-y-auto p-6 sm:max-w-xl">
          <SheetTitle>Edit employee</SheetTitle>
          <SheetDescription>
            Assignment changes revoke existing sessions. The employee must sign in again.
          </SheetDescription>
          {editing && (
            <EmployeeForm
              key={editing.id}
              employee={editing}
              directory={data}
              onSave={async (body) => {
                await mutate(`/api/admin/employees/${editing.id}`, "PATCH", body);
                setEditing(null);
                setNotice("Employee updated and sessions revoked.");
              }}
            />
          )}
        </SheetContent>
      </Sheet>
      <AlertDialog
        open={!!confirm}
        onOpenChange={(open) => {
          if (!open && !busy) setConfirm(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogTitle>
            {confirm?.action === "reset-password"
              ? "Reset employee password?"
              : confirm?.action === "deactivate"
                ? "Deactivate employee?"
                : confirm?.action === "activate"
                  ? "Activate employee?"
                  : "Revoke employee sessions?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            This affects {confirm?.employee.name}. Active sessions will be revoked.
            {confirm?.action === "reset-password" &&
              " The employee can sign in directly with the password you set."}
          </AlertDialogDescription>
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              if (!confirm) return;
              setBusy(true);
              setError("");
              try {
                await mutate(`/api/admin/employees/${confirm.employee.id}`, "POST", {
                  action: confirm.action,
                  password: form.get("password") ?? undefined,
                });
                setConfirm(null);
                setNotice("Employee access updated.");
              } catch (e) {
                setError(e instanceof Error ? e.message : "Operation failed");
              } finally {
                setBusy(false);
              }
            }}
          >
            {confirm?.action === "reset-password" && (
              <div className="my-4">
                <label htmlFor="reset-password" className="text-xs font-medium">
                  New employee password
                </label>
                <Input
                  id="reset-password"
                  type="password"
                  name="password"
                  autoComplete="new-password"
                  minLength={12}
                  maxLength={128}
                  required
                />
              </div>
            )}
            {error && (
              <p className="my-3 text-xs text-destructive" role="alert">
                {error}
              </p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
              <Button disabled={busy}>{busy ? "Updating…" : "Confirm"}</Button>
            </div>
          </form>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog open={managingPermissions} onOpenChange={setManagingPermissions}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
          <DialogTitle>Role permissions</DialogTitle>
          <DialogDescription>
            Changes apply immediately to every employee with this role in the selected organization.
            Administrative permissions are reserved for Admin roles.
          </DialogDescription>
          <PermissionForm
            directory={data}
            onSave={async (body) => {
              await mutate("/api/admin/permissions", "PUT", body);
              setManagingPermissions(false);
              setNotice("Role permissions updated.");
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EmployeeForm({
  directory,
  employee,
  onSave,
}: {
  directory: Directory;
  employee?: Employee;
  onSave: (body: EmployeeInput & { password?: string }) => Promise<void>;
}) {
  const [assignments, setAssignments] = useState<EmployeeInput["assignments"]>(
    employee?.assignments.map(({ organizationId, centreId, role }) => ({
      organizationId,
      centreId,
      role,
    })) ?? [
      {
        organizationId: directory.organizations[0]?.id ?? "",
        centreId:
          directory.centres.find(
            (c) => c.organizationId === directory.organizations[0]?.id && c.active,
          )?.id ?? "",
        role: "Sales Executive",
      },
    ],
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<(EmployeeInput & { password?: string }) | null>(null);
  return (
    <>
      <form
        className="mt-6 space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          setDraft({
            name: String(form.get("name")),
            username: String(form.get("username")),
            email: String(form.get("email")),
            mobile: String(form.get("mobile")),
            department: String(form.get("department")),
            active: form.get("active") === "active",
            assignments,
            ...(!employee ? { password: String(form.get("password")) } : {}),
          });
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            { name: "name", label: "Employee name", type: "text", value: employee?.name },
            { name: "username", label: "Username", type: "text", value: employee?.username ?? "" },
            { name: "email", label: "Email", type: "email", value: employee?.email },
            { name: "mobile", label: "Mobile number", type: "tel", value: employee?.mobile },
            { name: "department", label: "Department", type: "text", value: employee?.department },
          ].map((f) => (
            <div key={f.name}>
              <label className="text-xs font-medium" htmlFor={`employee-${f.name}`}>
                {f.label}
              </label>
              <Input
                className="mt-2"
                id={`employee-${f.name}`}
                name={f.name}
                type={f.type}
                required
                defaultValue={f.value}
                maxLength={f.name === "username" ? 40 : 100}
                autoComplete="off"
              />
            </div>
          ))}
          <div>
            <label htmlFor="employee-status" className="text-xs font-medium">
              Account status
            </label>
            <select
              id="employee-status"
              name="active"
              className={`${selectStyle} mt-2`}
              defaultValue={employee?.active === false ? "inactive" : "active"}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          {!employee && (
            <div className="sm:col-span-2">
              <label htmlFor="initial-password" className="text-xs font-medium">
                Employee password · at least 12 characters
              </label>
              <Input
                id="initial-password"
                name="password"
                className="mt-2"
                type="password"
                minLength={12}
                maxLength={128}
                required
                autoComplete="new-password"
              />
            </div>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground">
          Employee code{" "}
          {employee ? employee.code : "is generated securely when the account is created"}.
        </p>
        <fieldset className="space-y-3">
          <legend className="mb-3 text-xs font-semibold">
            Organization, branch & designation assignments
          </legend>
          {assignments.map((a, i) => (
            <div className="grid gap-2 rounded-lg border bg-background p-3" key={i}>
              <select
                aria-label={`Organization ${i + 1}`}
                className={selectStyle}
                value={a.organizationId}
                onChange={(e) =>
                  setAssignments((prev) =>
                    prev.map((v, j) =>
                      j === i
                        ? {
                            ...v,
                            organizationId: e.target.value,
                            centreId:
                              directory.centres.find(
                                (c) => c.organizationId === e.target.value && c.active,
                              )?.id ?? "",
                          }
                        : v,
                    ),
                  )
                }
              >
                {directory.organizations.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <select
                  aria-label={`Branch ${i + 1}`}
                  required
                  className={selectStyle}
                  value={a.centreId}
                  onChange={(e) =>
                    setAssignments((prev) =>
                      prev.map((v, j) => (j === i ? { ...v, centreId: e.target.value } : v)),
                    )
                  }
                >
                  <option value="" disabled>
                    Select branch
                  </option>
                  {directory.centres
                    .filter((c) => c.organizationId === a.organizationId && c.active)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
                <select
                  aria-label={`Designation ${i + 1}`}
                  className={selectStyle}
                  value={a.role}
                  onChange={(e) =>
                    setAssignments((prev) =>
                      prev.map((v, j) => (j === i ? { ...v, role: e.target.value as Role } : v)),
                    )
                  }
                >
                  {roles
                    .filter((r) => directory.isSuperAdmin || !["Admin", "Super Admin"].includes(r))
                    .map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                </select>
                {assignments.length > 1 && (
                  <Button
                    aria-label={`Remove assignment ${i + 1}`}
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setAssignments((prev) => prev.filter((_, j) => i !== j))}
                  >
                    <X size={15} />
                  </Button>
                )}
              </div>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={assignments.length >= 20}
            onClick={() =>
              setAssignments((prev) => [...prev, { ...prev[0], role: "Sales Executive" }])
            }
          >
            <Plus size={14} /> Add assignment
          </Button>
        </fieldset>
        <Button type="submit" className="w-full">
          Review {employee ? "changes" : "new employee"}
        </Button>
      </form>
      <AlertDialog
        open={!!draft}
        onOpenChange={(open) => {
          if (!open && !pending) {
            setDraft(null);
            setError("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogTitle>
            {employee ? "Save employee changes?" : "Create this employee?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {draft?.name} will have {draft?.assignments.length} branch and designation assignments.{" "}
            {employee
              ? "Existing sessions will be revoked."
              : "They can sign in directly with the password you selected."}
          </AlertDialogDescription>
          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <Button
              disabled={pending}
              onClick={async () => {
                if (!draft) return;
                setPending(true);
                setError("");
                try {
                  await onSave(draft);
                  setDraft(null);
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Unable to save employee");
                } finally {
                  setPending(false);
                }
              }}
            >
              {pending ? "Saving…" : "Confirm"}
            </Button>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function PermissionForm({
  directory,
  onSave,
}: {
  directory: Directory;
  onSave: (body: unknown) => Promise<void>;
}) {
  const [org, setOrg] = useState(directory.organizations[0]?.id ?? "");
  const [role, setRole] = useState<Role>("Sales Executive");
  const grants = (organizationId: string, selectedRole: Role) =>
    directory.permissions
      .filter((p) => p.organizationId === organizationId && p.role === selectedRole)
      .map((p) => p.permission as Permission)
      .filter((permission) => permissions.includes(permission));
  const [selected, setSelected] = useState<Permission[]>(grants(org, role));
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="space-y-4">
      <select
        aria-label="Permission organization"
        className={selectStyle}
        value={org}
        onChange={(e) => {
          setOrg(e.target.value);
          setSelected(grants(e.target.value, role));
        }}
      >
        {directory.organizations.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
      <select
        aria-label="Permission role"
        className={selectStyle}
        value={role}
        onChange={(e) => {
          setRole(e.target.value as Role);
          setSelected(grants(org, e.target.value as Role));
        }}
      >
        {roles
          .filter((r) => !["Admin", "Super Admin"].includes(r))
          .map((r) => (
            <option key={r}>{r}</option>
          ))}
      </select>
      <div className="grid gap-3 sm:grid-cols-2">
        {permissions
          .filter((p) => !["employees.manage", "permissions.manage", "settings.manage"].includes(p))
          .map((p) => (
            <label key={p} className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                className="accent-primary"
                checked={selected.includes(p)}
                onChange={(e) =>
                  setSelected((prev) =>
                    e.target.checked ? [...prev, p] : prev.filter((v) => v !== p),
                  )
                }
              />
              {p}
            </label>
          ))}
      </div>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      <Button onClick={() => setConfirming(true)}>Review permissions</Button>
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogTitle>Update this role’s permissions?</AlertDialogTitle>
          <AlertDialogDescription>
            Every employee assigned {role} in this organization is affected immediately.
          </AlertDialogDescription>
          <div className="flex justify-end gap-2">
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <Button
              disabled={pending}
              onClick={async () => {
                setPending(true);
                try {
                  await onSave({ organizationId: org, role, permissions: selected });
                  setConfirming(false);
                } catch (e) {
                  setConfirming(false);
                  setError(e instanceof Error ? e.message : "Unable to update permissions");
                } finally {
                  setPending(false);
                }
              }}
            >
              Confirm
            </Button>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
