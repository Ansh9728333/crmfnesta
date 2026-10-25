import { describe, expect, it } from "vitest";
import { databaseTls } from "../../src/lib/db/tls";

describe("database transport security", () => {
  it("requires verified certificates remotely even when a URL requests weaker SSL", () => {
    expect(databaseTls("postgres://user:password@db.example.test/crm?sslmode=require")).toEqual({
      rejectUnauthorized: true,
    });
    expect(databaseTls("postgres://user:password@db.example.test/crm?sslmode=disable")).toEqual({
      rejectUnauthorized: true,
    });
  });
  it("supports the project's trusted CA without disabling verification", () => {
    expect(databaseTls("postgres://db.example.test/crm", "test-ca")).toEqual({
      rejectUnauthorized: true,
      ca: "test-ca",
    });
  });
  it("allows only literal loopback hosts without TLS for isolated tests", () => {
    for (const host of ["localhost", "127.0.0.1", "[::1]"])
      expect(databaseTls(`postgres://${host}/crm`)).toBe(false);
    expect(databaseTls("postgres://localhost.example.test/crm")).toEqual({
      rejectUnauthorized: true,
    });
  });
});
