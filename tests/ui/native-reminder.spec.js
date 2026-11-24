// Test 8 (v1.50): inside the iPhone app the daily reminder is planned ON the
// phone — local notifications for the coming days at the chosen time, worded
// from what is open — and the reminder server is never contacted.
import { test, expect } from '@playwright/test';
import { openApp, openSettings, watchErrors, fakeNative, nativeCalls } from './_app.js';

test('in the iPhone app the reminder is planned on the phone, not on the server', async ({ page }) => {
  const errors = watchErrors(page);
  let serverCalls = 0;
  await page.route('**/reminder/**', (route) => { serverCalls++; route.abort(); });
  await page.clock.install({ time: new Date(2026, 10, 24, 10, 0, 0) });   // a morning: tonight's 20:00 is still ahead
  await fakeNative(page, { perm: 'prompt', grant: true });
  await openApp(page);
  await openSettings(page);

  await page.getByTestId('reminder-toggle').click();
  await expect(page.getByTestId('reminder-row')).toHaveAttribute('data-on', '1');

  // Thirty days are planned, tonight first, each at 20:00, each naming what is open.
  await expect.poll(async () => (await nativeCalls(page, 'LocalNotifications', 'schedule')).length).toBeGreaterThan(0);
  const planned = (await nativeCalls(page, 'LocalNotifications', 'schedule')).at(-1).arg.notifications;
  expect(planned).toHaveLength(30);
  expect(new Set(planned.map((p) => p.id)).size).toBe(30);
  const times = await page.evaluate((list) => list.map((p) => { const d = new Date(p.schedule.at); return d.getHours() + ':' + d.getMinutes(); }), planned);
  expect(new Set(times)).toEqual(new Set(['20:0']));
  const first = await page.evaluate((iso) => new Date(iso).getDate(), planned[0].schedule.at);
  expect(first).toBe(24);
  expect(planned[0].body).toContain('Intermittent Fasting');

  // A new time moves them.
  await page.getByTestId('reminder-time').fill('07:30');
  await expect.poll(async () => {
    const last = (await nativeCalls(page, 'LocalNotifications', 'schedule')).at(-1).arg.notifications[0];
    return page.evaluate((iso) => { const d = new Date(iso); return d.getHours() + ':' + d.getMinutes(); }, last.schedule.at);
  }).toBe('7:30');

  // Off: everything planned is cancelled and nothing new is planned.
  await page.getByTestId('reminder-toggle').click();
  await expect(page.getByTestId('reminder-row')).toHaveAttribute('data-on', '0');
  await expect.poll(async () => (await nativeCalls(page, 'LocalNotifications')).filter((c) => c.method === 'cancel' || c.method === 'schedule').at(-1).method).toBe('cancel');

  expect(serverCalls).toBe(0);
  expect(errors).toEqual([]);
});
