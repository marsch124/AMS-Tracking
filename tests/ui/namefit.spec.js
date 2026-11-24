// Test 12 (v1.50): a name that does not fit its card is made smaller, not cut
// off. Found on the first simulator run of the iPhone app: with the 32-point
// icons the fasting card showed "Intermittent Fas…". The fasting card has the
// narrowest name column, and an iPhone's text is a point larger (17) than this
// browser's (16) — so the test sets 17, where the cut really happens.
import { test, expect } from '@playwright/test';
import { openApp, watchErrors, fakeServiceWorker } from './_app.js';

test('a long name on the fasting card is made smaller instead of cut off', async ({ page }) => {
  const errors = watchErrors(page);
  await fakeServiceWorker(page);
  await openApp(page);

  await page.evaluate(() => {
    document.documentElement.style.fontSize = '17px';
    const base = { icon: 'moon', color: '#7a5af8', type: 'timer', goalHours: 16, days: [true, true, true, true, true, true, true], done: {}, sessions: [] };
    state.habits = [
      { ...base, id: 'tfit000001', name: 'Intermittent Fasting' },
      { ...base, id: 'tfit000002', name: 'Fasting window' },
      { ...base, id: 'tfit000003', name: 'Fasta' },
    ];
    renderToday();
  });

  const names = page.getByTestId('habit-name');
  await expect(names).toHaveCount(3);
  const clipped = await names.evaluateAll((els) => els.map((el) => el.scrollWidth > el.clientWidth));
  expect(clipped).toEqual([false, false, false]);
  // A short name is left at full size.
  const sizes = await names.evaluateAll((els) => els.map((el) => parseFloat(getComputedStyle(el).fontSize)));
  expect(sizes[2]).toBe(17);
  expect(sizes[0]).toBeLessThan(17);

  expect(errors).toEqual([]);
});
