import { expect, test } from "@playwright/test";
import { modules } from "../../src/lib/navigation";

test("login is responsive, accessible and has no signup path", async ({ page }, testInfo) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Welcome back." })).toBeVisible();
  await expect(page.getByLabel("Username", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("type", "password");
  await expect(page.getByRole("link", { name: /sign up|register/i })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("login.png"), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("anonymous users are redirected away from every protected page", async ({ page }) => {
  for (const path of [
    "/",
    ...modules.map((m) => `/${m.slug}`),
    "/admin/employees",
    "/notifications",
    "/change-password",
  ]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login(?:\?|$)/);
    await expect(page.getByLabel("Username", { exact: true })).toBeVisible();
  }
});

test("direct signup and raw admin endpoints are rejected", async ({ request }) => {
  for (const path of [
    "/api/auth/sign-up/email",
    "/api/auth/admin/create-user",
    "/api/auth/admin/set-user-password",
    "/api/auth/sign-in/email",
    "/api/auth/is-username-available",
  ]) {
    const response = await request.post(path, { data: {} });
    expect(response.status()).toBe(403);
    expect(response.headers()["cache-control"]).toContain("no-store");
  }
  const directory = await request.get("/api/admin/employees");
  expect([401, 503]).toContain(directory.status());
  expect(directory.headers()["cache-control"]).toContain("no-store");
});

test("document security headers use fresh nonces and block injected inline handlers", async ({
  page,
  request,
}) => {
  const first = await page.goto("/login");
  const headers = first!.headers();
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["referrer-policy"]).toBe("no-referrer");
  expect(headers["cache-control"]).toContain("no-store");
  const policy = headers["content-security-policy"];
  expect(policy).toContain("frame-ancestors 'none'");
  expect(policy).toContain("'strict-dynamic'");
  expect(policy).not.toContain("'unsafe-eval'");
  const nonce = policy.match(/'nonce-([^']+)'/)![1];
  expect(
    await page
      .locator("script")
      .evaluateAll((scripts) => scripts.every((script) => Boolean(script.nonce))),
  ).toBe(true);
  const second = await request.get("/login");
  expect(second.headers()["content-security-policy"]).not.toContain(`'nonce-${nonce}'`);
  await page.evaluate(async () => {
    // strict-dynamic deliberately trusts script loaders already executing with
    // authority. An injected HTML event handler must still be rejected.
    await new Promise<void>((resolve) => {
      const image = document.createElement("img");
      image.setAttribute("onerror", "document.documentElement.dataset.injected = 'yes'");
      image.addEventListener("error", () => resolve(), { once: true });
      image.src = "data:image/png;base64,invalid";
      document.body.append(image);
    });
  });
  expect(await page.locator("html").getAttribute("data-injected")).toBeNull();
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeEnabled();
});

test("login failures show a real error without a success redirect", async ({ page }) => {
  // The transport is stubbed only for this presentation test; auth security is
  // independently exercised against PostgreSQL in tests/integration.
  await page.route("**/api/auth/sign-in/username", (route) =>
    route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ message: "Invalid username or password" }),
    }),
  );
  await page.goto("/login");
  await page.getByLabel("Username", { exact: true }).fill("ui-test");
  await page.getByLabel("Password", { exact: true }).fill("invalid-ui-test-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Invalid username or password" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});
