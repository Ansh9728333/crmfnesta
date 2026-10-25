import { describe, expect, it } from "vitest";
import {
  companies,
  glassActivities,
  postSalesStages,
  preSalesStages,
} from "../../src/lib/domain/workflows";
import { authEnvSchema } from "../../src/lib/env";

describe("business invariants", () => {
  it("preserves the three company identities and products", () => {
    expect(companies.map((c) => [c.name, c.product])).toEqual([
      ["Finesta Home", "Windows"],
      ["IBAX", "Shower Partitions"],
      ["S-Grip", "Railings"],
    ]);
  });
  it("preserves ordered shared workflow boundaries", () => {
    expect(preSalesStages).toHaveLength(7);
    expect(preSalesStages[0]).toBe("Lead Generated");
    expect(preSalesStages.at(-1)).toBe("Order Won or Lost");
    expect(postSalesStages).toHaveLength(16);
    expect(postSalesStages.indexOf("Material Dispatched")).toBeLessThan(
      postSalesStages.indexOf("Material Delivered"),
    );
    expect(postSalesStages.at(-1)).toBe("Testimonial and Google Review");
    expect(glassActivities).toEqual([
      "Glass Measurement Taken",
      "Glass Template Prepared",
      "Glass Template Approved",
    ]);
  });
});

describe("server authentication configuration validation", () => {
  it("rejects absent credentials and insecure remote URLs", () => {
    expect(authEnvSchema.safeParse({}).success).toBe(false);
    expect(
      authEnvSchema.safeParse({
        DATABASE_URL: "postgres://localhost/db",
        BETTER_AUTH_SECRET: "short",
        BETTER_AUTH_URL: "http://remote.example.com",
        NEXT_PUBLIC_APP_URL: "http://remote.example.com",
      }).success,
    ).toBe(false);
  });
  it("accepts a public HTTPS project or local development instance", () => {
    for (const url of ["https://crm.example.com", "http://127.0.0.1:3000"]) {
      expect(
        authEnvSchema.safeParse({
          DATABASE_URL: "postgres://localhost/db",
          BETTER_AUTH_SECRET: "test-only-secret-at-least-32-characters",
          BETTER_AUTH_URL: url,
          NEXT_PUBLIC_APP_URL: url,
        }).success,
      ).toBe(true);
    }
  });
});
