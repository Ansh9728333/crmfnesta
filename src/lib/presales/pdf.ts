import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { presalesService } from "./service";
type Quote = Awaited<ReturnType<ReturnType<typeof presalesService>["quotationDetail"]>>;
export async function quotationPdf(quote: Quote) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(
    await readFile(join(process.cwd(), "public/fonts/montserrat-latin.woff")),
    { subset: true },
  );
  pdf.setTitle(`SiteFlow Quotation V${quote.revision}`);
  pdf.setAuthor(quote.snapshot?.company ?? "SiteFlow CRM");
  pdf.setCreationDate(quote.createdAt);
  let page = pdf.addPage([595.28, 841.89]),
    y = 790;
  const green = rgb(0.08, 0.28, 0.22),
    charcoal = rgb(0.16, 0.19, 0.18);
  function newPage() {
    page = pdf.addPage([595.28, 841.89]);
    y = 790;
  }
  function line(text: string, size = 10, color = charcoal) {
    if (y < 65) newPage();
    page.drawText(text, { x: 44, y, size, font, color });
    y -= size + 8;
  }
  function paragraph(text: string, size = 10) {
    for (const part of text.replace(/[\r\t\u0000-\u0008\u000b-\u001f]/g, " ").split("\n")) {
      let current = "";
      for (const word of part.split(/\s+/)) {
        const candidate = current ? `${current} ${word}` : word;
        if (font.widthOfTextAtSize(candidate, size) > 500 && current) {
          line(current, size);
          current = "";
        }
        for (const char of current ? ` ${word}` : word) {
          if (font.widthOfTextAtSize(current + char, size) > 500) {
            line(current, size);
            current = "";
          }
          current += char;
        }
      }
      line(current, size);
    }
  }
  line("SiteFlow CRM", 12, green);
  line(quote.snapshot?.company ?? "Quotation", 22, green);
  line(`QUOTATION V${quote.revision}  |  INR`, 12);
  line(`Reference: ${quote.id}`, 8);
  line(`Issued: ${quote.createdAt.toISOString().slice(0, 10)}`, 9);
  y -= 12;
  paragraph(`Customer: ${quote.snapshot?.client ?? "Legacy quotation"}`);
  paragraph(`Mobile: ${quote.snapshot?.mobile ?? ""}`);
  paragraph(`Project: ${quote.snapshot?.project ?? ""}`);
  paragraph(`Site: ${quote.snapshot?.address ?? ""}`);
  y -= 12;
  for (const [index, item] of quote.items.entries()) {
    if (y < 160) newPage();
    paragraph(`${index + 1}. ${item.name ?? "Item"}`, 12);
    if (item.description) paragraph(item.description);
    paragraph(`Company: ${quote.snapshot?.company ?? ""}`, 9);
    paragraph(
      `Qty ${item.quantity} x INR ${item.unitPrice}  |  Subtotal INR ${item.subtotal ?? "—"}`,
      9,
    );
    paragraph(`Discount INR ${item.discount}  |  Final INR ${item.amount ?? "—"}`, 10);
    y -= 10;
  }
  if (y < 160) newPage();
  line(`Subtotal: INR ${quote.subtotal ?? quote.amount}`, 11);
  line(`Discount: INR ${quote.discount ?? "0.00"}`, 11);
  line(`FINAL AMOUNT: INR ${quote.amount}`, 16, green);
  if (quote.customerNotes) {
    y -= 10;
    line("Customer notes", 11, green);
    paragraph(quote.customerNotes);
  }
  if (quote.revisionReason) {
    y -= 10;
    line("Revision reason", 11, green);
    paragraph(quote.revisionReason);
  }
  const pages = pdf.getPages();
  pages.forEach((p, i) =>
    p.drawText(`SiteFlow CRM | V${quote.revision} | ${i + 1} / ${pages.length}`, {
      x: 44,
      y: 30,
      size: 8,
      font,
      color: charcoal,
    }),
  );
  return pdf.save();
}
