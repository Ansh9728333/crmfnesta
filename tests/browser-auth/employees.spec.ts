import { expect, test, type Page } from "@playwright/test";
import { browserAdmin, browserEmployee } from "../support/browser-credentials";

async function signIn(page: Page, username: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}
async function changePassword(page: Page, current: string, next: string) {
  await page.goto("/change-password");
  await expect(
    page.getByRole("heading", { name: "Change your password", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Current password", { exact: true }).fill(current);
  await page.getByLabel("New password", { exact: true }).fill(next);
  await page.getByLabel("Confirm new password", { exact: true }).fill(next);
  await page.getByRole("button", { name: "Change password", exact: true }).click();
  await expect(page).toHaveURL("http://127.0.0.1:3100/");
}

test("Admin provisions and manages an employee through real authenticated UI", async ({
  page,
  browser,
}, testInfo) => {
  const username = `browser.${testInfo.project.name}`;
  const name = `Browser ${testInfo.project.name} Employee`;
  await signIn(page, browserAdmin.username, browserAdmin.password);
  await expect(page).toHaveURL("http://127.0.0.1:3100/");
  await page.goto("/admin/employees");
  await expect(page.getByRole("heading", { name: "A team built to deliver." })).toBeVisible();
  await page.getByRole("button", { name: "Create employee", exact: true }).click();
  const modal = page.getByRole("dialog", { name: "Create employee", exact: true });
  await modal.getByLabel("Employee name", { exact: true }).fill(name);
  await modal.getByLabel("Username", { exact: true }).fill(username);
  await modal.getByLabel("Email", { exact: true }).fill(`${username}@example.test`);
  await modal.getByLabel("Mobile number", { exact: true }).fill("+919000000002");
  await modal.getByLabel("Department", { exact: true }).fill("Sales");
  await modal.getByLabel("Employee password", { exact: false }).fill(browserEmployee.initial);
  await modal.getByLabel("Designation 1", { exact: true }).selectOption("Sales Executive");
  await page.screenshot({ path: testInfo.outputPath("create-employee.png"), fullPage: true });
  await modal.getByRole("button", { name: "Review new employee" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(modal).not.toBeVisible();
  await page.getByLabel("Search employees").fill(username);
  const row = page.getByRole("row").filter({ hasText: username });
  await expect(row).toContainText("Active");
  await page.screenshot({ path: testInfo.outputPath("employee-directory.png"), fullPage: true });
  const employeeContext = await browser.newContext({
    viewport: testInfo.project.use.viewport,
    extraHTTPHeaders: testInfo.project.use.extraHTTPHeaders,
    baseURL: "http://127.0.0.1:3100",
  });
  const employeePage = await employeeContext.newPage();
  await signIn(employeePage, username, browserEmployee.initial);
  await expect(employeePage).toHaveURL("http://127.0.0.1:3100/");
  await changePassword(employeePage, browserEmployee.initial, browserEmployee.password);
  expect((await employeeContext.request.get("/api/admin/employees")).status()).toBe(403);
  await employeePage.goto("/admin/employees");
  await expect(employeePage.getByRole("heading", { name: "Access restricted" })).toBeVisible();

  await row.getByRole("button", { name: "Reset password", exact: true }).click();
  await page.getByLabel("New employee password").fill(browserEmployee.reset);
  await page.getByRole("alertdialog").getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(page.getByRole("alertdialog")).not.toBeVisible();
  expect((await employeeContext.request.get("/api/admin/employees")).status()).toBe(401);
  await signIn(employeePage, username, browserEmployee.reset);
  await expect(employeePage).toHaveURL("http://127.0.0.1:3100/");
  await changePassword(employeePage, browserEmployee.reset, browserEmployee.final);

  await row.getByRole("button", { name: "Edit / Change designation", exact: true }).click();
  const drawer = page.getByRole("dialog", { name: "Edit employee", exact: true });
  await drawer.getByLabel("Designation 1", { exact: true }).selectOption("Accounts");
  await drawer.getByRole("button", { name: "Review changes" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(drawer).not.toBeVisible();
  await expect(row).toContainText("Accounts");
  expect((await employeeContext.request.get("/api/admin/employees")).status()).toBe(401);
  await signIn(employeePage, username, browserEmployee.final);
  await expect(employeePage).toHaveURL("http://127.0.0.1:3100/");
  await employeePage.goto("/leads");
  await expect(employeePage.getByRole("heading", { name: "Access restricted" })).toBeVisible();

  await row.getByRole("button", { name: "Deactivate", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(row).toContainText("Inactive");
  await employeePage.goto("/");
  await expect(employeePage).toHaveURL(/\/login/);
  await row.getByRole("button", { name: "Activate", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(row).toContainText("Active");
  await signIn(employeePage, username, browserEmployee.final);
  await expect(employeePage).toHaveURL("http://127.0.0.1:3100/");
  await row.getByRole("button", { name: "Revoke sessions", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(page.getByRole("alertdialog")).not.toBeVisible();
  await employeePage.goto("/");
  await expect(employeePage).toHaveURL(/\/login/);
  await employeeContext.close();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
});
