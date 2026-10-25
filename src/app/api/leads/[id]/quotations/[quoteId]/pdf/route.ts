import { apiResponse } from "@/lib/http";
import { getPresalesService } from "@/lib/presales";
import { quotationPdf } from "@/lib/presales/pdf";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; quoteId: string }> },
) {
  return apiResponse(async () => {
    const { id, quoteId } = await params,
      quote = await getPresalesService().quotationDetail(request.headers, id, quoteId),
      bytes = await quotationPdf(quote);
    return new Response(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="SiteFlow-quotation-V${quote.revision}.pdf"`,
      },
    });
  });
}
