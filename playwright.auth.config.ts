import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser-auth",
  outputDir: "./test-results/auth",
  timeout: 120000,
  workers: 1,
  use: { baseURL: "http://127.0.0.1:3100", actionTimeout: 15000 },
  // Separate documented test-network IPs keep projects independent while retaining
  // the real five-attempt production login limiter.
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        extraHTTPHeaders: { "x-vercel-forwarded-for": "192.0.2.20" },
      },
    },
    {
      name: "mobile",
      use: {
        ...devices["iPhone 13"],
        defaultBrowserType: "chromium",
        extraHTTPHeaders: { "x-vercel-forwarded-for": "192.0.2.21" },
      },
    },
  ],
  webServer: {
    command: "npx tsx tests/support/browser-server.ts",
    url: "http://127.0.0.1:3100/login",
    timeout: 120000,
    reuseExistingServer: false,
  },
});
