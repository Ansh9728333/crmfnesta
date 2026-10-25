import { test, expect } from "@playwright/test";
import { browserFinance } from "../support/browser-credentials";
test("records S-Grip installation, glass approvals and engineer audit with persistent site history", async ({
  page,
  context,
}, info) => {
  await page.setExtraHTTPHeaders({
    "x-vercel-forwarded-for": info.project.name === "desktop" ? "192.0.2.110" : "192.0.2.111",
  });
  await page.goto("/login");
  await page.getByLabel("Username", { exact: true }).fill(browserFinance.username);
  await page.getByLabel("Password", { exact: true }).fill(browserFinance.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL("http://127.0.0.1:3100/");
  const name = `Installation ${info.project.name}`,
    listing = await (
      await context.request.get(`/api/aftercare?q=${encodeURIComponent(name)}`)
    ).json(),
    id = listing.rows[0].id;
  const detail = async () => {
    const response = await context.request.get(`/api/aftercare/orders/${id}`);
    expect(response.ok()).toBe(true);
    return response.json();
  };
  await page.goto(`/installations?q=${encodeURIComponent(name)}`);
  await expect(page.getByRole("link").filter({ hasText: name })).toHaveCount(1);
  await page.getByRole("link").filter({ hasText: name }).click();
  await expect(page).toHaveURL(`http://127.0.0.1:3100/installations?orderId=${id}`);
  await expect(page.getByRole("heading", { name, level: 1, exact: true })).toBeVisible();
  const form = (title: string) =>
    page.locator("form").filter({ has: page.getByRole("heading", { name: title, exact: true }) });
  let f = form("Record installed quantities");
  const d = await detail();
  await f.getByLabel("Load item", { exact: true }).selectOption(d.items[0].id);
  await f.getByLabel("Quantity installed in this update", { exact: true }).fill("41");
  await f.getByLabel("Work date (IST)", { exact: true }).fill("2020-01-01T10:00");
  await f
    .getByLabel("Installation remarks", { exact: true })
    .fill("Invalid excess must remain unsaved");
  await f.getByRole("button", { name: "Save installed quantity", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "exceeds" })).toBeVisible();
  await f.getByLabel("Quantity installed in this update", { exact: true }).fill("40");
  await f.getByLabel("Installation remarks", { exact: true }).fill("All railing items installed");
  await f.getByRole("button", { name: "Save installed quantity", exact: true }).click();
  await expect(page.getByText("Pending: 0", { exact: true })).toBeVisible();
  f = form("Complete installation");
  await f.getByLabel("Completed date (IST)", { exact: true }).fill("2020-01-01T10:00");
  await f.getByLabel("Completion remarks", { exact: true }).fill("Glass approval still required");
  await f.getByRole("button", { name: "Confirm installation complete", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "glass checklist" })).toBeVisible();
  f = form("Glass measurement");
  await f.getByLabel("Dimension description", { exact: true }).fill("Panel width");
  await f.getByLabel("Dimension value", { exact: true }).fill("1200");
  await f.getByLabel("Unit", { exact: true }).selectOption("mm");
  await f
    .getByLabel("Responsible employee", { exact: true })
    .selectOption(d.installations[0].assignedTo);
  await f.getByLabel("Measurement date (IST)", { exact: true }).fill("2020-01-01T10:00");
  await f.getByLabel("Measurement notes", { exact: true }).fill("Measured at railing installation");
  await f.getByRole("button", { name: "Record glass dimensions", exact: true }).click();
  await expect(page.getByText("Panel width: 1200 mm", { exact: true })).toBeVisible();
  f = form("Prepare glass template");
  await f
    .getByLabel("Uploaded glass template", { exact: true })
    .selectOption(d.files.find((f: { kind: string }) => f.kind === "glass_template").id);
  await f.getByLabel("Prepared date (IST)", { exact: true }).fill("2020-01-01T10:00");
  await f
    .getByLabel("Preparation notes", { exact: true })
    .fill("Template matches measured dimensions");
  await f.getByRole("button", { name: "Record prepared template", exact: true }).click();
  f = form("Approve glass template");
  await f.getByLabel("Approval date (IST)", { exact: true }).fill("2020-01-01T10:00");
  await f.getByLabel("Approval notes", { exact: true }).fill("Template verified by engineer");
  await f.getByRole("button", { name: "Approve template", exact: true }).click();
  await expect(form("Approve glass template")).toHaveCount(0);
  f = form("Complete installation");
  await f.getByLabel("Completed date (IST)", { exact: true }).fill("2020-01-01T10:00");
  await f
    .getByLabel("Completion remarks", { exact: true })
    .fill("All installed items and glass checks complete");
  await f.getByRole("button", { name: "Confirm installation complete", exact: true }).click();
  await expect(form("Complete installation")).toHaveCount(0);
  await page.reload();
  expect((await detail()).installations[0].status).toBe("completed");
  f = form("Site quality inspection");
  await f.getByLabel("Inspection date (IST)", { exact: true }).fill("2020-01-01T10:00");
  for (const key of [
    "Measurements",
    "Fixings",
    "Alignment",
    "Operation",
    "Finish",
    "Safety",
    "Cleanliness",
  ])
    await f.getByLabel(key, { exact: true }).selectOption("pass");
  await f
    .getByLabel("Quality findings", { exact: true })
    .fill("Installation passed all quality checks");
  await f.getByRole("button", { name: "Save inspection findings", exact: true }).click();
  await expect(page.getByText("measurements: pass", { exact: true })).toBeVisible();
  f = form("Submit audit for approval");
  await f
    .getByLabel("Decision / submission notes", { exact: true })
    .fill("All inspection evidence reviewed");
  await f.getByRole("button", { name: "Submit audit", exact: true }).click();
  f = form("Review final audit");
  await f.getByLabel("Final audit decision", { exact: true }).selectOption("audit.approve");
  await f
    .getByLabel("Decision / submission notes", { exact: true })
    .fill("Engineer grants final approval");
  await f.getByRole("button", { name: "Record audit decision", exact: true }).click();
  await expect(form("Review final audit")).toHaveCount(0);
  f = form("Complete this production load");
  await f.getByLabel("Load completed date (IST)", { exact: true }).fill("2020-01-01T10:00");
  await f
    .getByLabel("Load completion notes", { exact: true })
    .fill("Independent load fulfillment complete");
  await f.getByRole("button", { name: "Mark load complete", exact: true }).click();
  await expect(form("Complete this production load")).toHaveCount(0);
  f = form("Prepare handover documents");
  await f
    .getByLabel("Handover preparation notes", { exact: true })
    .fill("Prepare required customer pack");
  await f.getByRole("button", { name: "Create handover record", exact: true }).click();
  await expect(form("Confirm final handover")).toBeVisible();
  await page.reload();
  const saved = await detail();
  expect(saved.loads[0].status).toBe("completed");
  expect(saved.order.completedAt).toBeNull();
  expect(saved.glass[0].templateApproved).toBe(true);
  expect(saved.audits[0].status).toBe("approved");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({
    path: `test-results/aftercare-${info.project.name}.png`,
    fullPage: true,
  });
});
