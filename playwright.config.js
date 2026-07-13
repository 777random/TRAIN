import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  retries: 1,
  use: {
    baseURL: 'http://localhost:8080',
    headless: true,
    viewport: { width: 390, height: 844 }, // iPhone 14 — TRAIN ist primär Mobile
  },
  webServer: {
    command: 'npx serve . -p 8080',
    port: 8080,
    reuseExistingServer: true,
  },
});
