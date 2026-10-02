/* AMS Tracking — daily-reminder worker (Cloudflare Worker, no dependencies)
 *
 * WHY THIS EXISTS: an installed web app on an iPhone gets no background time at
 * all, so it cannot ring at 20:00 by itself. The only thing that can wake it is a
 * Web Push message — and somebody has to SEND that message at the right minute.
 * This worker is that somebody. It is the one and only server in the whole app.
 *
 * WHAT IT KNOWS: per phone, the push address Apple handed out (the subscription),
 * the chosen reminder time, the time zone, and a yes/no "already done today" so
 * it can stay quiet. It never sees a habit, a streak, or a name.
 *
 * HTTP (CORS-limited to the app's origin):
 *   PUT    /reminder/:id         { subscription, time: "HH:MM", tz }  -> store/update
 *   PUT    /reminder/:id/status  { date: "YYYY-MM-DD", done: bool }   -> quiet today?
 *   DELETE /reminder/:id                                               -> forget
 *   GET    /health
 * CRON (every minute): send the reminder to every phone whose local clock has
 *   just passed its chosen time today (within a 60-minute window), once per day.
 *
 * Storage: Workers KV, key "sub:<id>", value = the JSON above, metadata =
 * { time, tz, lastSent, doneDate } so the minute-tick needs ONE list call and
 * only reads a value when something is actually due.
 *
 * Web Push itself (RFC 8291 aes128gcm + RFC 8292 VAPID) is implemented below
 * with WebCrypto; reminder-worker/test proves it against the reference
 * implementation (http_ece / web-push) on every run of `npm test`.
 */

export const WORKER_VERSION = '1.0';
const WINDOW_MINUTES = 60;   // how long after the chosen time a missed tick may still send
const TTL_SECONDS = 3600;    // Apple keeps an undelivered push this long (phone offline)
const MAX_SUBSCRIPTIONS = 50;
const ID_RE = /^[a-z0-9]{8,40}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const ORIGIN_RE = /^(https:\/\/marsch124\.github\.io|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?)$/;

const enc = new TextEncoder();

/* ---------- small byte helpers ---------- */

export const b64u = {
    encode(bytes) {
        let s = '';
        for (const b of bytes) s += String.fromCharCode(b);
        return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    },
    decode(str) {
        const s = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4);
        const bin = atob(s);
        const out = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
        return out;
    }
};

function concat(...parts) {
    const len = parts.reduce((n, p) => n + p.length, 0);
    const out = new Uint8Array(len);
    let o = 0;
    for (const p of parts) { out.set(p, o); o += p.length; }
    return out;
}

async function hkdf(salt, ikm, info, length) {
    const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8);
    return new Uint8Array(bits);
}

/* ---------- RFC 8291: encrypt a payload for one subscription ---------- */

export async function encryptPayload(subscription, payloadText) {
    const uaPublic = b64u.decode(subscription.keys.p256dh);   // 65 bytes, uncompressed point
    const authSecret = b64u.decode(subscription.keys.auth);   // 16 bytes
    if (uaPublic.length !== 65 || authSecret.length !== 16) throw new Error('bad subscription keys');

    const asKeys = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
    const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', asKeys.publicKey));
    const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
    const ecdhSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, asKeys.privateKey, 256));

    // IKM = HKDF(salt = auth_secret, IKM = ecdh_secret, info = "WebPush: info" || 0x00 || ua_public || as_public, 32)
    const keyInfo = concat(enc.encode('WebPush: info\0'), uaPublic, asPublic);
    const ikm = await hkdf(authSecret, ecdhSecret, keyInfo, 32);

    const salt = crypto.getRandomValues(new Uint8Array(16));
    const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
    const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);

    // one record: payload || 0x02 (delimiter of the LAST record), no padding needed
    const plaintext = concat(enc.encode(payloadText), new Uint8Array([2]));
    const aesKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
    const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce, tagLength: 128 }, aesKey, plaintext));

    const rs = 4096;
    const header = concat(
        salt,
        new Uint8Array([(rs >>> 24) & 255, (rs >>> 16) & 255, (rs >>> 8) & 255, rs & 255]),
        new Uint8Array([asPublic.length]),
        asPublic
    );
    return concat(header, ciphertext);
}

/* ---------- RFC 8292: VAPID authorization header ---------- */

export async function vapidAuthorization(endpoint, env, nowSeconds) {
    const aud = new URL(endpoint).origin;
    const exp = (nowSeconds || Math.floor(Date.now() / 1000)) + 12 * 3600;  // Apple caps at 24 h
    const header = b64u.encode(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
    const claims = b64u.encode(enc.encode(JSON.stringify({ aud, exp, sub: env.VAPID_SUBJECT })));
    const signingInput = header + '.' + claims;

    const pub = b64u.decode(env.VAPID_PUBLIC_KEY);
    if (pub.length !== 65) throw new Error('bad VAPID public key');
    const jwk = {
        kty: 'EC', crv: 'P-256',
        x: b64u.encode(pub.slice(1, 33)),
        y: b64u.encode(pub.slice(33, 65)),
        d: env.VAPID_PRIVATE_KEY,
        ext: true
    };
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
    const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(signingInput)));
    return 'vapid t=' + signingInput + '.' + b64u.encode(sig) + ', k=' + env.VAPID_PUBLIC_KEY;
}

/* ---------- send one push ---------- */

export async function sendPush(subscription, payloadText, env, fetchFn) {
    const body = await encryptPayload(subscription, payloadText);
    const res = await (fetchFn || fetch)(subscription.endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/octet-stream',
            'Content-Encoding': 'aes128gcm',
            'TTL': String(TTL_SECONDS),
            'Urgency': 'high',
            'Authorization': await vapidAuthorization(subscription.endpoint, env)
        },
        body
    });
    return res.status;
}

/* ---------- time: "where is this phone's clock right now?" ---------- */

export function localClock(now, tz) {
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: tz, hourCycle: 'h23',
        year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
    }).formatToParts(now);
    const get = (t) => parts.find(p => p.type === t).value;
    return {
        date: get('year') + '-' + get('month') + '-' + get('day'),
        minutes: Number(get('hour')) * 60 + Number(get('minute'))
    };
}

function hhmmToMinutes(s) {
    if (!TIME_RE.test(s || '')) return null;
    const [h, m] = s.split(':').map(Number);
    return h * 60 + m;
}

/* 'send' | 'skip-done' | 'no' — pure, so the tests can pin every edge down */
export function dueVerdict(meta, local) {
    const target = hhmmToMinutes(meta.time);
    if (target === null) return 'no';
    if (meta.lastSent === local.date) return 'no';
    if (local.minutes < target || local.minutes >= target + WINDOW_MINUTES) return 'no';
    return meta.doneDate === local.date ? 'skip-done' : 'send';
}

function validTz(tz) {
    try { new Intl.DateTimeFormat('en-GB', { timeZone: tz }); return true; } catch (e) { return false; }
}

/* ---------- the minute tick ---------- */

export async function runDue(env, now, fetchFn) {
    const list = await env.REMINDERS.list({ prefix: 'sub:' });
    const report = { checked: 0, sent: 0, quiet: 0, dropped: 0, failed: 0 };
    for (const key of list.keys) {
        report.checked++;
        const meta = key.metadata || {};
        if (!validTz(meta.tz)) continue;
        const local = localClock(now, meta.tz);
        const verdict = dueVerdict(meta, local);
        if (verdict === 'no') continue;

        const value = await env.REMINDERS.get(key.name, 'json');
        if (!value || !value.subscription) continue;
        const newMeta = { ...meta };

        if (verdict === 'skip-done') {
            report.quiet++;
            newMeta.lastSent = local.date;
        } else {
            let status = 0;
            try {
                status = await sendPush(value.subscription, JSON.stringify({
                    title: 'AMS Tracking',
                    body: 'Time to fill in your tracked items.'
                }), env, fetchFn);
            } catch (e) {
                status = 0;
            }
            if (status === 404 || status === 410) {           // the phone unsubscribed
                await env.REMINDERS.delete(key.name);
                report.dropped++;
                continue;
            }
            newMeta.lastStatus = status;
            if (status >= 200 && status < 500) {
                newMeta.lastSent = local.date;                 // delivered (or our fault: do not retry all hour)
                report.sent++;
            } else {
                report.failed++;                               // network / 5xx: try again next minute
            }
        }
        await env.REMINDERS.put(key.name, JSON.stringify(value), { metadata: newMeta });
    }
    return report;
}

/* ---------- HTTP ---------- */

function corsHeaders(request) {
    const origin = request.headers.get('Origin') || '';
    return {
        'Access-Control-Allow-Origin': ORIGIN_RE.test(origin) ? origin : 'https://marsch124.github.io',
        'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
        'Vary': 'Origin'
    };
}

function json(data, status, headers) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers }
    });
}

async function readJson(request, maxBytes) {
    const text = await request.text();
    if (text.length > maxBytes) throw new Error('too large');
    return JSON.parse(text);
}

async function upsert(id, request, env, h) {
    let body;
    try { body = await readJson(request, 4096); } catch (e) { return json({ error: 'bad body' }, 400, h); }
    const sub = body && body.subscription;
    if (!sub || typeof sub.endpoint !== 'string' || !/^https:\/\//.test(sub.endpoint) ||
        !sub.keys || typeof sub.keys.p256dh !== 'string' || typeof sub.keys.auth !== 'string') {
        return json({ error: 'bad subscription' }, 400, h);
    }
    if (!TIME_RE.test(body.time || '')) return json({ error: 'bad time' }, 400, h);
    if (typeof body.tz !== 'string' || !validTz(body.tz)) return json({ error: 'bad tz' }, 400, h);

    const key = 'sub:' + id;
    const existing = await env.REMINDERS.getWithMetadata(key, 'json');
    if (!existing.value) {
        const all = await env.REMINDERS.list({ prefix: 'sub:', limit: MAX_SUBSCRIPTIONS + 1 });
        if (all.keys.length >= MAX_SUBSCRIPTIONS) return json({ error: 'full' }, 429, h);
    }
    const oldMeta = existing.metadata || {};
    const meta = {
        time: body.time,
        tz: body.tz,
        lastSent: oldMeta.lastSent || null,
        doneDate: oldMeta.doneDate || null
    };
    const value = {
        subscription: { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } },
        time: body.time,
        tz: body.tz,
        updatedAt: new Date().toISOString()
    };
    await env.REMINDERS.put(key, JSON.stringify(value), { metadata: meta });
    return json({ ok: true, time: meta.time, tz: meta.tz }, 200, h);
}

async function setStatus(id, request, env, h) {
    let body;
    try { body = await readJson(request, 512); } catch (e) { return json({ error: 'bad body' }, 400, h); }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date || '') || typeof body.done !== 'boolean') {
        return json({ error: 'bad status' }, 400, h);
    }
    const key = 'sub:' + id;
    const existing = await env.REMINDERS.getWithMetadata(key, 'json');
    if (!existing.value) return json({ error: 'unknown' }, 404, h);
    const meta = { ...(existing.metadata || {}) };
    if (body.done) meta.doneDate = body.date;
    else if (meta.doneDate === body.date) meta.doneDate = null;
    await env.REMINDERS.put(key, JSON.stringify(existing.value), { metadata: meta });
    return json({ ok: true, doneDate: meta.doneDate || null }, 200, h);
}

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const h = corsHeaders(request);
        if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
        if (url.pathname === '/health') return json({ ok: true, version: WORKER_VERSION }, 200, h);

        const m = url.pathname.match(/^\/reminder\/([^/]+)(\/status)?$/);
        if (!m) return json({ error: 'not found' }, 404, h);
        const id = m[1];
        if (!ID_RE.test(id)) return json({ error: 'bad id' }, 400, h);

        if (request.method === 'PUT' && !m[2]) return upsert(id, request, env, h);
        if (request.method === 'PUT' && m[2]) return setStatus(id, request, env, h);
        if (request.method === 'DELETE' && !m[2]) {
            await env.REMINDERS.delete('sub:' + id);
            return json({ ok: true }, 200, h);
        }
        return json({ error: 'method not allowed' }, 405, h);
    },

    async scheduled(event, env, ctx) {
        // `npx wrangler tail` shows these lines live — the only window into the tick.
        ctx.waitUntil(runDue(env, new Date()).then((report) => {
            if (report.checked) console.log('tick', JSON.stringify(report));
        }));
    }
};
