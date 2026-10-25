import Decimal from "decimal.js";
import { quotationSchema } from "./validation";
import type { z } from "zod";
export function priceQuotation(data: z.infer<typeof quotationSchema>) {
  const items = data.items.map((item) => {
    const subtotal = new Decimal(item.quantity)
        .mul(item.unitPrice)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
      discount = new Decimal(item.discount);
    if (discount.gt(subtotal)) throw new Error("An item discount cannot exceed its subtotal");
    return {
      ...item,
      subtotal: subtotal.toFixed(2),
      discount: discount.toFixed(2),
      amount: subtotal.minus(discount).toFixed(2),
    };
  });
  const subtotal = items.reduce((n, i) => n.plus(i.subtotal), new Decimal(0)),
    discount = items.reduce((n, i) => n.plus(i.discount), new Decimal(0)),
    amount = subtotal.minus(discount);
  if (subtotal.gte("1000000000000") || amount.lte(0))
    throw new Error("Quotation total must be positive and below INR 1 trillion");
  return {
    items,
    subtotal: subtotal.toFixed(2),
    discount: discount.toFixed(2),
    amount: amount.toFixed(2),
    quantity: items.reduce((n, i) => n.plus(i.quantity), new Decimal(0)).toFixed(3),
  };
}
