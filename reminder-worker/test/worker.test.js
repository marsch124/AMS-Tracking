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

// Counts every operation by the free plan's four daily allowances.
function fakeKV() {
  const m = new Map();
  const ops = { read: 0, write: 0, delete: 0, list: 0 };
  return {
    _m: m, ops,
    async get(k, type) { ops.read++; const e = m.get(k); if (!e) return null; return type === 'json' ? JSON.parse(e.value) : e.value; },
    async getWithMetadata(k, type) {
      ops.read++;
      const e = m.get(k);
      if (!e) return { value: null, metadata: null };
      return { value: type === 'json' ? JSON.parse(e.value) : e.value, metadata: e.metadata };
    },
    async put(k, v, o) { ops.write++; m.set(k, { value: v, metadata: (o && o.metadata) || null }); },
    async delete(k) { ops.delete++; m.delete(k); },
    async list(o) {
      ops.list++;
      const prefix = (o && o.prefix) || '';
      const keys = [...m.entries()].filter(([k]) => k.startsWith(prefix)).map(([k, e]) => ({ name: k, metadata: e.metadata }));
      return { keys: o && o.limit ? keys.slice(0, o.limit) : keys, list_complete: true };
    },
  };
}

// what the worker has stored for one phone
const rec = (kv, id) => (JSON.parse(kv._m.get('reminders')?.value || '{}'))[id];

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
  assert.equal(rec(kv, 'abcdefgh12').lastSent, '2026-10-01');
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
  const gone = makePhone();
  await storeViaHttp(e, 'gone0000001', gone.subscription);
  await storeViaHttp(e, 'flaky000001', makePhone().subscription);
  let fail = true;
  const fetchFn = async (url) => {
    if (url === gone.subscription.endpoint) return new Response(null, { status: 410 });
    return new Response(null, { status: fail ? 503 : 201 });
  };
  let r = await runDue(e, new Date('2026-10-01T18:00:00Z'), fetchFn);
  assert.deepEqual([r.dropped, r.failed, r.sent], [1, 1, 0]);
  assert.deepEqual([...r.statuses].sort(), [410, 503]);
  assert.deepEqual(r.errors, []);
  assert.equal(rec(kv, 'gone0000001'), undefined);
  assert.equal(rec(kv, 'flaky000001').lastSent, null);
  // the same failure all hour is written once, not once a minute
  const writes = kv.ops.write;
  r = await runDue(e, new Date('2026-10-01T18:00:40Z'), fetchFn);
  assert.equal(r.failed, 1);
  assert.equal(kv.ops.write, writes);
  fail = false;
  r = await runDue(e, new Date('2026-10-01T18:01:00Z'), fetchFn);
  assert.deepEqual([r.dropped, r.failed, r.sent], [0, 0, 1]);
  assert.equal(rec(kv, 'flaky000001').lastSent, '2026-10-01');
});

test('HTTP: validation, CORS, delete, health', async () => {
  const kv = fakeKV();
  const e = env(kv);
  const phone = makePhone();
  let res;

  res = await worker.fetch(new Request('https://w.test/health'), e);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, version: '1.1', vapid: true, subject: true });
  // a private key that does not belong to the public key is reported, not hidden
  const other = webpush.generateVAPIDKeys();
  res = await worker.fetch(new Request('https://w.test/health'), { ...e, VAPID_PRIVATE_KEY: other.privateKey });
  assert.equal((await res.json()).vapid, false);
  res = await worker.fetch(new Request('https://w.test/health'), { ...e, VAPID_PRIVATE_KEY: e.VAPID_PRIVATE_KEY + '\n' });
  assert.equal((await res.json()).vapid, false);

  res = await worker.fetch(new Request('https://w.test/reminder/abcdefgh12', { method: 'OPTIONS', headers: { Origin: 'http://localhost:7794' } }), e);
  assert.equal(res.status, 204);
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), 'http://localhost:7794');

  res = await storeViaHttp(e, 'abcdefgh12', phone.subscription, '20:00', 'Europe/Stockholm', 'https://evil.example');
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), 'https://marsch124.github.io');   // never reflected for strangers
  assert.deepEqual(await res.json(), { ok: true, time: '20:00', tz: 'Europe/Stockholm' });
  const stored = rec(kv, 'abcdefgh12');
  assert.deepEqual([stored.time, stored.tz, stored.lastSent, stored.doneDate], ['20:00', 'Europe/Stockholm', null, null]);
  assert.equal(stored.subscription.endpoint, phone.subscription.endpoint);

  // an update keeps lastSent/doneDate but takes the new time
  const all = JSON.parse(kv._m.get('reminders').value);
  all.abcdefgh12.lastSent = '2026-10-01';
  await kv.put('reminders', JSON.stringify(all));
  res = await storeViaHttp(e, 'abcdefgh12', phone.subscription, '19:30');
  assert.equal(res.status, 200);
  const updated = rec(kv, 'abcdefgh12');
  assert.deepEqual([updated.time, updated.tz, updated.lastSent, updated.doneDate], ['19:30', 'Europe/Stockholm', '2026-10-01', null]);

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
  assert.equal(rec(kv, 'abcdefgh12'), undefined);
});

test('a whole day of minute ticks stays far inside the free plan (12 Oct 2026: v1.0 listed every minute)', async () => {
  const kv = fakeKV();
  const e = env(kv);
  await storeViaHttp(e, 'abcdefgh12', makePhone().subscription);
  await storeViaHttp(e, 'zyxwvuts98', makePhone().subscription, '07:15');
  const before = { ...kv.ops };
  const fetchFn = async () => new Response(null, { status: 201 });
  let sent = 0;
  const start = Date.parse('2026-10-11T22:00:00Z');                    // 00:00 Stockholm
  for (let i = 0; i < 1440; i++) sent += (await runDue(e, new Date(start + i * 60_000), fetchFn)).sent;
  assert.equal(sent, 2);                                               // both phones, once each
  const used = Object.fromEntries(Object.keys(before).map(k => [k, kv.ops[k] - before[k]]));
  assert.equal(used.list, 0);                                          // free: 1,000 a day
  assert.equal(used.read, 1440);                                       // free: 100,000 a day
  assert.equal(used.write, 2);                                         // free: 1,000 a day
  assert.equal(used.delete, 0);
});

test('v1.0 records (one key per phone) move into the single key once, with their state', async () => {
  const kv = fakeKV();
  const e = env(kv);
  const phone = makePhone();
  const old = { subscription: phone.subscription, time: '20:00', tz: 'Europe/Stockholm', updatedAt: '2026-10-02T12:40:00.000Z' };
  await kv.put('sub:abcdefgh12', JSON.stringify(old), { metadata: { time: '20:00', tz: 'Europe/Stockholm', lastSent: '2026-10-11', doneDate: '2026-10-12', lastStatus: 201 } });
  const sent = [];
  const fetchFn = async (url, init) => { sent.push(init); return new Response(null, { status: 201 }); };

  let r = await runDue(e, new Date('2026-10-12T09:40:00Z'), fetchFn);  // 11:40, nothing due
  assert.equal(r.checked, 1);
  assert.equal(kv.ops.list, 1);
  assert.deepEqual(rec(kv, 'abcdefgh12'), { ...old, lastSent: '2026-10-11', doneDate: '2026-10-12', lastStatus: 201 });
  // "done today" survived the move: 20:00 stays quiet; the next day it sends again
  r = await runDue(e, new Date('2026-10-12T18:00:00Z'), fetchFn);
  assert.deepEqual([r.quiet, r.sent], [1, 0]);
  r = await runDue(e, new Date('2026-10-13T18:00:00Z'), fetchFn);
  assert.equal(r.sent, 1);
  assert.equal(JSON.parse(phone.decrypt(sent[0].body)).title, 'AMS Tracking');
  assert.equal(kv.ops.list, 1);                                        // never again

  // a store with nobody in it is still a store: no listing every minute
  const empty = fakeKV();
  await runDue(env(empty), new Date('2026-10-12T09:40:00Z'), fetchFn);
  await runDue(env(empty), new Date('2026-10-12T09:41:00Z'), fetchFn);
  assert.equal(empty.ops.list, 1);

  // turning the reminder off also removes the old key
  const res = await worker.fetch(new Request('https://w.test/reminder/abcdefgh12', { method: 'DELETE' }), e);
  assert.equal(res.status, 200);
  assert.equal(rec(kv, 'abcdefgh12'), undefined);
  assert.equal(kv._m.has('sub:abcdefgh12'), false);
});
