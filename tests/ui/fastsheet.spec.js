// Test 4 (v1.46): the goal is set once, in Edit habit. Editing a running fast
// shows the Started time only — no "goal for this fast" chips — and saving it
// keeps a goal the fast already had.
import { test, expect } from '@playwright/test';
import { openApp, watchErrors } from './_app.js';

test('a running fast is edited without goal chips', async ({ page }) => {
  const errors = watchErrors(page);
  await openApp(page);

  // Start a fast on the seeded fasting habit, an hour ago, with an old per-fast goal.
  await page.evaluate(() => {
    const habit = state.habits.find((h) => h.type === 'timer');
    const fast = { s: Date.now() - 3600e3, g: 18 };
    habit.sessions = [...(habit.sessions || []), fast];
    openFastSheet(habit, fast, true);
  });

  const sheet = page.getByTestId('sheet-fast');
  await expect(sheet).toBeVisible();
  await expect(page.getByTestId('fast-start')).toBeVisible();
  await expect(sheet.locator('.goal-chip')).toHaveCount(0);

  await page.getByTestId('fast-save').click();
  await expect(sheet).toBeHidden();
  const g = await page.evaluate(() => state.habits.find((h) => h.type === 'timer').sessions.at(-1).g);
  expect(g).toBe(18);

  expect(errors).toEqual([]);
});
