// Test 2: the daily reminder — on at a chosen time, kept across a restart, moved,
// and off again. The reminder server is answered by the test itself, so what is
// checked is exactly what the phone would SEND it: the subscription, the time,
// the time zone — and a DELETE when the reminder is turned off.
import { test, expect } from '@playwright/test';
import { openApp, restartApp, openSettings, watchErrors, fakeServiceWorker } from './_app.js';

test.use({ permissions: ['notifications'] });

test('turns on at a chosen time, survives a restart, moves, and turns off', async ({ page }) => {
  const errors = watchErrors(page);
  const calls = [];
  // The fake server must answer like the real worker does — with CORS headers —
  // or the browser throws its reply away and the app rightly reports a failure.
  const cors = {
    'Access-Control-Allow-Origin': 'http://127.0.0.1:4176',
    'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  await page.route('https://reminder.test/**', async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    let body = null;
    try { body = req.postDataJSON(); } catch { body = null; }
    calls.push({ method: req.method(), path: new URL(req.url()).pathname, body });
    await route.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: '{"ok":true}' });
  });
  const puts = () => calls.filter((c) => c.method === 'PUT' && /^\/reminder\/[a-z0-9]{8,40}$/.test(c.path));
  const deletes = () => calls.filter((c) => c.method === 'DELETE');

  await fakeServiceWorker(page, { api: 'https://reminder.test' });
  await openApp(page);
  await openSettings(page);

  const row = page.getByTestId('reminder-row');
  const time = page.getByTestId('reminder-time');
  await expect(row).toHaveAttribute('data-on', '0');
  await expect(time).toHaveValue('20:00');           // his usual hour is the default

  // Choose a time, turn it on: the server gets the subscription, the time, the zone.
  await time.fill('20:30');
  await page.getByTestId('reminder-toggle').click();
  await expect(row).toHaveAttribute('data-on', '1');
  await expect.poll(() => puts().length).toBe(1);
  expect(puts()[0].body.time).toBe('20:30');
  expect(typeof puts()[0].body.tz).toBe('string');
  expect(puts()[0].body.tz.length).toBeGreaterThan(0);
  expect(puts()[0].body.subscription.endpoint).toBe('https://push.test/sub-1');
  expect(puts()[0].body.subscription.keys).toEqual({ p256dh: 'BPUBLICKEY', auth: 'AUTH' });

  // A restart keeps it on, at the chosen time.
  await restartApp(page);
  await openSettings(page);
  await expect(row).toHaveAttribute('data-on', '1');
  await expect(time).toHaveValue('20:30');

  // Moving the time while on sends the new time.
  await time.fill('19:45');
  await expect.poll(() => puts().length).toBe(2);
  expect(puts()[1].body.time).toBe('19:45');
  expect(puts()[1].path).toBe(puts()[0].path);      // same phone, same id

  // Off: the server is told to forget this phone.
  await page.getByTestId('reminder-toggle').click();
  await expect(row).toHaveAttribute('data-on', '0');
  await expect.poll(() => deletes().length).toBe(1);
  expect(deletes()[0].path).toBe(puts()[0].path);

  expect(errors).toEqual([]);
});
