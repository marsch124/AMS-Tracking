// Test 1: the app starts cleanly, and the release numbers agree with each other.
// The second half is the release checklist as a test — APP_VERSION, version.json,
// the ?v= on every asset link, and the service worker's cache name have cost real
// releases when one of them was forgotten.
import { test, expect } from '@playwright/test';
import { APP_VERSION, read, openApp, watchErrors, fakeServiceWorker } from './_app.js';

test('starts without errors and shows one consistent version', async ({ page }) => {
  const errors = watchErrors(page);
  await fakeServiceWorker(page);
  await openApp(page);

  await expect(page.getByTestId('version-pill')).toHaveText('v' + APP_VERSION);
  expect(JSON.parse(read('version.json')).version).toBe(APP_VERSION);

  const assetVersions = new Set([...read('index.html').matchAll(/\?v=(\d+)/g)].map((m) => m[1]));
  expect([...assetVersions]).toHaveLength(1);
  expect(read('sw.js')).toContain(`const CACHE_NAME = 'ams-tracking-v${[...assetVersions][0]}';`);

  expect(errors).toEqual([]);
});
