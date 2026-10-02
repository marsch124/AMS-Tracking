// UI tests — Martin's standing rule (2026-09-16): they run in CI on every push,
// every control is found by its data-testid (never by its words), and the suite
// grows ONE test at a time, each one seen to FAIL before it is trusted.
// Local: `npm run test:ui`. The app is plain static files, so the web server is
// Python's built-in one — present on every Mac and every GitHub runner.
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/ui',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  // A test that passes on a retry is a flaky test, not a green one.
  retries: 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4176',
    // A red run has to be diagnosable from what it left behind.
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // 🚨 Service workers OFF. The app installs one, and it would serve its cached
    // copy on every load after the first — a test that reloads would then test
    // the CACHE, not the code just changed. The tests install a small stand-in
    // (tests/ui/_app.js) so the push/subscribe path can still be exercised.
    serviceWorkers: 'block',
  },
  // The phone is where he lives; test at its size.
  // 🪤 channel 'chromium' = the FULL Chromium build in new-headless mode. Playwright's
  // default headless shell answers Notification.permission with "denied" whatever
  // the context was granted — the reminder test cannot turn on without it.
  projects: [{ name: 'iphone-chromium', use: { ...devices['iPhone 13'], browserName: 'chromium', channel: 'chromium' } }],
  webServer: {
    command: 'python3 -m http.server 4176 --bind 127.0.0.1',
    url: 'http://127.0.0.1:4176/index.html',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
