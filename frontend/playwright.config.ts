import { defineConfig, devices } from '@playwright/test';

// The card in a page of its own (test/harness) against the fake Home Assistant from test/mock-hass.ts.
export default defineConfig({
  testDir: 'test/e2e',
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run harness',
    url: 'http://localhost:5179/test/harness/index.html',
    reuseExistingServer: !process.env.CI,
  },
  use: { baseURL: 'http://localhost:5179', timezoneId: 'UTC', locale: 'en-US' },
  snapshotPathTemplate: '{testDir}/__screenshots__/{platform}/{arg}{ext}',
  updateSnapshots: 'missing',
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.01 } },
});
