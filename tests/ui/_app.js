// Shared helpers for the UI tests. Controls are found by data-testid ONLY, never
// by the words on them — so the wording can change freely and a test only fails
// when something has actually stopped working.
import { expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const root = new URL('../../', import.meta.url);
export const read = (file) => readFileSync(new URL(file, root), 'utf8');
export const APP_VERSION = read('js/app.js').match(/const APP_VERSION = '([^']+)'/)[1];

// Open the app fresh and wait until it has finished starting.
export async function openApp(page) {
  await page.goto('/index.html');
  await settled(page);
}

// A genuine restart: the app reads localStorage again and runs its start-up.
export async function restartApp(page) {
  await page.reload();
  await settled(page);
}

async function settled(page) {
  await expect(page.locator('html[data-ready="1"]')).toBeAttached({ timeout: 20_000 });
}

export async function openSettings(page) {
  await page.getByTestId('settings').click();
  await expect(page.getByTestId('sheet-settings')).toBeVisible();
}

// Collect everything the page complains about; a test ends by asserting it is empty.
export function watchErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  return errors;
}

// The real service worker is blocked by the config (see playwright.config.js), so
// the app gets a stand-in: a registration with a pushManager that hands out one
// fixed subscription. `opts.api` points the app at a reminder "server" the test
// answers itself with page.route().
export async function fakeServiceWorker(page, opts = {}) {
  await page.addInitScript((o) => {
    if (o.api) window.AMS_REMINDER_API = o.api;
    const sub = {
      endpoint: 'https://push.test/sub-1',
      expirationTime: null,
      keys: { p256dh: 'BPUBLICKEY', auth: 'AUTH' },
      toJSON() { return { endpoint: this.endpoint, expirationTime: null, keys: this.keys }; },
      async unsubscribe() { window.__pushSubscribed = false; return true; },
    };
    const reg = {
      scope: location.origin + '/',
      active: null, installing: null, waiting: null,
      addEventListener() {},
      async update() {},
      async showNotification() {},
      pushManager: {
        async getSubscription() { return window.__pushSubscribed ? sub : null; },
        async subscribe() { window.__pushSubscribed = true; return sub; },
      },
    };
    const fake = {
      ready: Promise.resolve(reg),
      controller: null,
      addEventListener() {},
      async register() { return reg; },
      async getRegistration() { return reg; },
    };
    Object.defineProperty(navigator, 'serviceWorker', { value: fake, configurable: true });
  }, opts);
}
