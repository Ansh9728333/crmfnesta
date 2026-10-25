import { describe, expect, it } from "vitest";
import { readBoundedText } from "../../src/lib/request-body";

function streamed(chunks: Uint8Array[], cancel?: () => void) {
  return new Request("http://localhost/api/test", {
    method: "POST",
    body: new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(chunk);
      },
      cancel,
    }),
    duplex: "half",
  } as RequestInit);
}
describe("bounded request bodies", () => {
  it("reads a valid body at the exact byte limit", async () => {
    const request = new Request("http://localhost", { method: "POST", body: "₹" });
    expect(await readBoundedText(request, 3)).toBe("₹");
  });
  it("counts UTF-8 bytes rather than JavaScript characters", async () => {
    await expect(
      readBoundedText(new Request("http://localhost", { method: "POST", body: "₹" }), 2),
    ).rejects.toMatchObject({ status: 413 });
  });
  it("cancels chunked bodies immediately when they exceed the limit", async () => {
    let cancelled = false;
    await expect(
      readBoundedText(
        streamed([new Uint8Array(3), new Uint8Array(3)], () => {
          cancelled = true;
        }),
        5,
      ),
    ).rejects.toMatchObject({ status: 413 });
    expect(cancelled).toBe(true);
  });
  it("rejects an oversized declared length before reading", async () => {
    const request = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Length": "999999" },
      body: "small",
    });
    await expect(readBoundedText(request, 5)).rejects.toMatchObject({ status: 413 });
  });
  it("rejects invalid UTF-8 without exposing decoder details", async () => {
    const request = new Request("http://localhost", {
      method: "POST",
      body: new Uint8Array([255]),
    });
    await expect(readBoundedText(request, 5)).rejects.toMatchObject({
      status: 400,
      message: "Invalid request body",
    });
  });
});
