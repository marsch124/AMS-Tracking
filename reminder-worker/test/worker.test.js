// The worker's tests. The Web Push crypto is checked against the REFERENCE
// implementation (http_ece decrypts what we encrypt; node:crypto verifies the
// VAPID signature), the due-time logic is pinned at its edges, and the minute
// tick and the HTTP surface run end to end against an in-memory KV.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import ece from 'http_ece';
import webpush from 'web-push';
import worker, { encryptPayload, vapidAuthorization, dueVerdict, localClock, runDue, b64u } from '../src/index.js';

const vapid = webpush.generateVAPIDKeys();

function fakeKV() {
  const m = new Map();
  return {
    _m: m,
    async get(k, type) { const e = m.get(k); if (!e) return null; return type === 'json' ? JSON.parse(e.value) : e.value; },
    async getWithMetadata(k, type) {
      const e = m.get(k);
      if (!e) return { value: null, metadata: null };
      return { value: type === 'json' ? JSON.parse(e.value) : e.value, metadata: e.metadata };
    },
    async put(k, v, o) { m.set(k, { value: v, metadata: (o && o.metadata) || null }); },
    async delete(k) { m.delete(k); },
    async list(o) {
      const prefix = (o && o.prefix) || '';
      const keys = [...m.entries()].filter(([k]) => k.startsWith(prefix)).map(([k, e]) => ({ name: k, metadata: e.metadata }));
      return { keys: o && o.limit ? keys.slice(0, o.limit) : keys, list_complete: true };
    },
  };
}

const env = (kv) => ({ REMINDERS: kv || fakeKV(), VAPID_PUBLIC_KEY: vapid.publicKey, VAPID_PRIVATE_KEY: vapid.privateKey, VAPID_SUBJECT: 'mailto:test@example.com' });

// A phone: its ECDH key pair and auth secret, as Safari would hand them out.
function makePhone() {
  const ecdh = crypto.createECDH('prime256v1');
  ecdh.generateKeys();
  const auth = crypto.randomBytes(16);
  return {
    ecdh, auth,
    subscription: {
      endpoint: 'https://web.push.apple.com/QWxs' + crypto.randomBytes(8).toString('hex'),
      keys: { p256dh: ecdh.getPublicKey().toString('base64url'), auth: auth.toString('base64url') },
    },
    decrypt(body) {
      return ece.decrypt(Buffer.from(body), { version: 'aes128gcm', privateKey: ecdh, authSecret: auth.toString('base64url') }).toString('utf8');
    },
  };
}

test('b64u round-trips bytes without padding', () => {
  const bytes = crypto.randomBytes(37);
  const s = b64u.encode(bytes);
  assert.doesNotMatch(s, /[+/=]/);
  assert.deepEqual(Buffer.from(b64u.decode(s)), bytes);
});

test('encryptPayload: the reference decryptor reads our message back', async () => {
  const phone = makePhone();
  const text = JSON.stringify({ title: 'AMS Tracking', body: 'Time to fill in your tracked items — åäö 20:00' });
  const body = await encryptPayload(phone.subscription, text);
  assert.equal(body[20], 65);                             // keyid length = uncompressed P-256 point
  assert.equal(Buffer.from(body.slice(16, 20)).readUInt32BE(0), 4096);  // record size
  assert.equal(phone.decrypt(body), text);
  // every message gets a fresh salt and key pair
  const body2 = await encryptPayload(phone.subscription, text);
  assert.notDeepEqual(Buffer.from(body2.slice(0, 16)), Buffer.from(body.slice(0, 16)));
  assert.equal(phone.decrypt(body2), text);
});

test('encryptPayload refuses malformed subscription keys', async () => {
  const phone = makePhone();
  const bad = { ...phone.subscription, keys: { p256dh: 'AAAA', auth: phone.subscription.keys.auth } };
  await assert.rejects(encryptPayload(bad, 'x'), /bad subscription keys/);
});

test('vapidAuthorization: a valid ES256 JWT for the push origin, 12 h, our key', async () => {
  const header = await vapidAuthorization('https://web.push.apple.com/QWxs', env(), 1_800_000_000);
  const m = header.match(/^vapid t=([^,]+), k=(.+)$/);
  assert.ok(m, 'RFC 8292 header shape');
  assert.equal(m[2], vapid.publicKey);
  const [h, c, sig] = m[1].split('.');
  assert.deepEqual(JSON.parse(Buffer.from(h, 'base64url').toString()), { typ: 'JWT', alg: 'ES256' });
  const claims = JSON.parse(Buffer.from(c, 'base64url').toString());
  assert.equal(claims.aud, 'https://web.push.apple.com');
  assert.equal(claims.exp, 1_800_000_000 + 12 * 3600);
  assert.equal(claims.sub, 'mailto:test@example.com');
  const pub = Buffer.from(vapid.publicKey, 'base64url');
  const key = crypto.createPublicKey({ format: 'jwk', key: { kty: 'EC', crv: 'P-256', x: pub.subarray(1, 33).toString('base64url'), y: pub.subarray(33, 65).toString('base64url') } });
  assert.ok(crypto.verify('sha256', Buffer.from(h + '.' + c), { key, dsaEncoding: 'ieee-p1363' }, Buffer.from(sig, 'base64url')), 'signature verifies');
  // the reference implementation produces the same shape for the same inputs
  const ref = webpush.getVapidHeaders('https://web.push.apple.com', 'mailto:test@example.com', vapid.publicKey, vapid.privateKey, 'aes128gcm');
  assert.match(ref.Authorization, /^vapid t=.+, k=.+$/);
  assert.equal(ref.Authorization.split('k=')[1], vapid.publicKey);
});

test('localClock: Stockholm summer and winter, and midnight rollover', () => {
  assert.deepEqual(localClock(new Date('2026-10-01T18:00:00Z'), 'Europe/Stockholm'), { date: '2026-10-01', minutes: 20 * 60 });   // CEST
  assert.deepEqual(localClock(new Date('2026-12-01T19:00:00Z'), 'Europe/Stockholm'), { date: '2026-12-01', minutes: 20 * 60 });   // CET
  assert.deepEqual(localClock(new Date('2026-10-01T22:30:00Z'), 'Europe/Stockholm'), { date: '2026-10-02', minutes: 30 });
  assert.deepEqual(localClock(new Date('2026-10-01T18:00:00Z'), 'UTC'), { date: '2026-10-01', minutes: 18 * 60 });
});

test('dueVerdict: the edges', () => {
  const at = (minutes) => ({ date: '2026-10-01', minutes });
  const meta = { time: '20:00', tz: 'Europe/Stockholm' };
  assert.equal(dueVerdict(meta, at(19 * 60 + 59)), 'no');          // a minute early
  assert.equal(dueVerdict(meta, at(20 * 60)), 'send');             // on the minute
  assert.equal(dueVerdict(meta, at(20 * 60 + 59)), 'send');        // a late tick still sends
  assert.equal(dueVerdict(meta, at(21 * 60)), 'no');               // an hour late is too late
  assert.equal(dueVerdict({ ...meta, lastSent: '2026-10-01' }, at(20 * 60)), 'no');        // once a day
  assert.equal(dueVerdict({ ...meta, lastSent: '2026-09-30' }, at(20 * 60)), 'send');      // yesterday's send does not count
  assert.equal(dueVerdict({ ...meta, doneDate: '2026-10-01' }, at(20 * 60)), 'skip-done'); // all ticked off: stay quiet
  assert.equal(dueVerdict({ ...meta, doneDate: '2026-09-30' }, at(20 * 60)), 'send');
  assert.equal(dueVerdict({ time: '25:00', tz: 'UTC' }, at(20 * 60)), 'no');
  assert.equal(dueVerdict({ time: '00:00', tz: 'UTC' }, { date: '2026-10-02', minutes: 0 }), 'send');
});

async function storeViaHttp(e, id, subscription, time = '20:00', tz = 'Europe/Stockholm', origin = 'https://marsch124.github.io') {
  return worker.fetch(new Request('https://w.test/reminder/' + id, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Origin: origin },
    body: JSON.stringify({ subscription, time, tz }),
  }), e);
}

test('runDue: sends once at the hour, decryptable by the phone, then stays quiet', async () => {
  const kv = fakeKV();
  const e = env(kv);
  const phone = makePhone();
  assert.equal((await storeViaHttp(e, 'abcdefgh12', phone.subscription)).status, 200);

  const sent = [];
  const fetchFn = async (url, init) => { sent.push({ url, init }); return new Response(null, { status: 201 }); };

  // 19:59 Stockholm: nothing
  let r = await runDue(e, new Date('2026-10-01T17:59:30Z'), fetchFn);
  assert.deepEqual([r.checked, r.sent, sent.length], [1, 0, 0]);
  // 20:00: one push, correctly addressed and headed
  r = await runDue(e, new Date('2026-10-01T18:00:20Z'), fetchFn);
  assert.deepEqual([r.sent, sent.length], [1, 1]);
  assert.equal(sent[0].url, phone.subscription.endpoint);
  assert.equal(sent[0].init.method, 'POST');
  assert.equal(sent[0].init.headers['Content-Encoding'], 'aes128gcm');
  assert.equal(sent[0].init.headers['TTL'], '3600');
  assert.match(sent[0].init.headers['Authorization'], /^vapid t=.+, k=/);
  const payload = JSON.parse(phone.decrypt(sent[0].init.body));
  assert.equal(payload.title, 'AMS Tracking');
  assert.ok(payload.body.length > 0);
  // 20:01 the same day: not again
  r = await runDue(e, new Date('2026-10-01T18:01:00Z'), fetchFn);
  assert.deepEqual([r.sent, sent.length], [0, 1]);
  assert.equal(kv._m.get('sub:abcdefgh12').metadata.lastSent, '2026-10-01');
  // next day 20:00: again
  r = await runDue(e, new Date('2026-10-02T18:00:00Z'), fetchFn);
  assert.deepEqual([r.sent, sent.length], [1, 2]);
});

test('runDue: a phone that reported "done today" is left in peace, and only today', async () => {
  const kv = fakeKV();
  const e = env(kv);
  const phone = makePhone();
  await storeViaHttp(e, 'abcdefgh12', phone.subscription);
  let res = await worker.fetch(new Request('https://w.test/reminder/abcdefgh12/status', {
    method: 'PUT', headers: { 'Content-Type': 'application/json', Origin: 'https://marsch124.github.io' },
    body: JSON.stringify({ date: '2026-10-01', done: true }),
  }), e);
  assert.equal(res.status, 200);
  const sent = [];
  const fetchFn = async (url, init) => { sent.push(url); return new Response(null, { status: 201 }); };
  let r = await runDue(e, new Date('2026-10-01T18:00:00Z'), fetchFn);
  assert.deepEqual([r.quiet, r.sent, sent.length], [1, 0, 0]);
  r = await runDue(e, new Date('2026-10-02T18:00:00Z'), fetchFn);
  assert.deepEqual([r.quiet, r.sent, sent.length], [0, 1, 1]);
  // and "done" can be taken back
  await storeViaHttp(e, 'zyxwvuts98', makePhone().subscription);
  res = await worker.fetch(new Request('https://w.test/reminder/zyxwvuts98/status', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: '2026-10-03', done: true }),
  }), e);
  assert.equal((await res.json()).doneDate, '2026-10-03');
  res = await worker.fetch(new Request('https://w.test/reminder/zyxwvuts98/status', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: '2026-10-03', done: false }),
  }), e);
  assert.equal((await res.json()).doneDate, null);
});

test('runDue: a gone subscription (410) is dropped; a 5xx is retried next minute', async () => {
  const kv = fakeKV();
  const e = env(kv);
  await storeViaHttp(e, 'gone0000001', makePhone().subscription);
  await storeViaHttp(e, 'flaky000001', makePhone().subscription);
  let fail = true;
  const fetchFn = async (url) => {
    if (url === JSON.parse(kv._m.get('sub:gone0000001')?.value || '{}').subscription?.endpoint) return new Response(null, { status: 410 });
    return new Response(null, { status: fail ? 503 : 201 });
  };
  let r = await runDue(e, new Date('2026-10-01T18:00:00Z'), fetchFn);
  assert.deepEqual([r.dropped, r.failed, r.sent], [1, 1, 0]);
  assert.equal(kv._m.has('sub:gone0000001'), false);
  assert.equal(kv._m.get('sub:flaky000001').metadata.lastSent, null);
  fail = false;
  r = await runDue(e, new Date('2026-10-01T18:01:00Z'), fetchFn);
  assert.deepEqual([r.dropped, r.failed, r.sent], [0, 0, 1]);
  assert.equal(kv._m.get('sub:flaky000001').metadata.lastSent, '2026-10-01');
});

test('HTTP: validation, CORS, delete, health', async () => {
  const kv = fakeKV();
  const e = env(kv);
  const phone = makePhone();
  let res;

  res = await worker.fetch(new Request('https://w.test/health'), e);
  assert.equal(res.status, 200);
  assert.equal((await res.json()).ok, true);

  res = await worker.fetch(new Request('https://w.test/reminder/abcdefgh12', { method: 'OPTIONS', headers: { Origin: 'http://localhost:7794' } }), e);
  assert.equal(res.status, 204);
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), 'http://localhost:7794');

  res = await storeViaHttp(e, 'abcdefgh12', phone.subscription, '20:00', 'Europe/Stockholm', 'https://evil.example');
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), 'https://marsch124.github.io');   // never reflected for strangers
  assert.deepEqual(await res.json(), { ok: true, time: '20:00', tz: 'Europe/Stockholm' });
  const stored = kv._m.get('sub:abcdefgh12');
  assert.deepEqual(stored.metadata, { time: '20:00', tz: 'Europe/Stockholm', lastSent: null, doneDate: null });
  assert.equal(JSON.parse(stored.value).subscription.endpoint, phone.subscription.endpoint);

  // an update keeps lastSent/doneDate but takes the new time
  stored.metadata.lastSent = '2026-10-01';
  res = await storeViaHttp(e, 'abcdefgh12', phone.subscription, '19:30');
  assert.equal(res.status, 200);
  assert.deepEqual(kv._m.get('sub:abcdefgh12').metadata, { time: '19:30', tz: 'Europe/Stockholm', lastSent: '2026-10-01', doneDate: null });

  assert.equal((await storeViaHttp(e, 'BAD ID', phone.subscription)).status, 400);
  assert.equal((await storeViaHttp(e, 'abcdefgh12', phone.subscription, '24:00')).status, 400);
  assert.equal((await storeViaHttp(e, 'abcdefgh12', phone.subscription, '20:00', 'Mars/Olympus')).status, 400);
  assert.equal((await storeViaHttp(e, 'abcdefgh12', { endpoint: 'http://not-https', keys: phone.subscription.keys })).status, 400);
  assert.equal((await storeViaHttp(e, 'abcdefgh12', { endpoint: phone.subscription.endpoint })).status, 400);
  res = await worker.fetch(new Request('https://w.test/reminder/abcdefgh12', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: 'not json' }), e);
  assert.equal(res.status, 400);
  res = await worker.fetch(new Request('https://w.test/reminder/unknown0001/status', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: '2026-10-01', done: true }) }), e);
  assert.equal(res.status, 404);
  res = await worker.fetch(new Request('https://w.test/somewhere/else'), e);
  assert.equal(res.status, 404);
  res = await worker.fetch(new Request('https://w.test/reminder/abcdefgh12', { method: 'POST' }), e);
  assert.equal(res.status, 405);

  res = await worker.fetch(new Request('https://w.test/reminder/abcdefgh12', { method: 'DELETE' }), e);
  assert.equal(res.status, 200);
  assert.equal(kv._m.has('sub:abcdefgh12'), false);
});
