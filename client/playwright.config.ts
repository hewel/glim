import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:9143",
    channel: "chrome",
  },
  webServer: [
    {
      command: "gleam run",
      cwd: "..",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      url: "http://127.0.0.1:9143",
    },
  ],
  workers: 1,
});
