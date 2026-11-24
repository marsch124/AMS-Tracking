// Test 6: Today is the habit cards and nothing else. The greeting, the version
// pill, the segmented day bar and its "x of y done" counter were removed in
// v1.48 on Martin's request — the cards are the first thing on the screen, and
// the version is read in Settings instead.
import { test, expect } from '@playwright/test';
import { APP_VERSION, openApp, openSettings, watchErrors, fakeServiceWorker } from './_app.js';

test('Today starts with the habit cards, and the version lives in Settings', async ({ page }) => {
  const errors = watchErrors(page);
  await fakeServiceWorker(page);
  await openApp(page);

  const list = page.getByTestId('habit-list');
  await expect(list).toBeVisible();
  // Nothing sits above the cards: the list is the first element of the screen.
  expect(await list.evaluate((el) => el.previousElementSibling === null)).toBe(true);
  await expect(page.getByTestId('version-pill')).toHaveCount(0);

  await openSettings(page);
  await expect(page.getByTestId('app-version')).toContainText('v' + APP_VERSION);

  expect(errors).toEqual([]);
});
