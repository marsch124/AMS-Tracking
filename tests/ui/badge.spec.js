// Test 3: the icon badge is a choice. Allowing notifications (which the daily
// reminder does) must NOT put a number on the icon by itself; switching the
// badge on shows the count of open habits; switching it off clears it.
import { test, expect } from '@playwright/test';
import { openApp, openSettings, watchErrors, fakeServiceWorker } from './_app.js';

test.use({ permissions: ['notifications'] });

test('stays off after notifications are allowed, shows the count when on, clears when off', async ({ page }) => {
  const errors = watchErrors(page);
  await fakeServiceWorker(page);
  // Record every badge call the app makes: a number for setAppBadge, 0 for clear.
  await page.addInitScript(() => {
    window.__badge = [];
    Object.defineProperty(navigator, 'setAppBadge', { value: async (n) => { window.__badge.push(n); }, configurable: true });
    Object.defineProperty(navigator, 'clearAppBadge', { value: async () => { window.__badge.push(0); }, configurable: true });
  });
  const calls = () => page.evaluate(() => window.__badge);

  await openApp(page);
  await openSettings(page);
  const toggle = page.getByTestId('badge-toggle');

  // Permission is granted (the reminder would have done that) — still no number.
  await expect(toggle).toHaveAttribute('data-on', '0');
  expect((await calls()).filter((n) => n > 0)).toEqual([]);

  // Switched on: the seeded fasting habit is open today, so the count is 1.
  await toggle.click();
  await expect(toggle).toHaveAttribute('data-on', '1');
  await expect.poll(async () => (await calls()).at(-1)).toBe(1);

  // Switched off: cleared at once.
  await toggle.click();
  await expect(toggle).toHaveAttribute('data-on', '0');
  await expect.poll(async () => (await calls()).at(-1)).toBe(0);

  expect(errors).toEqual([]);
});
