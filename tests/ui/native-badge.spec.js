// Test 9 (v1.50): inside the iPhone app the count on the icon is set through the
// native badge plugin (a web view has no Badging API), and stays a choice.
import { test, expect } from '@playwright/test';
import { openApp, openSettings, watchErrors, fakeNative, nativeCalls } from './_app.js';

test('in the iPhone app the icon badge goes through the native plugin', async ({ page }) => {
  const errors = watchErrors(page);
  await fakeNative(page, { perm: 'granted' });
  await openApp(page);
  await openSettings(page);
  const toggle = page.getByTestId('badge-toggle');

  // Allowed, but not asked for: no number.
  await expect(toggle).toBeEnabled();
  await expect(toggle).toHaveAttribute('data-on', '0');
  expect(await nativeCalls(page, 'Badge', 'set')).toEqual([]);

  // On: the seeded fasting habit is open today.
  await toggle.click();
  await expect(toggle).toHaveAttribute('data-on', '1');
  await expect.poll(async () => (await nativeCalls(page, 'Badge')).at(-1)).toMatchObject({ method: 'set', arg: { count: 1 } });

  // Off: cleared.
  await toggle.click();
  await expect(toggle).toHaveAttribute('data-on', '0');
  await expect.poll(async () => (await nativeCalls(page, 'Badge')).at(-1).method).toBe('clear');

  expect(errors).toEqual([]);
});
