// Test 11 (v1.50): inside the iPhone app every change is also written to a file
// in the app's own folder, and a start that finds the web view's storage empty
// takes the data back from that file. iOS may clear a web view's storage; it
// does not clear the app's files.
import { test, expect } from '@playwright/test';
import { openApp, watchErrors, fakeNative } from './_app.js';

const FILE = 'LIBRARY/amsTracking.v1.json';

test('in the iPhone app the data has a safety copy and comes back from it', async ({ page }) => {
  const errors = watchErrors(page);
  const saved = {
    version: 1,
    settings: { layout: 'list', theme: 'auto' },
    aspirations: [],
    habits: [{ id: 'hsaved0001', name: 'Rescued habit', icon: 'apple', color: '#2fa96d', type: 'daily', days: [true, true, true, true, true, true, true], done: {}, sessions: [] }],
  };
  await fakeNative(page, { perm: 'granted', files: { [FILE]: JSON.stringify(saved) } });
  await openApp(page);

  // Storage was empty, the file was there: the habit from the file is on screen.
  await expect(page.getByTestId('habit-name')).toHaveText(['Rescued habit']);

  // A change is written back to the file.
  await page.evaluate(() => { state.habits[0].name = 'Renamed habit'; save(); });
  await expect.poll(() => page.evaluate((f) => JSON.parse(window.__native.files[f]).habits[0].name, FILE)).toBe('Renamed habit');

  expect(errors).toEqual([]);
});
