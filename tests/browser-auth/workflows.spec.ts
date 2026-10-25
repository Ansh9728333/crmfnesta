import { expect, test } from "@playwright/test";
import { browserAdmin } from "../support/browser-credentials";
test("records visits, immutable quotations, showroom, negotiation and Won/Lost conversion", async ({
  page,
  context,
}, testInfo) => {
  await page.setExtraHTTPHeaders({
    "x-vercel-forwarded-for": testInfo.project.name === "desktop" ? "192.0.2.60" : "192.0.2.61",
  });
  await page.goto("/login");
  await page.getByLabel("Username", { exact: true }).fill(browserAdmin.username);
  await page.getByLabel("Password", { exact: true }).fill(browserAdmin.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL("http://127.0.0.1:3100/");
  const directory = await (await context.request.get("/api/leads?mode=directory")).json(),
    org = directory.organizations[0],
    centre = directory.centres.find((c: { organizationId: string }) => c.organizationId === org.id),
    assigned = directory.currentUserId;
  const fixture = {
    organizationId: org.id,
    centreId: centre.id,
    assignedTo: assigned,
    clientName: `Workflow ${testInfo.project.name}`,
    mobile: testInfo.project.name === "desktop" ? "9876600201" : "9876600202",
    projectName: "Workflow test villa",
    siteAddress: "Isolated browser fixture site, Bengaluru",
  };
  const response = await context.request.post("/api/leads", {
    headers: { origin: "http://127.0.0.1:3100" },
    data: fixture,
  });
  expect(response.ok()).toBe(true);
  const { id } = await response.json();
  await page.goto(`/leads/${id}/presales`);
  await page
    .getByLabel("Appointment date and time (IST)", { exact: true })
    .fill("2090-01-01T10:30");
  await page.getByRole("button", { name: "Schedule visit", exact: true }).click();
  await expect(page.getByRole("button", { name: "Edit appointment", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Edit appointment", exact: true }).click();
  await page.getByLabel("Visit status", { exact: true }).selectOption("completed");
  await page
    .getByLabel("Site observations", { exact: true })
    .fill("Openings ready for initial measurements");
  await page.getByRole("button", { name: "Add measurement", exact: true }).click();
  await page.getByLabel("Measurement 1 label", { exact: true }).fill("Window width");
  await page.getByLabel("Measurement 1 value", { exact: true }).fill("1500");
  await page.getByRole("button", { name: "Save appointment", exact: true }).click();
  await expect(page.getByText("1500 mm", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Quotations", exact: true }).click();
  await page.getByLabel("Item 1 name", { exact: true }).fill("Premium window");
  await page.getByLabel("Item 1 description", { exact: true }).fill("Measured living-room window");
  await page.getByLabel("Item 1 Quantity", { exact: true }).fill("2");
  await page.getByLabel("Item 1 Unit rate (INR)", { exact: true }).fill("1000");
  await page.getByLabel("Item 1 Discount (INR)", { exact: true }).fill("50");
  await page
    .getByLabel("Customer notes", { exact: true })
    .fill("Finish as discussed with customer");
  await page.getByRole("button", { name: "Issue quotation V1", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Quotation V1 Issued", exact: true }),
  ).toBeVisible();
  const pdfLink = page.getByRole("link", { name: "Download PDF", exact: true });
  const pdf = await context.request.get((await pdfLink.getAttribute("href"))!);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
  expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
  await page.getByRole("button", { name: "Copy latest items", exact: true }).click();
  await page.getByLabel("Item 1 Quantity", { exact: true }).fill("3");
  await page.getByLabel("Item 1 Unit rate (INR)", { exact: true }).fill("1200");
  await page
    .getByLabel("Revision reason", { exact: true })
    .fill("Customer revised opening quantity");
  await page.getByRole("button", { name: "Issue quotation V2", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Quotation V2 Issued", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Quotation V1 Issued", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Approval or acceptance evidence", { exact: true })
    .fill("Customer accepted V2 final quantities and INR 3550 in person");
  await page.getByRole("button", { name: "Record decision", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Quotation V2 accepted", exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("quotation-revisions.png"), fullPage: true });
  await page.getByRole("tab", { name: "Showroom & negotiation", exact: true }).click();
  await page.getByLabel("Showroom visit Not Required", { exact: true }).check();
  await page
    .getByLabel("Not Required reason", { exact: true })
    .fill("Customer reviewed physical samples at site");
  await page
    .getByLabel("Interaction notes", { exact: true })
    .fill("Samples reviewed and finishes confirmed");
  await page.getByRole("button", { name: "Record interaction", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Not Required", exact: true })).toBeVisible();
  await page.getByLabel("Interaction type", { exact: true }).selectOption("negotiation");
  await page.getByLabel("Interaction outcome", { exact: true }).fill("Final offer agreed");
  await page
    .getByLabel("Interaction notes", { exact: true })
    .fill("Customer confirmed V2 and final delivery expectations");
  await page.getByLabel("Revised offer (INR)", { exact: true }).fill("3550");
  await page.getByRole("button", { name: "Record interaction", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Final offer agreed", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Order conversion", exact: true }).click();
  await page.getByLabel("Confirm selected company", { exact: true }).selectOption(org.id);
  const workflow = await (await context.request.get(`/api/leads/${id}/presales`)).json();
  await page
    .getByLabel("Approved or accepted quotation", { exact: true })
    .selectOption(workflow.quotations[0].id);
  await page.getByRole("checkbox", { name: /I confirm all final quantities/ }).check();
  await page.getByRole("button", { name: "Convert to order", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "View order & post-sales initialization", exact: true }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("link", { name: "View order & post-sales initialization", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Shared post-sales workflow", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("1. WhatsApp Group Created · current", { exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("converted-order.png"), fullPage: true });
  const persisted = await (await context.request.get(`/api/leads/${id}/presales`)).json();
  expect(persisted.quotations[1].amount).toBe("1950.00");
  expect(persisted.order.finalValue).toBe("3550.00");
  expect(persisted.order.finalQuantity).toBe("3.000");
  const lostResponse = await context.request.post("/api/leads", {
    headers: { origin: "http://127.0.0.1:3100" },
    data: {
      ...fixture,
      clientName: `Lost ${testInfo.project.name}`,
      mobile: testInfo.project.name === "desktop" ? "9876600203" : "9876600204",
      siteAddress: "Different isolated site address Bengaluru",
    },
  });
  expect(lostResponse.ok()).toBe(true);
  const lost = await lostResponse.json();
  await page.goto(`/leads/${lost.id}/presales?tab=conversion`);
  await page
    .getByLabel("Lost closure reason", { exact: true })
    .fill("Customer postponed construction indefinitely");
  await page.getByRole("button", { name: "Mark Lost", exact: true }).click();
  await expect(
    page.getByText(/Closed .*Customer postponed construction indefinitely/),
  ).toBeVisible();
  await page.reload();
  expect(
    (await (await context.request.get(`/api/leads/${lost.id}`)).json()).lead.closedAt,
  ).toBeTruthy();
  await page.goto("/appointments");
  await expect(
    page.getByRole("heading", { name: "Appointments & site visits", exact: true }),
  ).toBeVisible();
  await page.goto("/quotations");
  await expect(
    page.getByRole("heading", { name: "Versioned quotations", exact: true }),
  ).toBeVisible();
});
