// Test 10 (v1.50): inside the iPhone app a backup is handed to the real share
// sheet — written to a file first, then shared by its address — and the update
// check, which belongs to the web app, is not offered.
import { test, expect } from '@playwright/test';
import { openApp, openSettings, watchErrors, fakeNative, nativeCalls } from './_app.js';

test('in the iPhone app a backup goes to the native share sheet', async ({ page }) => {
  const errors = watchErrors(page);
  await fakeNative(page, { perm: 'granted' });
  await openApp(page);
  await openSettings(page);

  await expect(page.getByTestId('check-update')).toBeHidden();

  await page.getByTestId('export-backup').click();
  await expect.poll(async () => (await nativeCalls(page, 'Share', 'share')).length).toBe(1);

  const written = (await nativeCalls(page, 'Filesystem', 'writeFile')).filter((c) => c.arg.directory === 'CACHE');
  expect(written).toHaveLength(1);
  expect(written[0].arg.path).toMatch(/\.json$/);
  // The file holds the backup itself (base64 of the JSON).
  const habits = await page.evaluate((b64) => JSON.parse(decodeURIComponent(escape(atob(b64)))).habits.length, written[0].arg.data);
  expect(habits).toBe(1);

  const shared = (await nativeCalls(page, 'Share', 'share'))[0].arg;
  expect(shared.files).toEqual(['file:///phone/CACHE/' + written[0].arg.path]);

  expect(errors).toEqual([]);
});
