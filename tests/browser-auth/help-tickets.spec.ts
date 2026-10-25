import { test, expect } from "@playwright/test";
import { browserHelp } from "../support/browser-credentials";
test("raises, resolves, reopens and independently confirms customer help with persistent history", async ({
  page,
  browser,
}, info) => {
  await page.setExtraHTTPHeaders({
    "x-vercel-forwarded-for": info.project.name === "desktop" ? "192.0.2.180" : "192.0.2.181",
  });
  await page.goto("/login");
  await page.getByLabel("Username", { exact: true }).fill(browserHelp.creator.username);
  await page.getByLabel("Password", { exact: true }).fill(browserHelp.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL("http://127.0.0.1:3100/");
  await page.goto("/projects");
  const project = page.getByRole("row").filter({ hasText: "Browser Help Project" });
  await project.getByRole("link", { name: "Raise Help Ticket" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Raise Help Ticket" })).toBeVisible();
  await expect(dialog.getByLabel("Your Name / Raised By")).toHaveValue("Browser Help creator");
  await expect(dialog.getByText("Browser Help Customer", { exact: true })).toBeVisible();
  await dialog
    .getByRole("combobox", { name: "Concern Type *", exact: true })
    .selectOption("service");
  await dialog.getByRole("combobox", { name: "Priority *", exact: true }).selectOption("urgent");
  const issue = `Window lock sticks ${info.project.name}`;
  await dialog.getByLabel("Please Write the Details In Brief *", { exact: true }).fill(issue);
  await dialog
    .getByRole("combobox", {
      name: "Select The Name To whom you want to raise the ticket *",
      exact: true,
    })
    .selectOption({ label: "Browser Help resolver" });
  await dialog.getByRole("button", { name: "Generate Help Ticket", exact: true }).click();
  await expect(page).toHaveURL(/\/help-tickets\/[\w-]+$/);
  const url = page.url();
  await page.reload();
  await expect(page.getByText(issue, { exact: true }).first()).toBeVisible();
  const resolverContext = await browser.newContext({
      baseURL: "http://127.0.0.1:3100",
      extraHTTPHeaders: {
        "x-vercel-forwarded-for": info.project.name === "desktop" ? "192.0.2.182" : "192.0.2.183",
      },
    }),
    resolver = await resolverContext.newPage();
  try {
    await resolver.goto("/login");
    await resolver.getByLabel("Username", { exact: true }).fill(browserHelp.resolver.username);
    await resolver.getByLabel("Password", { exact: true }).fill(browserHelp.password);
    await resolver.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(resolver).toHaveURL("http://127.0.0.1:3100/");
    await resolver.goto("/notifications");
    await expect(resolver.getByText("Help ticket assigned", { exact: true }).first()).toBeVisible();
    await resolver.goto(url);
    await resolver
      .getByLabel("Resolution, confirmation or reason *")
      .fill("Adjusted the lock and checked the handle");
    await resolver.getByRole("button", { name: "Submit resolution", exact: true }).click();
    await expect(
      resolver.getByText("Awaiting Confirmation", { exact: true }).first(),
    ).toBeVisible();
    await expect(
      resolver.getByRole("button", { name: "Confirm & Close", exact: true }),
    ).toHaveCount(0);
    await page.reload();
    await page
      .getByLabel("Resolution, confirmation or reason *")
      .fill("Customer says the lock still sticks");
    await page.getByRole("button", { name: "Reopen with reason", exact: true }).click();
    await expect(page.getByText("Reopened", { exact: true }).first()).toBeVisible();
    await resolver.reload();
    await resolver
      .getByLabel("Resolution, confirmation or reason *")
      .fill("Replaced lock and tested with customer");
    await resolver.getByRole("button", { name: "Submit resolution", exact: true }).click();
    await expect(
      resolver.getByText("Awaiting Confirmation", { exact: true }).first(),
    ).toBeVisible();
    await page.reload();
    await page
      .getByLabel("Resolution, confirmation or reason *")
      .fill("Customer confirms the issue is resolved");
    await page.getByRole("button", { name: "Confirm & Close", exact: true }).click();
    await expect(page.getByText("Closed", { exact: true }).first()).toBeVisible();
    await page.reload();
    await expect(
      page.getByText("Replaced lock and tested with customer", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Customer says the lock still sticks", { exact: true }),
    ).toBeVisible();
    await page.goto(`/help-tickets?q=${encodeURIComponent(issue)}`);
    await expect(page.locator("tbody tr")).toHaveCount(1);
    await page.locator("tbody button").first().click();
    await expect(
      page.getByRole("heading", { name: "Help Ticket Details", exact: true }),
    ).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: "Close", exact: true }).click();
    await expect(page.locator("tbody button").first()).toBeFocused();
    await page.screenshot({
      path: `test-results/help-tickets-${info.project.name}.png`,
      fullPage: true,
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  } finally {
    await resolverContext.close();
  }
});
