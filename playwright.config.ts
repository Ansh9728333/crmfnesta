import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "./test-results/public",
  use: { baseURL: "http://127.0.0.1:3000" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" } },
  ],
  webServer: {
    command: "npm run start -- --hostname 127.0.0.1",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
    env: {
      DATABASE_URL: "",
      DIRECT_URL: "",
      DATABASE_SSL_CA: "",
      VERCEL_OIDC_TOKEN: "",
      BETTER_AUTH_SECRET: "",
      BETTER_AUTH_URL: "http://127.0.0.1:3000",
      NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3000",
      SUPABASE_URL: "",
      SUPABASE_SERVICE_ROLE_KEY: "",
    },
  },
});
