import { test, expect } from "@playwright/test";
import { browserAdmin } from "../support/browser-credentials";
test("allocates, edits, filters and reloads independent production loads", async ({
  page,
  context,
}, info) => {
  await page.setExtraHTTPHeaders({
    "x-vercel-forwarded-for": info.project.name === "desktop" ? "192.0.2.90" : "192.0.2.91",
  });
  await page.goto("/login");
  await page.getByLabel("Username", { exact: true }).fill(browserAdmin.username);
  await page.getByLabel("Password", { exact: true }).fill(browserAdmin.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL("http://127.0.0.1:3100/");
  const listing = await (
      await context.request.get(`/api/orders?q=Engine%20${info.project.name}`)
    ).json(),
    order = listing.rows[0];
  const plan = await (await context.request.get(`/api/production/planning/${order.id}`)).json();
  await page.goto(`/production?orderId=${order.id}`);
  await page.getByRole("button", { name: "Create load", exact: true }).click();
  await page
    .getByLabel("Assigned production employee", { exact: true })
    .selectOption(plan.employees[0].id);
  await page.getByLabel("Site readiness", { exact: true }).selectOption("ready");
  await page.getByLabel("Allocate Workflow fixture product", { exact: true }).fill("30");
  await page
    .getByLabel("Allocation notes", { exact: true })
    .fill("Thirty site-ready items for the first load");
  await page.getByRole("button", { name: "Save allocation", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Load 1", exact: true })).toBeVisible();
  const firstUrl = page.url();
  await expect(page.getByText("30.000 allocated across loads", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Edit allocation", exact: true }).click();
  await page.getByLabel("Allocate Workflow fixture product", { exact: true }).fill("29");
  await page.getByLabel("Allocation notes", { exact: true }).fill("Revised initial allocation");
  await page.getByRole("button", { name: "Save allocation", exact: true }).click();
  await expect(page.getByText("29.000 allocated across loads", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Edit allocation", exact: true }).click();
  await page.getByLabel("Allocate Workflow fixture product", { exact: true }).fill("30");
  await page.getByLabel("Allocation notes", { exact: true }).fill("Confirmed thirty items");
  await page.getByRole("button", { name: "Save allocation", exact: true }).click();
  await expect(page.getByText("30.000 allocated across loads", { exact: false })).toBeVisible();
  await page.goto(`/production?orderId=${order.id}`);
  await page.getByRole("button", { name: "Create load", exact: true }).click();
  await page
    .getByLabel("Assigned production employee", { exact: true })
    .selectOption(plan.employees[0].id);
  await page.getByLabel("Allocate Workflow fixture product", { exact: true }).fill("10");
  await page
    .getByLabel("Allocation notes", { exact: true })
    .fill("Ten items awaiting site readiness");
  await page.getByRole("button", { name: "Save allocation", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Load 2", exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("40.000 allocated across loads", { exact: false })).toBeVisible();
  const secondId = page.url().split("/").at(-1),
    detail = await (await context.request.get(`/api/production/${secondId}`)).json();
  const over = await context.request.patch(`/api/production/${secondId}`, {
    headers: { origin: "http://127.0.0.1:3100" },
    data: {
      action: "allocate",
      version: detail.load.version,
      plan: {
        orderId: order.id,
        assignedTo: plan.employees[0].id,
        siteReady: false,
        notes: "Invalid over-allocation",
        allocations: [{ orderItemId: plan.items[0].id, quantity: "11" }],
      },
    },
  });
  expect(over.status()).toBe(409);
  await page.goto(`/production?orderId=${order.id}`);
  await page.getByLabel("Site readiness filter", { exact: true }).selectOption("pending");
  await page.getByRole("button", { name: "Apply filters", exact: true }).click();
  await expect(page.getByText("1 matching loads", { exact: false })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Load 2", exact: true })).toBeVisible();
  await page.goto(firstUrl);
  await page.reload();
  await expect(page.getByText("Thirty site-ready items", { exact: false })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Production status timeline", exact: true }),
  ).toBeVisible();
  await expect(
    page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).resolves.toBe(true);
  await page.screenshot({
    path: `test-results/production-${info.project.name}.png`,
    fullPage: true,
  });
});
