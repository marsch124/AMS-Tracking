// Test (v1.51): in the iPhone app, Siri and the Home Screen menu leave "start" /
// "stop" steps with the moment they were asked; the app applies them in that
// order when it opens — keeping Siri's times — and tells the native side how the
// fast stands, so Siri can answer and the menu offers the step that fits.
import { test, expect } from '@playwright/test';
import { openApp, watchErrors, fakeNative, nativeCalls } from './_app.js';

test('Siri and menu steps are applied in order, with their own times', async ({ page }) => {
  const errors = watchErrors(page);
  const now = Date.now();
  const t1 = now - 20 * 3600e3;   // Siri: start, yesterday
  const t2 = now - 4 * 3600e3;    // Siri: stop
  const t3 = now - 1 * 3600e3;    // Siri: start again
  const tLate = now - 30 * 60e3;  // a stray start while that fast runs: does nothing
  await fakeNative(page, {
    perm: 'granted',
    steps: [ // out of order on purpose
      { a: 'stop', t: t2, src: 'siri' },
      { a: 'start', t: tLate, src: 'siri' },
      { a: 'start', t: t1, src: 'siri' },
      { a: 'start', t: t3, src: 'siri' },
    ],
  });
  await openApp(page);   // first start: the seeded "Intermittent Fasting" habit

  const sessions = () => page.evaluate(() => state.habits[0].sessions.map((x) => ({ s: x.s, e: x.e })));
  await expect.poll(sessions).toEqual([{ s: t1, e: t2 }, { s: t3, e: null }]);

  // The native side knows the running fast.
  await expect.poll(async () => {
    const calls = await nativeCalls(page, 'AMSFasting', 'setStatus');
    return calls.length && calls[calls.length - 1].arg.since;
  }).toBe(t3);

  // A menu tap "Stop Fasting" while the app is open ends it now.
  await page.evaluate(() => { window.__native.steps.push({ a: 'stop', t: Date.now(), src: 'menu' }); });
  await page.evaluate(() => takeFastSteps());
  const after = await sessions();
  expect(after[1].e).toBeGreaterThan(t3);
  await expect.poll(async () => {
    const calls = await nativeCalls(page, 'AMSFasting', 'setStatus');
    return calls[calls.length - 1].arg.since;
  }).toBe(null);

  expect(errors).toEqual([]);
});
