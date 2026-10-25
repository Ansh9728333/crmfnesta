import { expect, test } from "@playwright/test";
import { browserAdmin } from "../support/browser-credentials";
test("manages the shared post-sales engine, approvals, filters and configuration", async ({
  page,
  context,
}, info) => {
  await page.setExtraHTTPHeaders({
    "x-vercel-forwarded-for": info.project.name === "desktop" ? "192.0.2.80" : "192.0.2.81",
  });
  await page.goto("/login");
  await page.getByLabel("Username", { exact: true }).fill(browserAdmin.username);
  await page.getByLabel("Password", { exact: true }).fill(browserAdmin.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL("http://127.0.0.1:3100/");
  const name = `Engine ${info.project.name}`,
    listing = await (await context.request.get(`/api/orders?q=${encodeURIComponent(name)}`)).json(),
    order = listing.rows[0];
  expect(order.client).toBe(name);
  await page.goto("/orders");
  await page.getByLabel("Search orders", { exact: true }).fill(name);
  await page
    .getByLabel("Company filter", { exact: true })
    .selectOption(listing.companies.find((c: { name: string }) => c.name === order.company).id);
  await page.getByRole("button", { name: "Apply filters", exact: true }).click();
  await expect(page.getByRole("cell", { name: name, exact: false }).first()).toBeVisible();
  await page.getByRole("link", { name: "Open", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Shared post-sales workflow", exact: true }),
  ).toBeVisible();
  const directory = await (await context.request.get("/api/leads?mode=directory")).json();
  await page.getByLabel("Stage owner", { exact: true }).selectOption(directory.currentUserId);
  await page.getByLabel("Planned completion (IST)", { exact: true }).fill("2090-01-01T10:00");
  await page.getByRole("button", { name: "Save owner & target", exact: true }).click();
  await expect(page.getByRole("button", { name: "Start stage", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Start stage", exact: true }).click();
  await page.getByLabel("WhatsApp group name *", { exact: true }).fill(`Manual ${name} group`);
  await page
    .getByLabel("WhatsApp invitation link *", { exact: true })
    .fill("https://chat.whatsapp.com/IsolatedBrowserGroup");
  await page.getByLabel("Group creation date (IST) *", { exact: true }).fill("2020-01-01T10:00");
  await page
    .getByLabel("Stage notes *", { exact: true })
    .fill("Group created manually by the site team and evidence reviewed");
  // Missing real Storage configuration must produce an honest error, not fake
  // upload success. The required seed attachment is an isolated service fixture.
  await page
    .getByLabel("Upload stage document", { exact: true })
    .setInputFiles({
      name: "test-upload.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.7\nIsolated upload attempt"),
    });
  await page.getByRole("button", { name: "Upload privately", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Service unavailable" })).toBeVisible();
  await expect(page.getByLabel("WhatsApp group name *", { exact: true })).toHaveValue(
    `Manual ${name} group`,
  );
  await page.getByRole("button", { name: "Save evidence", exact: true }).click();
  await expect(page.getByLabel("WhatsApp group name *", { exact: true })).toHaveValue(
    `Manual ${name} group`,
  );
  await page.getByRole("button", { name: "Submit for approval", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Approval review", exact: true })).toBeVisible();
  await page
    .getByLabel("I have reviewed the evidence and required documents for this stage.", {
      exact: true,
    })
    .check();
  await page
    .getByLabel("Review notes / changes requested", { exact: true })
    .fill("Group details and source document verified");
  await page.getByRole("button", { name: "Approve stage", exact: true }).click();
  await expect(page.getByText("2. Documents Uploaded · current", { exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath("order-engine.png"), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.reload();
  await expect(page.getByText("2. Documents Uploaded · current", { exact: true })).toBeVisible();
  await page.getByText("2. Documents Uploaded · current", { exact: true }).click();
  await page.getByLabel("Stage owner", { exact: true }).selectOption(directory.currentUserId);
  await page.getByLabel("Planned completion (IST)", { exact: true }).fill("2090-01-02T10:00");
  await page.getByRole("button", { name: "Save owner & target", exact: true }).click();
  await page.getByRole("button", { name: "Start stage", exact: true }).click();
  await page.getByLabel("Contract reference *", { exact: true }).fill("Browser contract");
  await page
    .getByLabel("Contract payment / credit terms *", { exact: true })
    .fill("40 due before dispatch, remainder after handover");
  await page
    .getByLabel("Contractually due by dispatch, cumulative (INR) *", { exact: true })
    .fill("40");
  await page.getByLabel("Stage notes *", { exact: true }).fill("Contract terms recorded");
  await page.getByRole("button", { name: "Submit for approval", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Upload required stage attachments" }),
  ).toBeVisible();
  const persisted = await (await context.request.get(`/api/orders/${order.id}`)).json();
  expect(persisted.order.stage).toBe(2);
  expect(persisted.stages[0].status).toBe("completed");
  expect(persisted.stages[0].approvedBy).toBe(directory.currentUserId);
  expect(persisted.stages[1].status).toBe("in_progress");
  const skip = await context.request.post(`/api/orders/${order.id}/stages/7`, {
    headers: { origin: "http://127.0.0.1:3100" },
    data: { action: "start", version: persisted.stages[6].version },
  });
  expect(skip.status()).toBe(409);
  await page.goto("/orders/settings");
  await page.getByLabel("Configure stage", { exact: true }).selectOption("3");
  await page.getByLabel("At least one private attachment", { exact: false }).check();
  await page.getByRole("button", { name: "Save stage configuration", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Save stage configuration", exact: true }),
  ).toBeEnabled();
  const config = await (await context.request.get("/api/orders/configuration")).json();
  expect(
    config.policies.some(
      (p: { number: number; requiredFields: string[] }) =>
        p.number === 3 && p.requiredFields.includes("attachments"),
    ),
  ).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
