import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import ExcelJS from "exceljs";
import { browserFinance } from "../support/browser-credentials";
test("manages settings, filters real KPIs, exports reports and reads scoped notifications", async ({
  page,
  context,
}, info) => {
  await page.setExtraHTTPHeaders({
    "x-vercel-forwarded-for": info.project.name === "desktop" ? "192.0.2.130" : "192.0.2.131",
  });
  await page.goto("/login");
  await page.getByLabel("Username", { exact: true }).fill(browserFinance.username);
  await page.getByLabel("Password", { exact: true }).fill(browserFinance.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL("http://127.0.0.1:3100/");
  await expect(
    page.getByRole("heading", { name: "Management dashboard", exact: true }),
  ).toBeVisible();
  const response = await context.request.get("/api/leads?mode=directory"),
    directory = await response.json(),
    company = directory.organizations.find((o: { slug: string }) => o.slug === "ibax"),
    zone = `Management Zone ${info.project.name}`;
  await page.goto(`/settings?kind=territory&organizationId=${company.id}`);
  await expect(page.getByRole("heading", { name: "Admin Panel", exact: true })).toBeVisible();
  const form = page
    .locator("form")
    .filter({ has: page.getByRole("heading", { name: "Add Territories", exact: true }) });
  await form.getByRole("combobox", { name: "Company", exact: true }).selectOption(company.id);
  await form.getByLabel("Setting name", { exact: true }).fill(zone);
  await form
    .getByLabel("Description", { exact: true })
    .fill("Managed through the real Admin Panel");
  await form.getByLabel("Change reason", { exact: true }).fill("Define the sales territory");
  await form.getByRole("button", { name: "Save setting", exact: true }).click();
  const card = page
    .locator("article")
    .filter({ has: page.getByRole("heading", { name: zone, exact: true }) });
  await expect(card).toBeVisible();
  await page.reload();
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Edit setting", exact: true }).click();
  const edit = page
    .locator("form")
    .filter({ has: page.getByRole("heading", { name: `Edit ${zone}`, exact: true }) });
  await edit.getByLabel("Description", { exact: true }).fill("Updated territory description");
  await edit.getByLabel("Change reason", { exact: true }).fill("Territory review complete");
  await edit.getByRole("button", { name: "Save setting", exact: true }).click();
  await expect(card.getByText("Updated territory description", { exact: true })).toBeVisible();
  const create = await context.request.post("/api/leads", {
    headers: { origin: "http://127.0.0.1:3100" },
    data: {
      organizationId: company.id,
      centreId: directory.centres.find(
        (c: { organizationId: string }) => c.organizationId === company.id,
      ).id,
      assignedTo: directory.currentUserId,
      clientName: `Management customer ${info.project.name}`,
      mobile: info.project.name === "desktop" ? "9876790101" : "9876790102",
      projectName: `Management site ${info.project.name}`,
      siteAddress: `Management test site ${info.project.name}`,
      financialYear: "2026-27",
      territory: zone,
      expectedValue: "123.45",
      nextFollowUp: "2020-01-01T10:00:00+05:30",
      nextAction: "Call the customer",
    },
  });
  expect(create.ok()).toBe(true);
  await page.goto(
    `/?organizationId=${company.id}&territory=${encodeURIComponent(zone)}&financialYear=2026-27&status=active`,
  );
  await expect(page.getByRole("region", { name: "Dashboard KPIs" }).locator("article")).toHaveCount(
    19,
  );
  const metric = (name: string) =>
    page.locator("article").filter({ has: page.getByRole("heading", { name, exact: true }) });
  await expect(metric("Total Leads").getByText("1", { exact: true })).toBeVisible();
  await expect(metric("Expected Pipeline Value").getByText(/123\.45/)).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Operational workload", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "Collection summary", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (info.project.name === "mobile") {
    await page.getByRole("button", { name: "Open navigation", exact: true }).click();
    await expect(page.getByRole("navigation", { name: "Main navigation" }).last()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Open navigation", exact: true })).toBeFocused();
  } else {
    const dashboardUrl = page.url();
    await page
      .getByRole("searchbox", { name: "Search all leads", exact: true })
      .fill(`Management customer ${info.project.name}`);
    await page.getByRole("button", { name: "Submit global lead search", exact: true }).click();
    await expect(page).toHaveURL(/\/leads\?q=/);
    await expect(
      page.getByText(`Management customer ${info.project.name}`, { exact: true }).first(),
    ).toBeVisible();
    await page.goto(dashboardUrl);
  }
  await page.reload();
  await expect(metric("Total Leads").getByText("1", { exact: true })).toBeVisible();
  const filters = page.getByRole("form", { name: "Management filters" });
  await filters.getByLabel("From (IST)", { exact: true }).fill("2000-01-01");
  await filters.getByLabel("To (IST, inclusive)", { exact: true }).fill("2000-12-31");
  await filters.getByRole("button", { name: "Apply filters", exact: true }).click();
  await expect(metric("Total Leads").getByText("0", { exact: true })).toBeVisible();
  await filters.getByLabel("From (IST)", { exact: true }).fill("");
  await filters.getByLabel("To (IST, inclusive)", { exact: true }).fill("");
  await filters.getByRole("button", { name: "Apply filters", exact: true }).click();
  await expect(metric("Total Leads").getByText("1", { exact: true })).toBeVisible();
  await page.screenshot({
    path: `test-results/management-dashboard-${info.project.name}.png`,
    fullPage: true,
  });
  await page.goto(
    `/reports?type=sales&organizationId=${company.id}&territory=${encodeURIComponent(zone)}`,
  );
  await expect(page.getByRole("table").getByText("IBAX", { exact: true })).toBeVisible();
  let downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "CSV", exact: true }).click();
  let download = await downloadPromise;
  expect(await readFile((await download.path())!, "utf8")).toContain('"IBAX"');
  downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Excel", exact: true }).click();
  download = await downloadPromise;
  const bytes = await readFile((await download.path())!),
    book = new ExcelJS.Workbook();
  await book.xlsx.load(new Uint8Array(bytes).buffer);
  expect(book.getWorksheet("Report")!.getCell("A2").value).toBe("IBAX");
  await page.goto("/reports?type=dispatch");
  await expect(page.getByRole("table")).not.toContainText("NaN");
  await expect(
    page
      .getByRole("table")
      .getByText(/2 Jan 2020/)
      .first(),
  ).toBeVisible();
  await page.goto("/notifications");
  const alert = page
    .locator("article")
    .filter({ hasText: `Management customer ${info.project.name}` });
  await expect(alert).toBeVisible();
  await alert.getByRole("button", { name: "Mark read", exact: true }).click();
  await expect(alert.getByText(/· Read/)).toBeVisible();
  await page.reload();
  await expect(alert.getByText(/· Read/)).toBeVisible();
  await alert.getByRole("button", { name: "Dismiss", exact: true }).click();
  await expect(alert).toHaveCount(0);
  await page.goto("/settings");
  await page.getByRole("link", { name: "Roles and permissions", exact: false }).click();
  await expect(page.getByRole("dialog", { name: "Role permissions", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.goto(`/reports?type=sales&organizationId=${company.id}`);
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({
    path: `test-results/management-reports-${info.project.name}.png`,
    fullPage: true,
  });
});
