import { expect, test, type Page } from "@playwright/test";
import { browserAdmin } from "../support/browser-credentials";
async function signIn(page: Page, username: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}
test("creates, edits, assigns, filters and reloads persisted pre-sales records", async ({
  page,
  context,
  browser,
}, testInfo) => {
  const networkIp = testInfo.project.name === "desktop" ? "192.0.2.40" : "192.0.2.41";
  await page.setExtraHTTPHeaders({ "x-vercel-forwarded-for": networkIp });
  const prefix = `PreSales ${testInfo.project.name}`,
    username = `leads.${testInfo.project.name}`,
    initialPassword = "Isolated-PreSales-Initial-123!",
    mobile = testInfo.project.name === "desktop" ? "9876500101" : "9876500102";
  await signIn(page, browserAdmin.username, browserAdmin.password);
  await expect(page).toHaveURL("http://127.0.0.1:3100/");
  const directoryResponse = await context.request.get("/api/leads?mode=directory"),
    directory = await directoryResponse.json();
  const organization = directory.organizations[0],
    centre = directory.centres.find(
      (c: { organizationId: string }) => c.organizationId === organization.id,
    );
  const employeeResponse = await context.request.post("/api/admin/employees", {
    headers: { origin: "http://127.0.0.1:3100" },
    data: {
      name: `${prefix} Executive`,
      username,
      email: `${username}@example.test`,
      password: initialPassword,
      mobile: "+919000000002",
      department: "Sales",
      active: true,
      assignments: [
        { organizationId: organization.id, centreId: centre.id, role: "Sales Executive" },
      ],
    },
  });
  expect(employeeResponse.status()).toBe(200);
  const employee = await employeeResponse.json();
  await page.goto("/leads?view=table");
  await page.getByRole("button", { name: "Add lead", exact: true }).click();
  const create = page.getByRole("dialog", { name: "Add lead", exact: true });
  await create.getByLabel("Client name", { exact: false }).fill(prefix);
  await create.getByLabel("Mobile no.", { exact: false }).fill(mobile);
  await create.getByLabel("Project name", { exact: false }).fill(`${prefix} Villa`);
  await create
    .getByLabel("Site address", { exact: false })
    .fill("Independent test address, Bengaluru 560001");
  await create.getByLabel("Financial year", { exact: false }).fill("2026-27");
  await create.getByLabel("Brand", { exact: true }).fill("Test brand");
  await create.getByLabel("Expected value", { exact: false }).fill("250000.50");
  await create.getByLabel("Lead source", { exact: true }).fill("Browser referral");
  await create.getByLabel("Territory", { exact: true }).fill("Bengaluru");
  await create.getByRole("button", { name: "Create lead", exact: true }).click();
  await expect(page).toHaveURL(/\/leads\/[0-9a-f-]+$/);
  const detailUrl = page.url(),
    leadId = detailUrl.split("/").at(-1)!;
  await expect(page.getByRole("heading", { name: prefix, exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: prefix, exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Edit lead", exact: true }).click();
  const edit = page.getByRole("dialog", { name: "Edit lead", exact: true });
  await edit.getByLabel("Client name", { exact: false }).fill(`${prefix} Updated`);
  await edit.getByLabel("Assigned executive", { exact: false }).selectOption(employee.id);
  await edit
    .getByLabel("Remarks", { exact: true })
    .fill("Persisted edit and reassignment confirmed");
  await edit.getByRole("button", { name: "Save lead changes", exact: true }).click();
  await expect(edit).not.toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: `${prefix} Updated`, exact: true })).toBeVisible();
  await expect(page.getByText(`${prefix} Executive`, { exact: true }).first()).toBeVisible();
  await page.getByLabel("Follow-up due (IST)", { exact: true }).fill("2090-01-01T10:30");
  await page.getByLabel("Next action", { exact: true }).fill("Call about site readiness");
  await page.getByRole("button", { name: "Add follow-up", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Call about site readiness", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Completion notes for Call about site readiness")
    .fill("Site visit discussed");
  await page.getByRole("button", { name: "Complete", exact: true }).click();
  await expect(page.getByText("Site visit discussed", { exact: true })).toBeVisible();
  await page.getByLabel("Activity note").fill("Customer is reviewing the specification");
  await page.getByRole("button", { name: "Add note", exact: true }).click();
  await expect(
    page.getByText("Customer is reviewing the specification", { exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("lead-detail.png"), fullPage: true });
  await page.goto("/leads?view=table");
  await page.getByLabel("Search leads", { exact: true }).fill(prefix);
  await page.getByRole("button", { name: "Apply filters", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(encodeURIComponent(prefix).replace(/%20/g, "\\+")));
  const row = page.getByRole("row").filter({ hasText: `${prefix} Updated` });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "View lead", exact: true }).click();
  const drawer = page.getByRole("dialog", { name: "Lead details", exact: true });
  await expect(
    drawer.getByRole("heading", { name: `${prefix} Updated`, exact: true }),
  ).toBeVisible();
  await drawer.getByRole("button", { name: "Close", exact: true }).click();
  await page.goto(`/leads?view=board&q=${encodeURIComponent(prefix)}`);
  await page.getByRole("button", { name: `Done ${prefix} Updated`, exact: true }).click();
  let move = page.getByRole("dialog", { name: "Mark current step Done", exact: true });
  await move.getByRole("button", { name: "Done · start next step", exact: true }).click();
  await expect(move).not.toBeVisible();
  await expect(
    page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: "Site Visit Appointment", exact: true }) })
      .getByRole("button", { name: `${prefix} Updated`, exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: `Done ${prefix} Updated`, exact: true }).click();
  move = page.getByRole("dialog", { name: "Mark current step Done", exact: true });
  await move.getByRole("button", { name: "Done · start next step", exact: true }).click();
  await expect(move.getByRole("alert")).toContainText("Save a site visit appointment");
  await move.getByRole("button", { name: "Close", exact: true }).click();
  async function evidence(action: string, data: unknown) {
    const response = await context.request.post(`/api/leads/${leadId}/presales`, {
      headers: { origin: "http://127.0.0.1:3100" },
      data: { action, data },
    });
    expect(response.status()).toBe(200);
    return response.json();
  }
  async function done(next: string) {
    await page.reload();
    await expect(page.getByRole("button", { name: /^Move / })).toHaveCount(0);
    await page.getByRole("button", { name: `Done ${prefix} Updated`, exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Mark current step Done", exact: true });
    await expect(dialog.getByRole("combobox")).toHaveCount(0);
    await dialog.getByRole("button", { name: "Done · start next step", exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(
      page
        .locator("section")
        .filter({ has: page.getByRole("heading", { name: next, exact: true }) })
        .getByRole("button", { name: `${prefix} Updated`, exact: true }),
    ).toBeVisible();
  }
  const appointment = {
    assignedTo: employee.id,
    scheduledAt: new Date().toISOString(),
    status: "scheduled",
  };
  const savedVisit = await evidence("appointment", appointment);
  await done("Site Visit and Initial Measurement");
  await evidence("appointment", {
    ...appointment,
    id: savedVisit.id,
    version: 1,
    status: "completed",
    observations: "Site measured",
    measurements: [{ label: "Width", value: "1200", unit: "mm" }],
  });
  await done("Quotation Submitted");
  await evidence("quotation", {
    expectedRevision: 0,
    items: [
      {
        name: "Window",
        productCompanyId: organization.id,
        quantity: "1",
        unitPrice: "100",
        discount: "0",
      },
    ],
  });
  await done("Customer Showroom Visit");
  await evidence("engagement", {
    kind: "showroom",
    occurredAt: new Date().toISOString(),
    outcome: "Not Required",
    notRequired: true,
    reason: "Customer saw samples at site",
  });
  await done("Negotiation / Quotation Revision");
  await page.goto(detailUrl);
  const status = page.getByRole("region", { name: "Step completion status" });
  await expect(status.getByText("Done", { exact: true })).toHaveCount(5);
  await page.reload();
  await expect(status.getByText("Done", { exact: true })).toHaveCount(5);
  await page.screenshot({ path: testInfo.outputPath("done-workflow.png"), fullPage: true });
  await page.goto(`/leads/${leadId}/presales?tab=conversion`);
  await page
    .getByLabel("Lost closure reason", { exact: true })
    .fill("Customer postponed this project");
  await page.getByRole("button", { name: "Mark Lost", exact: true }).click();
  await expect(page.getByText("lost", { exact: true }).first()).toBeVisible();
  await page.goto(detailUrl);
  await expect(page.getByRole("heading", { name: "Lost reason", exact: true })).toBeVisible();
  await expect(page.getByText("Customer postponed this project", { exact: true })).toBeVisible();
  const employeeContext = await browser.newContext({
    baseURL: "http://127.0.0.1:3100",
    viewport: testInfo.project.use.viewport,
    extraHTTPHeaders: {
      "x-vercel-forwarded-for": testInfo.project.name === "desktop" ? "192.0.2.42" : "192.0.2.43",
    },
  });
  const employeePage = await employeeContext.newPage();
  await signIn(employeePage, username, initialPassword);
  await expect(employeePage).toHaveURL("http://127.0.0.1:3100/");
  await employeePage.goto(detailUrl);
  await expect(
    employeePage.getByRole("heading", { name: `${prefix} Updated`, exact: true }),
  ).toBeVisible();
  await employeeContext.close();
  const persisted = await context.request.get(`/api/leads/${leadId}`);
  expect(persisted.status()).toBe(200);
  const result = await persisted.json();
  expect(result.lead.outcome).toBe("lost");
  expect(result.lead.assignedTo).toBe(employee.id);
  expect(result.lead.mobile).toBe(`+91${mobile}`);
  await page.goto("/customers");
  await expect(page.getByRole("cell", { name: prefix, exact: true })).toBeVisible();
  await page.goto("/projects");
  await expect(page.getByRole("cell", { name: `${prefix} Villa`, exact: true })).toBeVisible();
  await page.goto("/customers");
  await page.getByRole("button", { name: "Add customer", exact: true }).click();
  const contact = page.getByRole("dialog", { name: "Add customer", exact: true });
  await contact.getByLabel("Customer name", { exact: true }).fill(`${prefix} Direct Contact`);
  await contact
    .getByLabel("Mobile no.", { exact: true })
    .fill(testInfo.project.name === "desktop" ? "9876500191" : "9876500192");
  await contact.getByRole("button", { name: "Create customer", exact: true }).click();
  await expect(contact).not.toBeVisible();
  await page.goto("/projects");
  await page.getByRole("button", { name: "Add project", exact: true }).click();
  const project = page.getByRole("dialog", { name: "Add project", exact: true });
  const picker = project.getByRole("combobox", { name: "Customer", exact: true });
  await expect(
    picker.locator("option").filter({ hasText: `${prefix} Direct Contact` }),
  ).toHaveCount(1);
  await project.getByLabel("Find customer", { exact: true }).fill("NoSuchPermittedCustomer_2026");
  await project.getByRole("button", { name: "Find", exact: true }).click();
  await expect(project.getByText(/No matching customers in this company/)).toBeVisible();
  await project.getByLabel("Find customer", { exact: true }).fill(`${prefix} Direct Contact`);
  await project.getByRole("button", { name: "Find", exact: true }).click();
  await expect(
    picker.locator("option").filter({ hasText: `${prefix} Direct Contact` }),
  ).toHaveCount(1);
  const customerValue = await picker
    .locator("option")
    .filter({ hasText: `${prefix} Direct Contact` })
    .getAttribute("value");
  await picker.selectOption(customerValue!);
  await project.getByLabel("Project name", { exact: true }).fill(`${prefix} Direct Project`);
  await project
    .getByLabel("Site address", { exact: true })
    .fill("Independent project test address Delhi");
  await project.screenshot({ path: `test-results/add-project-${testInfo.project.name}.png` });
  await project.getByRole("button", { name: "Create project", exact: true }).click();
  await expect(project).not.toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("cell", { name: `${prefix} Direct Project`, exact: true }),
  ).toBeVisible();
  await page.goto(`/projects?customerId=${customerValue}`);
  const linkedLookup = page.waitForResponse((r) => {
    const u = new URL(r.url());
    return u.pathname === "/api/customers" && u.searchParams.get("customerId") === customerValue;
  });
  await page.getByRole("button", { name: "Add project", exact: true }).click();
  const linked = page.getByRole("dialog", { name: "Add project", exact: true });
  await expect(linked.getByRole("combobox", { name: "Customer", exact: true })).toHaveValue(
    customerValue!,
  );
  await expect(
    linked.getByRole("combobox", { name: "Customer", exact: true }).locator("option:checked"),
  ).toContainText(`${prefix} Direct Contact`);
  expect((await linkedLookup).status()).toBe(200);
  await linked.getByRole("button", { name: "Close", exact: true }).click();
  await page.goto("/documents");
  await expect(page.getByText("Planned module", { exact: true })).toBeVisible();
});
