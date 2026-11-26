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

// The iPhone app (v1.50) is these same files inside a native shell, where
// Capacitor's bridge is present and four things go through native plugins. This
// stand-in is that bridge: every plugin call is recorded in window.__native.calls
// as { plugin, method, arg }, files "written" are kept in window.__native.files.
//   opts.perm   — notification permission at start: 'prompt' | 'granted' | 'denied'
//   opts.grant  — what the system prompt answers when the app asks (default true)
//   opts.files  — files already on the "phone", keyed 'DIRECTORY/path'
//   opts.steps  — v1.51: Siri / Home Screen menu steps waiting in the app ({ a, t, src });
//                 a test adds more by pushing to window.__native.steps
export async function fakeNative(page, opts = {}) {
  await page.addInitScript((o) => {
    const n = (window.__native = { calls: [], files: { ...(o.files || {}) }, perm: o.perm || 'prompt', steps: [...(o.steps || [])] });
    const plugin = (name, methods) => new Proxy({}, {
      get: (_, method) => async (arg) => {
        n.calls.push({ plugin: name, method, arg: arg === undefined ? null : JSON.parse(JSON.stringify(arg)) });
        if (methods[method]) return methods[method](arg || {});
        return {};
      },
    });
    const plugins = {
      LocalNotifications: plugin('LocalNotifications', {
        checkPermissions: () => ({ display: n.perm }),
        requestPermissions: () => { n.perm = o.grant === false ? 'denied' : 'granted'; return { display: n.perm }; },
      }),
      Badge: plugin('Badge', {}),
      Share: plugin('Share', {}),
      Filesystem: plugin('Filesystem', {
        writeFile: (a) => { n.files[a.directory + '/' + a.path] = a.data; return { uri: 'file:///phone/' + a.directory + '/' + a.path }; },
        readFile: (a) => {
          const key = a.directory + '/' + a.path;
          if (!(key in n.files)) throw new Error('File does not exist');
          return { data: n.files[key] };
        },
      }),
      SystemBars: plugin('SystemBars', {}),
      AMSFasting: plugin('AMSFasting', {
        takePending: () => { const steps = n.steps; n.steps = []; return { steps }; },
      }),
    };
    window.Capacitor = {
      isNativePlatform: () => true,
      getPlatform: () => 'ios',
      registerPlugin: (name) => plugins[name],
      Plugins: plugins,
    };
  }, opts);
}

export const nativeCalls = (page, plugin, method) =>
  page.evaluate(([p, m]) => window.__native.calls.filter((c) => c.plugin === p && (!m || c.method === m)), [plugin, method]);

