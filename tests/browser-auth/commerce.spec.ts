import { test, expect } from "@playwright/test";
import { browserFinance } from "../support/browser-credentials";
test("verifies installments, allocates load funds, approves dispatch and confirms a partial delivery", async ({
  page,
  context,
}, info) => {
  await page.setExtraHTTPHeaders({
    "x-vercel-forwarded-for": info.project.name === "desktop" ? "192.0.2.100" : "192.0.2.101",
  });
  await page.goto("/login");
  await page.getByLabel("Username", { exact: true }).fill(browserFinance.username);
  await page.getByLabel("Password", { exact: true }).fill(browserFinance.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL("http://127.0.0.1:3100/");
  const name = `Commerce ${info.project.name}`,
    listing = await (
      await context.request.get(`/api/commerce?q=${encodeURIComponent(name)}`)
    ).json(),
    id = listing.rows[0].id;
  const fetchDetail = async (orderId = id) =>
    (await context.request.get(`/api/commerce/orders/${orderId}`)).json();
  let detail = await fetchDetail();
  const milestone = detail.milestones[0];
  async function verifyAndAllocate(reference: string) {
    detail = await fetchDetail();
    const p = detail.payments.find((p: { reference: string }) => p.reference === reference);
    await page.goto(`/payments?orderId=${id}`);
    const card = page.locator("article").filter({ hasText: reference }).first();
    await card
      .getByLabel(`Accounts decision notes ${reference}`, { exact: true })
      .fill("Accounts verified receipt and actual transaction");
    await card.getByRole("checkbox").check();
    await card.getByRole("button", { name: "Record Accounts decision", exact: true }).click();
    await expect(card.getByText("verified", { exact: true })).toBeVisible();
    const form = page.locator("form").filter({
      has: page.getByRole("heading", { name: "Allocate verified payment", exact: true }),
    });
    await form.getByLabel("Verified installment", { exact: true }).selectOption(p.id);
    await form.getByLabel("Load payment milestone", { exact: true }).selectOption(milestone.id);
    await form.getByLabel("Allocation amount (INR)", { exact: true }).fill("20");
    await form
      .getByLabel("Allocation reason", { exact: true })
      .fill("Verified installment funds contract milestone");
    await form.getByRole("button", { name: "Allocate payment", exact: true }).click();
    await expect(card.getByText(/Allocated.*Contract dispatch milestone/)).toBeVisible();
  }
  await verifyAndAllocate(`${name} receipt 1`);
  await page.goto(`/dispatch?orderId=${id}`);
  let shipment = page
    .locator("article")
    .filter({ hasText: `${name} consignment` })
    .first();
  await shipment
    .getByLabel(`Shipment decision notes ${name} consignment`, { exact: true })
    .fill("Attempt before remaining installment");
  await shipment
    .getByLabel(`Shipment action ${name} consignment`, { exact: true })
    .selectOption("dispatch.approve");
  await shipment.getByRole("checkbox").check();
  await shipment.getByRole("button", { name: "Save shipment action", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "verified allocated receipts" }),
  ).toBeVisible();
  await verifyAndAllocate(`${name} receipt 2`);
  await expect(page.getByText("Funded", { exact: true })).toBeVisible();
  const installment = page
    .locator("form")
    .filter({ has: page.getByRole("heading", { name: "Record installment", exact: true }) });
  await installment.getByLabel("Amount received (INR)", { exact: true }).fill("5.00");
  await installment.getByLabel("Payment mode", { exact: true }).selectOption("upi");
  const reference = `UI ${info.project.name} installment`;
  await installment.getByLabel("Transaction / receipt reference", { exact: true }).fill(reference);
  await installment.getByLabel("Payment date (IST)", { exact: true }).fill("2020-01-01T10:00");
  await installment
    .getByLabel("Payment notes", { exact: true })
    .fill("Additional pending installment recorded through UI");
  await installment.getByRole("button", { name: "Add installment", exact: true }).click();
  const pendingCard = page.locator("article").filter({ hasText: reference }).first();
  await expect(pendingCard.getByText("pending", { exact: true })).toBeVisible();
  const pending = (await fetchDetail()).payments.find(
    (p: { reference: string }) => p.reference === reference,
  );
  await pendingCard.getByLabel(`Receipt file ${pending.id}`).setInputFiles({
    name: "receipt.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.7\nReceipt"),
  });
  await pendingCard.getByRole("button", { name: "Upload receipt", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Service unavailable" })).toBeVisible();
  await page.reload();
  await expect(pendingCard.getByText("pending", { exact: true })).toBeVisible();
  expect((await fetchDetail()).totals.verified).toBe("40.00");
  await expect(
    page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).resolves.toBe(true);
  await page.screenshot({ path: `test-results/payments-${info.project.name}.png`, fullPage: true });
  await page.goto(`/dispatch?orderId=${id}`);
  shipment = page
    .locator("article")
    .filter({ hasText: `${name} consignment` })
    .first();
  await shipment
    .getByLabel(`Shipment decision notes ${name} consignment`, { exact: true })
    .fill("Verified milestone and challan approved");
  await shipment
    .getByLabel(`Shipment action ${name} consignment`, { exact: true })
    .selectOption("dispatch.approve");
  await shipment.getByRole("checkbox").check();
  await shipment.getByRole("button", { name: "Save shipment action", exact: true }).click();
  await expect(shipment.getByText("approved", { exact: true })).toBeVisible();
  await shipment
    .getByLabel(`Shipment decision notes ${name} consignment`, { exact: true })
    .fill("Actual transporter collection confirmed");
  await shipment
    .getByLabel(`Shipment action ${name} consignment`, { exact: true })
    .selectOption("dispatch.ship");
  await shipment
    .getByLabel(`Actual dispatch date ${name} consignment (IST)`, { exact: true })
    .fill("2020-01-01T10:00");
  await shipment.getByRole("checkbox").check();
  await shipment.getByRole("button", { name: "Save shipment action", exact: true }).click();
  await expect(shipment.getByText("dispatched", { exact: true })).toBeVisible();
  const deliveredName = `Delivery ${info.project.name}`,
    deliveredList = await (
      await context.request.get(
        `/api/commerce?mode=dispatch&q=${encodeURIComponent(deliveredName)}`,
      )
    ).json(),
    deliveredId = deliveredList.rows[0].id;
  let deliveryDetail = await fetchDetail(deliveredId),
    receipt = deliveryDetail.deliveries[0];
  await page.goto(`/dispatch?orderId=${deliveredId}`);
  let receiptCard = page
    .locator("article")
    .filter({ has: page.getByLabel(`Delivery confirmation notes ${receipt.id}`, { exact: true }) });
  await receiptCard
    .getByLabel(`Delivery confirmation notes ${receipt.id}`, { exact: true })
    .fill("Thirty actual items counted; damage and missing balance recorded");
  await receiptCard.getByRole("checkbox").check();
  await receiptCard.getByRole("button", { name: "Save delivery decision", exact: true }).click();
  await expect(page.getByText("partially delivered", { exact: true })).toBeVisible();
  await expect(page.getByText("Damage recorded", { exact: false })).toBeVisible();
  const deliveryForm = page
    .locator("form")
    .filter({ has: page.getByRole("heading", { name: "Record site delivery", exact: true }) });
  await deliveryForm
    .getByLabel("Dispatched shipment", { exact: true })
    .selectOption(deliveryDetail.dispatches[0].id);
  await deliveryForm.getByLabel("Site received quantity", { exact: true }).fill("10");
  await deliveryForm
    .getByLabel("Actual delivery date (IST)", { exact: true })
    .fill("2020-01-01T10:00");
  await deliveryForm.getByLabel("Received by", { exact: true }).fill("Site representative");
  await deliveryForm
    .getByLabel("Delivery remarks", { exact: true })
    .fill("Remaining ten arrived, awaiting proof confirmation");
  await deliveryForm.getByRole("button", { name: "Create delivery draft", exact: true }).click();
  await expect(page.getByText("Remaining ten arrived", { exact: false }).first()).toBeVisible();
  await page.reload();
  deliveryDetail = await fetchDetail(deliveredId);
  expect(deliveryDetail.dispatchItems[0].deliveredQuantity).toBe("30.000");
  expect(deliveryDetail.loads[0].status).toBe("dispatched");
  receipt = deliveryDetail.deliveries.find((r: { status: string }) => r.status === "draft");
  receiptCard = page
    .locator("article")
    .filter({ has: page.getByLabel(`Delivery confirmation notes ${receipt.id}`, { exact: true }) });
  await receiptCard
    .getByLabel(`Delivery confirmation notes ${receipt.id}`, { exact: true })
    .fill("Cannot confirm without private proof");
  await receiptCard.getByRole("checkbox").check();
  await receiptCard.getByRole("button", { name: "Save delivery decision", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Upload the required" })).toBeVisible();
  await expect(
    page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).resolves.toBe(true);
  await page.screenshot({ path: `test-results/dispatch-${info.project.name}.png`, fullPage: true });
  await page.goto("/dispatch");
  await page.getByLabel("Search customer or order", { exact: true }).fill(deliveredName);
  await page.getByLabel("Ledger status", { exact: true }).selectOption("partial");
  await page.getByRole("button", { name: "Apply filters", exact: true }).click();
  await expect(page.getByText("1 matching orders", { exact: false })).toBeVisible();
});
