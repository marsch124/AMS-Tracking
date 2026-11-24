// Test 7 (v1.49): the habit icon in front of a name on Today is the large one
// Martin chose (32 points at the standard text size = 1.88x the base text size),
// and it costs nothing: a long name is still shown in full, and the card is no
// taller than a card with a short name.
import { test, expect } from '@playwright/test';
import { openApp, watchErrors, fakeServiceWorker } from './_app.js';

test('habit icons on Today are large, and a long name still fits', async ({ page }) => {
  const errors = watchErrors(page);
  await fakeServiceWorker(page);
  await openApp(page);

  // Two check-off habits beside the seeded fasting one: a short name and a long one.
  await page.evaluate(() => {
    const base = { icon: 'apple', color: '#2fa96d', type: 'daily', days: [true, true, true, true, true, true, true], done: {}, sessions: [] };
    state.habits.push({ ...base, id: 'testshort1', name: 'Walk' });
    state.habits.push({ ...base, id: 'testlong01', name: 'A rather long habit name here' });
    renderToday();
  });

  const icons = page.getByTestId('habit-icon');
  await expect(icons).toHaveCount(3);
  const sizes = await page.evaluate(() => {
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    return [...document.querySelectorAll('[data-testid="habit-icon"] svg')].map((svg) => svg.getBoundingClientRect().height / rem);
  });
  for (const size of sizes) {
    expect(size).toBeGreaterThan(1.85);
    expect(size).toBeLessThan(1.92);
  }

  const names = page.getByTestId('habit-name');
  const clipped = await names.evaluateAll((els) => els.map((el) => el.scrollWidth > el.clientWidth));
  expect(clipped).toEqual([false, false, false]);

  // Same height for the short-named and the long-named check-off card.
  const heights = await names.evaluateAll((els) => els.slice(1).map((el) => Math.round(el.closest('.habit-card').getBoundingClientRect().height)));
  expect(heights[1]).toBe(heights[0]);

  expect(errors).toEqual([]);
});
