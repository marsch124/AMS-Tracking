/* AMS Tracking — simple, visual habit tracker (vanilla JS, localStorage) */
'use strict';

const APP_VERSION = '1.15.2';
const STORE_KEY = 'amsTracking.v1';

const PALETTE = [
    '#3b70f0', // blue
    '#e0447c', // pink
    '#2fa96d', // green
    '#ee8b2c', // orange
    '#d9463e', // red
    '#7a5af8', // purple
    '#2aa8c4', // teal
    '#c9a227'  // yellow
];

const DAY_NAMES = ['M', 'T', 'W', 'T', 'F', 'S', 'S']; // Monday-first

/* ================= storage ================= */

let state = load();
migrate(state);

/* v1.0 stored emoji as habit icons; map them to hand-drawn icon names */
function migrate(st) {
    (st.habits || []).forEach(h => {
        if (EMOJI_TO_ICON[h.icon]) h.icon = EMOJI_TO_ICON[h.icon];
        else if (!ICON_PATHS[h.icon]) h.icon = 'sun';
    });
    st.settings = st.settings || {};
    if (!st.settings.layout) st.settings.layout = 'list';
    if (!st.settings.theme) st.settings.theme = 'auto';
}

function load() {
    try {
        const raw = localStorage.getItem(STORE_KEY);
        if (raw) return JSON.parse(raw);
    } catch (e) {
        console.error('Load failed', e);
    }
    // First run: seed the one habit Martin explicitly asked for, as a live example
    return {
        version: 1,
        habits: [{
            id: newId(),
            name: 'Intermittent Fasting',
            icon: 'moon',
            color: '#7a5af8',
            type: 'timer',
            days: [true, true, true, true, true, true, true],
            goalHours: 16,
            createdAt: dateKey(new Date()),
            done: {},
            sessions: []
        }]
    };
}

function save() {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
    updateBadge();
}

/* Icon badge: scheduled habits still open today (installed PWAs only) */
function updateBadge() {
    if (!('setAppBadge' in navigator)) return;
    const todayKey = dateKey(new Date());
    const count = state.habits.filter(h => {
        if (h.archived || !isScheduled(h, new Date())) return false;
        if (doneSet(h)[todayKey] || skipSet(h)[todayKey]) return false;
        if (h.type === 'timer' && activeSession(h)) return false; // fast underway
        return true;
    }).length;
    if (count > 0) navigator.setAppBadge(count).catch(() => {});
    else navigator.clearAppBadge().catch(() => {});
}

function applyTheme() {
    const t = state.settings.theme;
    if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
    else delete document.documentElement.dataset.theme;
    // keep the iOS status-bar tint in step with a forced theme
    document.querySelectorAll('meta[name="theme-color"]').forEach(m => {
        if (!m.dataset.orig) m.dataset.orig = m.getAttribute('content');
        m.setAttribute('content',
            t === 'dark' ? '#0d1117' : t === 'light' ? '#f2f4f8' : m.dataset.orig);
    });
}

function newId() {
    return 'h' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* ================= date helpers ================= */

function pad(n) { return String(n).padStart(2, '0'); }

function dateKey(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

function keyToDate(key) {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d);
}

function addDays(d, n) {
    const c = new Date(d);
    c.setDate(c.getDate() + n);
    return c;
}

function weekdayIdx(d) { return (d.getDay() + 6) % 7; } // Mon=0 … Sun=6

/* For timer habits, a day counts as done when a fast ENDED on it. */
function doneSet(habit) {
    if (habit.type !== 'timer') return habit.done || {};
    const set = {};
    (habit.sessions || []).forEach(s => {
        if (s.e) set[dateKey(new Date(s.e))] = 1;
    });
    return set;
}

function skipSet(habit) { return habit.skip || {}; }

/* A fast may carry its own goal for the night (session.g, hours) */
function goalMsFor(habit, session) {
    const h = (session && session.g) || habit.goalHours;
    return h ? h * 3600e3 : null;
}

function isScheduled(habit, d) {
    if (habit.type !== 'daily') return true;
    const days = habit.days || [true, true, true, true, true, true, true];
    return !!days[weekdayIdx(d)];
}

/* ---- weekly-target habits: streaks are counted in weeks ---- */

function weekStart(d) { return addDays(d, -weekdayIdx(d)); }

function weekDoneCount(habit, ws) {
    const done = doneSet(habit);
    let n = 0;
    for (let i = 0; i < 7; i++) {
        if (done[dateKey(addDays(ws, i))]) n++;
    }
    return n;
}

function weekHasSkip(habit, ws) {
    const skip = skipSet(habit);
    for (let i = 0; i < 7; i++) {
        if (skip[dateKey(addDays(ws, i))]) return true;
    }
    return false;
}

/* ref (optional) computes the streak as of that day instead of today */
function weeklyStreak(habit, ref) {
    const target = habit.target || 1;
    let w = weekStart(ref || new Date());
    let streak = 0;
    // the week in progress counts once met, but never breaks the streak
    if (weekDoneCount(habit, w) >= target) streak++;
    w = addDays(w, -7);
    for (let i = 0; i < 530; i++) {
        if (weekDoneCount(habit, w) >= target) streak++;
        else if (!weekHasSkip(habit, w)) break; // skip-marked weeks are excused
        w = addDays(w, -7);
    }
    return streak;
}

function weeklyStats(habit) {
    const target = habit.target || 1;
    const done = doneSet(habit);
    const keys = Object.keys(done).sort();
    let start = keyToDate(habit.createdAt || dateKey(new Date()));
    if (keys.length && keyToDate(keys[0]) < start) start = keyToDate(keys[0]);
    let w = weekStart(start);
    const thisWeek = weekStart(new Date());
    let weeksTotal = 0;
    let weeksMet = 0;
    let best = 0;
    let run = 0;
    for (let i = 0; i < 530 && w <= thisWeek; i++) {
        const met = weekDoneCount(habit, w) >= target;
        const inProgress = w.getTime() === thisWeek.getTime();
        const excused = !met && weekHasSkip(habit, w);
        if ((!inProgress || met) && !excused) weeksTotal++;
        if (met) { weeksMet++; run++; best = Math.max(best, run); }
        else if (!inProgress && !excused) run = 0;
        w = addDays(w, 7);
    }
    return { weeksMet, weeksTotal, best };
}

/* ref (optional) computes the streak as of that day instead of today */
function currentStreak(habit, ref) {
    const done = doneSet(habit);
    let d = ref ? new Date(ref) : new Date();
    // Today doesn't break the streak while it's still pending
    if (isScheduled(habit, d) && !done[dateKey(d)]) d = addDays(d, -1);
    const skip = skipSet(habit);
    let streak = 0;
    for (let i = 0; i < 3700; i++) {
        if (isScheduled(habit, d)) {
            const k = dateKey(d);
            if (done[k]) streak++;
            else if (!skip[k]) break; // skipped days are excused
        }
        d = addDays(d, -1);
    }
    return streak;
}

function longestStreak(habit) {
    const done = doneSet(habit);
    const keys = Object.keys(done).sort();
    if (!keys.length) return 0;
    let best = 0;
    let d = keyToDate(keys[0]);
    const end = new Date();
    let run = 0;
    const skip = skipSet(habit);
    for (let i = 0; i < 3700 && d <= end; i++) {
        if (isScheduled(habit, d)) {
            const k = dateKey(d);
            if (done[k]) { run++; best = Math.max(best, run); }
            else if (!skip[k]) run = 0;
        }
        d = addDays(d, 1);
    }
    return best;
}

function completionStats(habit) {
    const done = doneSet(habit);
    const keys = Object.keys(done).sort();
    let start = keyToDate(habit.createdAt || dateKey(new Date()));
    if (keys.length && keyToDate(keys[0]) < start) start = keyToDate(keys[0]);
    const today = new Date();
    const skip = skipSet(habit);
    let scheduled = 0;
    let d = new Date(start);
    for (let i = 0; i < 3700 && d <= today; i++) {
        if (isScheduled(habit, d) && !skip[dateKey(d)]) scheduled++;
        d = addDays(d, 1);
    }
    const doneCount = keys.length;
    return { done: doneCount, total: Math.max(scheduled, doneCount), pct: scheduled ? Math.round(100 * doneCount / Math.max(scheduled, doneCount)) : 0 };
}

/* ================= timer helpers ================= */

/* Per-day totals of finished fasts (keyed by end day) and whether the goal was met */
function fastDayStats(habit) {
    const ms = {};
    const met = {};
    (habit.sessions || []).forEach(s => {
        if (!s.e) return;
        const k = dateKey(new Date(s.e));
        ms[k] = (ms[k] || 0) + (s.e - s.s);
        const g = s.g || habit.goalHours;
        if (!g || s.e - s.s >= g * 3600e3) met[k] = true;
    });
    return { ms, met };
}

function activeSession(habit) {
    return (habit.sessions || []).find(s => !s.e) || null;
}

function lastFinishedSession(habit) {
    const ss = habit.sessions || [];
    for (let i = ss.length - 1; i >= 0; i--) {
        if (ss[i].e) return ss[i];
    }
    return null;
}

function fmtDuration(ms) {
    const totalMin = Math.floor(ms / 60000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return h + ':' + pad(m);
}

function fmtSessionDate(s) {
    const d = new Date(s.e || s.s);
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

/* ================= milestone celebrations ================= */

const DAY_MILESTONES = [7, 14, 30, 50, 100, 200, 365, 500, 730, 1000];
const WEEK_MILESTONES = [4, 10, 26, 52, 104];

let celebrateTimer = null;

function celebrate(text, color, sub) {
    const el = $('#celebrate');
    el.classList.remove('fading');
    $('#celebrate-icon').innerHTML = icon('flame');
    $('#celebrate-icon').style.color = color;
    $('#celebrate-text').textContent = text;
    $('#celebrate-sub').textContent = sub || '';
    el.hidden = false;

    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        const colors = [color, ...PALETTE.filter(c => c !== color).slice(0, 4)];
        for (let i = 0; i < 26; i++) {
            const bit = document.createElement('span');
            bit.className = 'confetti-bit' + (i % 3 === 0 ? ' round' : '');
            bit.style.background = colors[i % colors.length];
            const angle = Math.random() * 2 * Math.PI;
            const dist = 90 + Math.random() * 150;
            bit.style.setProperty('--dx', Math.cos(angle) * dist + 'px');
            bit.style.setProperty('--dy', (Math.sin(angle) * dist - 40) + 'px');
            bit.style.setProperty('--rot', (Math.random() * 540 - 270) + 'deg');
            el.appendChild(bit);
            setTimeout(() => bit.remove(), 1600);
        }
    }

    clearTimeout(celebrateTimer);
    celebrateTimer = setTimeout(() => {
        el.classList.add('fading');
        setTimeout(() => { el.hidden = true; el.classList.remove('fading'); }, 300);
    }, 2100);
}

/* Fires once per milestone; only from live check-offs, never from backfills */
function maybeCelebrateStreak(habit) {
    const weekly = habit.type === 'weekly';
    const value = weekly ? weeklyStreak(habit) : currentStreak(habit);
    const list = weekly ? WEEK_MILESTONES : DAY_MILESTONES;
    if (!list.includes(value)) return;
    const tag = (weekly ? 'week' : 'day') + value;
    if (habit.lastCelebrated === tag) return;
    habit.lastCelebrated = tag;
    save();
    celebrate(`${value}-${weekly ? 'week' : 'day'} streak!`, habit.color, habit.name);
}

/* ================= undo toast ================= */

let toastTimer = null;

function showToast(msg, actionFn, actionLabel, duration) {
    const t = document.querySelector('#toast');
    t.querySelector('#toast-msg').textContent = msg;
    const btn = t.querySelector('#toast-undo');
    btn.hidden = !actionFn;
    btn.textContent = actionLabel || 'Undo';
    t._undo = actionFn || null;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, duration || 5000);
}

/* ================= self-update check ================= */

let lastUpdateCheck = 0;

async function checkForUpdate(manual) {
    const nowMs = Date.now();
    if (!manual && nowMs - lastUpdateCheck < 5 * 60000) return;
    lastUpdateCheck = nowMs;
    try {
        const res = await fetch('version.json?vercheck=' + nowMs, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (data.version && data.version !== APP_VERSION) {
            showToast(`Version ${data.version} is ready`, applyUpdate, 'Update', 12000);
        } else if (manual) {
            showToast(`You're on the latest version (v${APP_VERSION})`);
        }
    } catch (e) {
        if (manual) showToast('Update check failed \u2014 are you online?');
    }
}

function applyUpdate() {
    const reload = () => location.reload();
    if (navigator.serviceWorker && navigator.serviceWorker.getRegistration) {
        navigator.serviceWorker.getRegistration()
            .then(r => r && r.update())
            .then(reload, reload);
    } else {
        reload();
    }
}

document.addEventListener('visibilitychange', () => {
    if (!document.hidden) checkForUpdate(false);
});

/* ================= today screen ================= */

const $ = (sel) => document.querySelector(sel);

function tint(color, pct) {
    return `color-mix(in srgb, ${color} ${pct}%, var(--card-fallback))`;
}

function renderToday() {
    $('#today-date').textContent = new Date().toLocaleDateString(undefined, {
        weekday: 'long', day: 'numeric', month: 'long'
    });

    renderWeekReview();

    const list = $('#habit-list');
    list.innerHTML = '';
    list.classList.toggle('grid-layout', state.settings.layout === 'grid');
    const visible = state.habits.filter(h => !h.archived);
    $('#empty-state').hidden = visible.length > 0;

    // day progress: done vs scheduled today (skip-marked days are excused)
    const todayKey = dateKey(new Date());
    const scheduledToday = visible.filter(h =>
        isScheduled(h, new Date()) && !skipSet(h)[todayKey]);
    const doneToday = scheduledToday.filter(h => doneSet(h)[todayKey]).length;
    const dp = $('#day-progress');
    dp.hidden = scheduledToday.length === 0;
    if (scheduledToday.length) {
        const all = doneToday === scheduledToday.length;
        $('#dp-fill').style.width = Math.round(100 * doneToday / scheduledToday.length) + '%';
        $('#dp-fill').classList.toggle('complete', all);
        $('#dp-text').textContent = all
            ? `All ${scheduledToday.length} done`
            : `${doneToday} of ${scheduledToday.length} done`;
    }

    visible.forEach(habit => list.appendChild(buildCard(habit)));
}

function buildCard(habit) {
    const card = document.createElement('div');
    card.className = 'habit-card';
    card.style.background = tint(habit.color, 10);

    const done = doneSet(habit);
    const todayKey = dateKey(new Date());
    const active = habit.type === 'timer' ? activeSession(habit) : null;
    const doneToday = !!done[todayKey];

    // --- action button ---
    const btn = document.createElement('button');
    btn.className = 'habit-action';
    if (habit.type !== 'timer') {
        if (doneToday) {
            btn.style.background = habit.color;
            btn.innerHTML = icon('check');
            if (justChecked === habit.id) {
                btn.classList.add('ink-draw');
                justChecked = null;
            }
        } else {
            btn.classList.add('undone');
            btn.style.color = habit.color;
        }
    } else {
        if (active) {
            btn.classList.add('running');
            btn.style.background = habit.color;
            btn.style.setProperty('--pulse', tint(habit.color, 30));
            btn.innerHTML = icon('stop');
        } else {
            btn.classList.add('undone');
            btn.style.color = habit.color;
            btn.innerHTML = icon('play');
        }
    }
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (btn.dataset.lp) { delete btn.dataset.lp; return; } // long-press consumed this tap
        if (habit.type === 'timer') toggleTimer(habit);
        else toggleToday(habit);
    });

    // long-press on an idle fasting button picks tonight's goal before starting;
    // on a check-off button it marks yesterday done (forgot-to-log catch-up)
    if ((habit.type === 'timer' && !active) || habit.type !== 'timer') {
        let lpTimer = null;
        btn.addEventListener('pointerdown', () => {
            lpTimer = setTimeout(() => {
                lpTimer = null;
                btn.dataset.lp = '1';
                if (habit.type === 'timer') openStartGoalSheet(habit);
                else markYesterday(habit);
            }, 500);
        });
        ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev =>
            btn.addEventListener(ev, () => { if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; } }));
        btn.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    const wrap = document.createElement('div');
    wrap.className = 'action-wrap';
    const activeGoalMs = active ? goalMsFor(habit, active) : null;
    if (active && activeGoalMs) {
        const C = 188.5; // circumference of the r=30 ring
        const progress = Math.min(1, (Date.now() - active.s) / activeGoalMs);
        // traffic-light ring: red in the first third, yellow in the middle, green near the goal
        const phase = progress < 1 / 3 ? '#d9463e' : progress < 2 / 3 ? '#e0a80f' : '#2fa96d';
        wrap.innerHTML = `<svg class="ring" viewBox="0 0 66 66">` +
            `<circle class="track" cx="33" cy="33" r="30" fill="none" stroke-width="6"/>` +
            `<circle class="ring-progress${progress >= 1 ? ' done' : ''}" cx="33" cy="33" r="30" fill="none" ` +
            `stroke="${phase}" stroke-width="6" stroke-linecap="round" ` +
            `stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - progress)}"/></svg>`;
    }
    wrap.appendChild(btn);

    // --- middle: name + week dots ---
    const main = document.createElement('div');
    main.className = 'habit-main';
    const name = document.createElement('p');
    name.className = 'habit-name';
    name.innerHTML = `<span class="habit-icon" style="color:${habit.color}">${icon(habit.icon)}</span>${escapeHtml(habit.name)}`;
    if (habit.name.length > 24) name.classList.add('name-xs');
    else if (habit.name.length > 15) name.classList.add('name-sm');
    main.appendChild(name);
    main.appendChild(buildWeekDots(habit, done));

    // --- right: streak / fasting number ---
    const stat = document.createElement('div');
    stat.className = 'habit-stat';
    const num = document.createElement('div');
    num.className = 'stat-number';
    const label = document.createElement('div');
    label.className = 'stat-label';

    if (habit.type === 'daily') {
        const streak = currentStreak(habit);
        num.innerHTML = `${streak}${icon('flame', 'flame')}`;
        num.style.color = habit.color;
        label.textContent = streak === 1 ? 'day' : 'days';
    } else if (habit.type === 'weekly') {
        const streak = weeklyStreak(habit);
        num.innerHTML = `${streak}${icon('flame', 'flame')}`;
        num.style.color = habit.color;
        label.textContent = streak === 1 ? 'week' : 'weeks';
    } else {
        num.style.color = habit.color;
        if (active) {
            const elapsed = Date.now() - active.s;
            num.textContent = fmtDuration(elapsed);
            num.style.cursor = 'pointer';
            num.addEventListener('click', (e) => {
                e.stopPropagation();
                openFastSheet(habit, active, true);
            });
            const goalMs = goalMsFor(habit, active);
            if (goalMs && elapsed >= goalMs) {
                num.classList.add('goal-reached');
                label.classList.add('goal-reached');
                label.textContent = 'goal reached';
            } else if (goalMs) {
                const eta = new Date(active.s + goalMs);
                label.innerHTML = `${fmtDuration(goalMs - elapsed)} left<br>` +
                    `<span style="color:${habit.color}">goal ${pad(eta.getHours())}:${pad(eta.getMinutes())}</span>`;
            } else {
                label.textContent = 'fasting';
            }
        } else {
            const last = lastFinishedSession(habit);
            if (last) {
                num.textContent = fmtDuration(last.e - last.s);
                label.textContent = 'last fast';
            } else {
                num.innerHTML = icon('play');
                label.textContent = 'tap to start';
            }
        }
    }
    stat.appendChild(num);
    stat.appendChild(label);

    if (state.settings.layout === 'grid') {
        card.classList.add('gcard');
        const top = document.createElement('div');
        top.className = 'grid-top';
        top.appendChild(stat);
        top.appendChild(wrap);
        card.appendChild(top);
        card.appendChild(main);
    } else {
        card.appendChild(wrap);
        card.appendChild(main);
        card.appendChild(stat);
        // faint dashed dividers hint at the card's separate tap areas:
        // button | details, and while fasting also | timer number (fix start)
        if (habit.type === 'timer') {
            card.classList.add('zoned');
            if (active) card.classList.add('zoned-3');
        }
    }
    card.addEventListener('click', () => openDetail(habit.id));
    return card;
}

function buildWeekDots(habit, done) {
    const row = document.createElement('div');
    row.className = 'week-dots';
    const today = new Date();
    const monday = addDays(today, -weekdayIdx(today));
    let doneCount = 0;
    let scheduledCount = 0;
    const skip = skipSet(habit);
    for (let i = 0; i < 7; i++) {
        const d = addDays(monday, i);
        const key = dateKey(d);
        const el = document.createElement('span');
        el.className = 'wd';
        el.textContent = DAY_NAMES[i];
        const scheduled = isScheduled(habit, d);
        if (!scheduled) el.classList.add('off-day');
        else if (!skip[key]) scheduledCount++;
        if (done[key]) {
            el.classList.add('on');
            el.style.background = habit.color;
            doneCount++;
        } else if (skip[key]) {
            el.classList.add('wd-skip');
            el.style.color = habit.color;
        }
        row.appendChild(el);
    }
    const ratio = document.createElement('span');
    ratio.className = 'wd-ratio';
    ratio.textContent = habit.type === 'weekly'
        ? `${doneCount}/${habit.target || 1}`
        : `${doneCount}/${scheduledCount}`;
    row.appendChild(ratio);
    return row;
}

/* ================= week in review ================= */

/* Finished fasts that ENDED within the week starting at ws */
function weekFastStats(habit, ws) {
    const we = addDays(ws, 7);
    const durs = (habit.sessions || [])
        .filter(s => s.e && new Date(s.e) >= ws && new Date(s.e) < we)
        .map(s => s.e - s.s);
    return { n: durs.length, avg: durs.length ? durs.reduce((a, b) => a + b, 0) / durs.length : null };
}

/* Once per ISO week: how last week went, per habit. Dismiss stores the
   week key so the card stays away until the next Monday. Derived data
   only — the sole stored value is settings.lastReviewWeek. */
function renderWeekReview() {
    const box = $('#week-review');
    box.hidden = true;
    box.innerHTML = '';
    const thisWs = weekStart(new Date());
    const thisKey = dateKey(thisWs);
    if (state.settings.lastReviewWeek === thisKey) return;
    const habits = state.habits.filter(h =>
        !h.archived && (!h.createdAt || keyToDate(h.createdAt) < thisWs));
    // nothing to review on a fresh install or an empty last week
    const hasHistory = habits.some(h =>
        Object.keys(doneSet(h)).some(k => k < thisKey) ||
        Object.keys(skipSet(h)).some(k => k < thisKey));
    if (!habits.length || !hasHistory) return;

    const lastWs = addDays(thisWs, -7);
    const endLast = addDays(thisWs, -1);   // Sunday of last week
    const endPrev = addDays(thisWs, -8);   // Sunday of the week before
    const fmtD = d => d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

    const card = document.createElement('div');
    card.className = 'wr-card';
    const head = document.createElement('div');
    head.className = 'wr-head';
    head.innerHTML = `<h3>Last week</h3>` +
        `<span class="wr-range">${fmtD(lastWs)} \u2013 ${fmtD(endLast)}</span>`;
    const close = document.createElement('button');
    close.className = 'wr-close';
    close.innerHTML = icon('x');
    close.setAttribute('aria-label', 'Dismiss week review');
    close.addEventListener('click', (e) => {
        e.stopPropagation();
        state.settings.lastReviewWeek = thisKey;
        save();
        renderToday();
    });
    head.appendChild(close);
    card.appendChild(head);

    habits.forEach(h => {
        const done = doneSet(h);
        let mid = '';
        let right = '';
        let rightCls = 'flat';
        if (h.type === 'timer') {
            const cur = weekFastStats(h, lastWs);
            const prev = weekFastStats(h, addDays(lastWs, -7));
            mid = cur.n
                ? `${cur.n} fast${cur.n === 1 ? '' : 's'} \u00b7 \u00d8 ${fmtDuration(cur.avg)} h`
                : 'no fasts';
            if (cur.avg != null && prev.avg != null) {
                const d = cur.avg - prev.avg;
                right = (d < 0 ? '\u2013' : '+') + fmtDuration(Math.abs(d));
                rightCls = d > 0 ? 'up' : d < 0 ? 'down' : 'flat';
            }
        } else {
            if (h.type === 'weekly') {
                mid = `${weekDoneCount(h, lastWs)}/${h.target || 1}\u00d7`;
            } else {
                let sched = 0;
                let dn = 0;
                const skip = skipSet(h);
                for (let i = 0; i < 7; i++) {
                    const d = addDays(lastWs, i);
                    const k = dateKey(d);
                    if (done[k]) dn++;
                    if (isScheduled(h, d) && !skip[k]) sched++;
                }
                mid = `${dn}/${sched} days`;
            }
            const delta = h.type === 'weekly'
                ? weeklyStreak(h, endLast) - weeklyStreak(h, endPrev)
                : currentStreak(h, endLast) - currentStreak(h, endPrev);
            right = (delta < 0 ? '\u2013' : delta > 0 ? '+' : '\u00b1') + Math.abs(delta) +
                icon('flame', 'wr-flame');
            rightCls = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
        }
        const row = document.createElement('div');
        row.className = 'wr-row';
        row.innerHTML = `<span class="habit-icon" style="color:${h.color}">${icon(h.icon)}</span>` +
            `<span class="wr-name">${escapeHtml(h.name)}</span>` +
            `<span class="wr-mid">${mid}</span>` +
            `<span class="wr-right ${rightCls}">${right}</span>`;
        row.addEventListener('click', () => openDetail(h.id));
        card.appendChild(row);
    });

    box.appendChild(card);
    box.hidden = false;
}

let justChecked = null; // habit id whose checkmark should draw itself

function toggleToday(habit) {
    const key = dateKey(new Date());
    habit.done = habit.done || {};
    if (habit.skip && habit.skip[key]) delete habit.skip[key];
    if (habit.done[key]) delete habit.done[key];
    else habit.done[key] = 1;
    if (habit.done[key]) justChecked = habit.id;
    save();
    renderToday();
    if (habit.done[key]) maybeCelebrateStreak(habit);
}

/* Long-press backfill: yesterday counts, but milestones never fire from it */
function markYesterday(habit) {
    const key = dateKey(addDays(new Date(), -1));
    habit.done = habit.done || {};
    if (habit.done[key]) {
        showToast('Yesterday is already done');
        return;
    }
    const wasSkip = !!(habit.skip && habit.skip[key]);
    if (wasSkip) delete habit.skip[key];
    habit.done[key] = 1;
    save();
    renderToday();
    showToast('Yesterday marked done', () => {
        delete habit.done[key];
        if (wasSkip) { habit.skip = habit.skip || {}; habit.skip[key] = 1; }
        save();
        renderToday();
    });
}

function toggleTimer(habit) {
    habit.sessions = habit.sessions || [];
    const active = activeSession(habit);
    if (active) {
        active.e = Date.now();
        save();
        renderToday();
        showToast(`Fast ended \u2014 ${fmtDuration(active.e - active.s)} h`, () => {
            active.e = null;
            save();
            renderToday();
        });
        const others = habit.sessions.filter(x => x.e && x !== active);
        const duration = active.e - active.s;
        if (others.length >= 3 && duration > Math.max(...others.map(x => x.e - x.s))) {
            celebrate('Personal best fast!', habit.color, fmtDuration(duration) + ' h \u00b7 ' + habit.name);
        }
    } else {
        startFast(habit, null);
    }
}

function startFast(habit, goalH) {
    habit.sessions = habit.sessions || [];
    const session = { s: Date.now(), e: null };
    if (goalH) session.g = goalH;
    habit.sessions.push(session);
    save();
    renderToday();
    showToast(goalH ? `Fast started \u2014 goal ${goalH}h` : 'Fast started', () => {
        habit.sessions = habit.sessions.filter(x => x !== session);
        save();
        renderToday();
    });
}

let startGoalHabitId = null;

function openStartGoalSheet(habit) {
    startGoalHabitId = habit.id;
    const row = $('#startgoal-chips');
    row.innerHTML = '';
    const options = [[null, habit.goalHours ? `${habit.goalHours}h` : 'no goal'],
        ...FAST_GOAL_PRESETS.filter(h => h !== habit.goalHours).map(h => [h, `${h}h`])];
    options.forEach(([g, text]) => {
        const c = document.createElement('button');
        c.type = 'button';
        c.className = 'chip goal-chip' + (g === null ? ' sel' : '');
        c.textContent = text;
        c.addEventListener('click', () => {
            $('#sheet-startgoal').hidden = true;
            startFast(habit, g);
        });
        row.appendChild(c);
    });
    $('#sheet-startgoal').hidden = false;
}

/* Live tick for running timers */
setInterval(() => {
    if (document.hidden) return;
    const todayVisible = !document.querySelector('#screen-today').hidden;
    if (todayVisible && state.habits.some(h => h.type === 'timer' && activeSession(h))) {
        renderToday();
    }
    // keep the stages track and the calendar's hour count live mid-fast
    if (!document.querySelector('#screen-detail').hidden && detailId) {
        const h = state.habits.find(x => x.id === detailId);
        if (h && h.type === 'timer' && activeSession(h)) {
            const sy = window.scrollY;
            openDetail(detailId, true);
            window.scrollTo(0, sy);
        }
    }
}, 20000);
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) renderToday();
});

/* ================= detail screen ================= */

let detailId = null;
let calMonth = null; // {y, m} shown in the history calendar
let noteMode = false;

function openDetail(id, keepMonth) {
    if (!keepMonth || detailId !== id) {
        const now = new Date();
        calMonth = { y: now.getFullYear(), m: now.getMonth() };
        noteMode = false;
    }
    detailId = id;
    const habit = state.habits.find(h => h.id === id);
    if (!habit) return;

    const titleEl = $('#detail-title');
    titleEl.innerHTML =
        `<span class="habit-icon" style="color:${habit.color}">${icon(habit.icon)}</span>${escapeHtml(habit.name)}`;
    titleEl.classList.toggle('title-sm', habit.name.length > 12 && habit.name.length <= 20);
    titleEl.classList.toggle('title-xs', habit.name.length > 20);
    $('#detail-subtitle').textContent = habit.type === 'timer'
        ? 'Start / stop timer habit'
        : habit.type === 'weekly'
            ? `Weekly target \u00b7 ${habit.target || 1}\u00d7 per week`
            : 'Daily habit';

    const body = $('#detail-body');
    body.innerHTML = '';

    // --- editable history calendar ---
    body.appendChild(buildHistoryCard(habit));

    // --- timer: fasting stages + session history ---
    if (habit.type === 'timer') {
        body.appendChild(buildStagesCard(habit));
        body.appendChild(buildSessionCard(habit));
    }

    // --- yearly pixel grids ---
    const done = doneSet(habit);
    const years = new Set([new Date().getFullYear()]);
    Object.keys(done).forEach(k => years.add(Number(k.slice(0, 4))));
    [...years].sort((a, b) => b - a).forEach(year => {
        body.appendChild(buildYearCard(habit, done, year));
    });

    showScreen('detail');
}

/* Month calendar for fixing the past: tap a day to add a completion you
   forgot to log, or remove one entered by mistake. Future days are locked. */
function buildHistoryCard(habit) {
    const card = document.createElement('div');
    card.className = 'detail-card';

    const head = document.createElement('div');
    head.className = 'cal-head';
    const title = document.createElement('h3');
    title.textContent = new Date(calMonth.y, calMonth.m, 1)
        .toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    const nav = document.createElement('div');
    nav.className = 'cal-nav';
    const prev = document.createElement('button');
    prev.className = 'pill-btn icon-only cal-nav-btn';
    prev.innerHTML = icon('chevL');
    prev.setAttribute('aria-label', 'Previous month');
    const next = document.createElement('button');
    next.className = 'pill-btn icon-only cal-nav-btn';
    next.innerHTML = icon('chevR');
    next.setAttribute('aria-label', 'Next month');
    const now = new Date();
    // months up to a year ahead are viewable, so a planned vacation can be checked
    const atMaxMonth = new Date(calMonth.y, calMonth.m, 1) >=
        new Date(now.getFullYear(), now.getMonth() + 12, 1);
    next.disabled = atMaxMonth;
    const goPrev = () => {
        calMonth.m--;
        if (calMonth.m < 0) { calMonth.m = 11; calMonth.y--; }
        openDetail(habit.id, true);
    };
    const goNext = () => {
        if (atMaxMonth) return;
        calMonth.m++;
        if (calMonth.m > 11) { calMonth.m = 0; calMonth.y++; }
        openDetail(habit.id, true);
    };
    prev.addEventListener('click', goPrev);
    next.addEventListener('click', goNext);

    // swipe left/right on the calendar card changes the month
    let swX = null, swY = null;
    card.addEventListener('touchstart', (e) => {
        swX = e.touches[0].clientX;
        swY = e.touches[0].clientY;
    }, { passive: true });
    card.addEventListener('touchend', (e) => {
        if (swX === null) return;
        const dx = e.changedTouches[0].clientX - swX;
        const dy = e.changedTouches[0].clientY - swY;
        swX = null;
        if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
        if (dx < 0) goNext();
        else goPrev();
    }, { passive: true });
    nav.appendChild(prev);
    nav.appendChild(next);
    head.appendChild(title);
    head.appendChild(nav);
    card.appendChild(head);

    const note = document.createElement('button');
    note.className = 'pill-btn icon-only cal-nav-btn' + (noteMode ? ' note-on' : '');
    note.innerHTML = icon('pen');
    note.setAttribute('aria-label', 'Note mode');
    note.addEventListener('click', () => {
        noteMode = !noteMode;
        openDetail(habit.id, true);
    });
    nav.insertBefore(note, prev);

    const hint = document.createElement('p');
    hint.className = 'cal-hint';
    hint.textContent = noteMode
        ? 'Note mode: tap a day to write or edit its note.'
        : habit.type === 'timer'
            ? 'Tap a day to record a forgotten fast (0 = skip day) or to edit a recorded one.'
            : 'Tap a day to cycle: done \u2192 skip day \u2192 empty.';
    card.appendChild(hint);

    const grid = document.createElement('div');
    grid.className = 'cal-grid';
    DAY_NAMES.forEach(n => {
        const el = document.createElement('span');
        el.className = 'cal-dow';
        el.textContent = n;
        grid.appendChild(el);
    });

    const done = doneSet(habit);
    const fastDay = habit.type === 'timer' ? fastDayStats(habit) : null;
    const todayKey = dateKey(now);
    const first = new Date(calMonth.y, calMonth.m, 1);
    for (let i = 0; i < weekdayIdx(first); i++) {
        grid.appendChild(document.createElement('span'));
    }
    const daysInMonth = new Date(calMonth.y, calMonth.m + 1, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
        const d = new Date(calMonth.y, calMonth.m, day);
        const key = dateKey(d);
        const el = document.createElement('button');
        el.className = 'cal-day';
        el.textContent = day;
        const skip = skipSet(habit);
        const notes = habit.notes || {};
        const isTimer = habit.type === 'timer';
        if (isTimer) el.classList.add('cal-fast');
        if (key > todayKey) {
            if (skip[key]) {
                // planned vacation day: shown like any skip day, tap to un-mark it
                if (isTimer) {
                    el.classList.add('skipped-fast');
                    el.innerHTML = `<span class="cf-date">${day}</span>` +
                        `<span class="cf-hours skipday" style="border-color:${habit.color};color:${habit.color}">\u2013</span>`;
                } else {
                    el.classList.add('skipped');
                    el.style.color = habit.color;
                }
                if (notes[key]) el.classList.add('has-note');
                el.addEventListener('click', () => {
                    if (noteMode) { editDayNote(habit, d); return; }
                    delete habit.skip[key];
                    save();
                    openDetail(habit.id, true);
                });
            } else {
                el.disabled = true;
                if (isTimer) el.innerHTML = `<span class="cf-date">${day}</span><span class="cf-hours future"></span>`;
            }
        } else {
            if (isTimer) {
                // date above, fasted hours in a colored circle below (like the app Martin likes)
                const activeToday = key === todayKey && activeSession(habit);
                let circle;
                if (done[key]) {
                    const h = Math.round((fastDay.ms[key] || 0) / 3600e3);
                    const cls = !habit.goalHours || fastDay.met[key] ? 'met' : 'under';
                    circle = `<span class="cf-hours ${cls}">${h}</span>`;
                } else if (activeToday) {
                    const h = Math.round((Date.now() - activeToday.s) / 3600e3);
                    circle = `<span class="cf-hours running">${h}</span>`;
                } else if (skip[key]) {
                    el.classList.add('skipped-fast');
                    circle = `<span class="cf-hours skipday" style="border-color:${habit.color};color:${habit.color}">\u2013</span>`;
                } else {
                    circle = '<span class="cf-hours none"></span>';
                }
                el.innerHTML = `<span class="cf-date">${day}</span>` + circle;
                if (key === todayKey) el.classList.add('cf-today');
            } else {
                if (done[key]) {
                    el.classList.add('on');
                    el.style.background = habit.color;
                } else if (skip[key]) {
                    el.classList.add('skipped');
                    el.style.color = habit.color;
                } else if (!isScheduled(habit, d)) {
                    el.classList.add('off-day');
                }
                if (key === todayKey) el.style.boxShadow = `inset 0 0 0 2px ${habit.color}`;
            }
            if (notes[key]) el.classList.add('has-note');
            el.addEventListener('click', () => {
                if (noteMode) editDayNote(habit, d);
                else toggleHistoryDay(habit, d, !!done[key]);
            });
        }
        grid.appendChild(el);
    }
    card.appendChild(grid);

    // vacation helper: mark a whole range of days as skip in one go
    const rangeBtn = document.createElement('button');
    rangeBtn.className = 'skip-range-btn';
    rangeBtn.innerHTML = icon('case') + 'Skip several days (vacation)…';
    rangeBtn.addEventListener('click', () => openSkipRangeSheet(habit));
    card.appendChild(rangeBtn);

    // notes for the shown month
    const notes = habit.notes || {};
    const monthPrefix = calMonth.y + '-' + pad(calMonth.m + 1);
    const monthNotes = Object.keys(notes).filter(k => k.startsWith(monthPrefix)).sort();
    if (monthNotes.length) {
        const list = document.createElement('div');
        list.className = 'note-list';
        monthNotes.forEach(k => {
            const row = document.createElement('div');
            row.className = 'note-row';
            row.innerHTML = `<span class="note-day" style="color:${habit.color}">${Number(k.slice(8))}</span>` +
                `<span class="note-text">${escapeHtml(notes[k])}</span>`;
            row.addEventListener('click', () => editDayNote(habit, keyToDate(k)));
            list.appendChild(row);
        });
        card.appendChild(list);
    }
    return card;
}

function editDayNote(habit, d) {
    const key = dateKey(d);
    habit.notes = habit.notes || {};
    const answer = prompt(`Note for ${d.toLocaleDateString()}:`, habit.notes[key] || '');
    if (answer === null) return;
    if (answer.trim()) habit.notes[key] = answer.trim().slice(0, 200);
    else delete habit.notes[key];
    save();
    openDetail(habit.id, true);
}

/* ================= vacation range (bulk skip) ================= */

let skipRangeHabitId = null;

function openSkipRangeSheet(habit) {
    skipRangeHabitId = habit.id;
    const today = dateKey(new Date());
    $('#skip-from').value = today;
    $('#skip-to').value = today;
    $('#skip-all').checked = state.habits.filter(h => !h.archived).length > 1;
    $('#sheet-skiprange').hidden = false;
}

$('#btn-skiprange-cancel').addEventListener('click', () => { $('#sheet-skiprange').hidden = true; });
$('#sheet-skiprange').addEventListener('click', (e) => {
    if (e.target === $('#sheet-skiprange')) $('#sheet-skiprange').hidden = true;
});

$('#btn-skiprange-save').addEventListener('click', () => {
    const habit = state.habits.find(h => h.id === skipRangeHabitId);
    if (!habit) { $('#sheet-skiprange').hidden = true; return; }
    const fromV = $('#skip-from').value;
    const toV = $('#skip-to').value;
    if (!fromV || !toV) { alert('Please pick a first and a last day.'); return; }
    const from = keyToDate(fromV);
    const to = keyToDate(toV);
    if (to < from) { alert('The last day must not be before the first day.'); return; }
    const days = Math.round((to - from) / 86400e3) + 1;
    if (days > 92) { alert('A range can cover at most 92 days (about 3 months).'); return; }
    const targets = $('#skip-all').checked
        ? state.habits.filter(h => !h.archived)
        : [habit];
    const added = []; // only the newly marked [habit, key] pairs, so Undo is exact
    targets.forEach(h => {
        const done = doneSet(h);
        h.skip = h.skip || {};
        for (let d = new Date(from); d <= to; d = addDays(d, 1)) {
            const k = dateKey(d);
            if (done[k] || h.skip[k]) continue; // done days stay done, skips stay
            h.skip[k] = 1;
            added.push([h, k]);
        }
    });
    save();
    $('#sheet-skiprange').hidden = true;
    openDetail(habit.id, true);
    const dayWord = days === 1 ? 'day' : 'days';
    showToast(targets.length > 1
        ? `${days} ${dayWord} skipped for ${targets.length} habits`
        : `${days} ${dayWord} skipped`,
        added.length ? () => {
            added.forEach(([h, k]) => delete h.skip[k]);
            save();
            if (!$('#screen-detail').hidden) openDetail(detailId, true);
            else renderToday();
        } : null);
});

function toggleHistoryDay(habit, d, wasDone) {
    const key = dateKey(d);
    if (habit.type !== 'timer') {
        habit.done = habit.done || {};
        habit.skip = habit.skip || {};
        if (wasDone) { delete habit.done[key]; habit.skip[key] = 1; } // done -> skip
        else if (habit.skip[key]) delete habit.skip[key];             // skip -> empty
        else habit.done[key] = 1;                                     // empty -> done
    } else if (!wasDone && habit.skip && habit.skip[key]) {
        delete habit.skip[key];
    } else if (wasDone) {
        // never destructive on tap: open the day's fast in the editor instead
        const dayFasts = (habit.sessions || []).filter(s => s.e && dateKey(new Date(s.e)) === key);
        if (dayFasts.length) openFastSheet(habit, dayFasts[dayFasts.length - 1]);
        return;
    } else {
        const answer = prompt(`How many hours did you fast on ${d.toLocaleDateString()}?\n(Enter 0 to mark a skip day.)`, '16');
        if (answer === null) return;
        const hours = parseFloat(String(answer).replace(',', '.'));
        if (hours === 0) {
            habit.skip = habit.skip || {};
            habit.skip[key] = 1;
            save();
            openDetail(habit.id, true);
            return;
        }
        if (!isFinite(hours) || hours <= 0 || hours > 48) {
            alert('Please enter a fast length between 0 and 48 hours.');
            return;
        }
        // Record it as ending at noon of that day, so it counts for that day
        const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12).getTime();
        habit.sessions = habit.sessions || [];
        habit.sessions.push({ s: end - hours * 3600e3, e: end });
        habit.sessions.sort((a, b) => a.s - b.s);
    }
    save();
    openDetail(habit.id, true);
}

function buildYearCard(habit, done, year) {
    const card = document.createElement('div');
    card.className = 'detail-card';
    const head = document.createElement('div');
    head.className = 'year-head';
    const h = document.createElement('h3');
    h.textContent = year;
    const share = document.createElement('button');
    share.className = 'pill-btn icon-only cal-nav-btn';
    share.innerHTML = icon('export');
    share.setAttribute('aria-label', `Share ${year} as a poster`);
    share.addEventListener('click', () => exportYearPoster(habit, year));
    head.appendChild(h);
    head.appendChild(share);
    card.appendChild(head);

    const grid = document.createElement('div');
    grid.className = 'pixel-grid';
    const today = new Date();
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31);
    const skip = skipSet(habit);
    const MONTH_LETTERS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
    let doneCount = 0;
    let scheduledPast = 0;
    for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
        if (d.getDate() === 1) {
            const ml = document.createElement('span');
            ml.className = 'px-month';
            ml.textContent = MONTH_LETTERS[d.getMonth()];
            grid.appendChild(ml);
        }
        const px = document.createElement('span');
        px.className = 'px';
        const k = dateKey(d);
        if (d > today) px.classList.add('future');
        else {
            px.dataset.k = k;
            if (isScheduled(habit, d) && !skip[k]) scheduledPast++;
        }
        if (done[k]) {
            px.style.background = habit.color;
            doneCount++;
        } else if (skip[k] && d <= today) {
            px.classList.add('skip');
            px.style.color = habit.color;
        }
        grid.appendChild(px);
    }
    grid.addEventListener('click', (e) => {
        const k = e.target.dataset && e.target.dataset.k;
        if (!k) return;
        const d = keyToDate(k);
        const status = done[k] ? 'done' : skipSet(habit)[k] ? 'skip day' : 'not done';
        const note = (habit.notes || {})[k];
        showToast(d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }) +
            ` \u2014 ${status}` + (note ? ` \u00b7 ${note}` : ''));
    });
    card.appendChild(grid);

    const rows = document.createElement('div');
    rows.className = 'stat-rows';
    const isCurrentYear = year === today.getFullYear();
    const stats = [];
    const unit = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
    if (isCurrentYear && habit.type === 'weekly') {
        const w = weeklyStats(habit);
        stats.push(['Current streak', unit(weeklyStreak(habit), 'week')]);
        stats.push(['Longest streak', unit(w.best, 'week')]);
        stats.push(['Weeks met', `${w.weeksMet} of ${w.weeksTotal}`]);
    } else if (isCurrentYear) {
        stats.push(['Current streak', unit(currentStreak(habit), 'day')]);
        stats.push(['Longest streak', unit(longestStreak(habit), 'day')]);
        const c = completionStats(habit);
        stats.push(['Completion', `${c.pct}% (${c.done} of ${c.total} days)`]);
    } else {
        stats.push(['Days completed', `${doneCount} of ${scheduledPast}`]);
    }
    stats.forEach(([k, v]) => {
        const row = document.createElement('div');
        row.className = 'stat-row';
        row.innerHTML = `<span class="k">${k}</span><span class="v">${v}</span>`;
        rows.appendChild(row);
    });
    card.appendChild(rows);
    return card;
}

/* ================= year poster export ================= */

function posterFileName(habit, year) {
    const slug = habit.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'habit';
    return `ams-tracking-${slug}-${year}.png`;
}

/* 1080x1350 (4:5) share image in app style: icon + name, the year as a
   month-by-day pixel grid, and the year card's stats as big tiles.
   Always drawn on the light palette so posters look alike everywhere. */
async function renderYearPoster(habit, year) {
    const W = 1080;
    const H = 1350;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    const BG = '#f2f4f8', CARD = '#ffffff', TEXT = '#16181d', DIM = '#7a7f8a', EMPTY = '#e8ebf1';
    const FONT = "-apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif";
    const rr = (x, y, w, h, r) => {
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
        else ctx.rect(x, y, w, h);
    };

    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = CARD;
    rr(50, 50, W - 100, H - 100, 44);
    ctx.fill();

    // the hand-drawn habit icon, rasterized from its SVG in the habit color
    await new Promise(resolve => {
        const svg = icon(habit.icon)
            .replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ')
            .replace('stroke="currentColor"', `stroke="${habit.color}"`);
        const img = new Image();
        img.onload = () => { ctx.drawImage(img, 106, 104, 96, 96); resolve(); };
        img.onerror = resolve;
        setTimeout(resolve, 1500); // never hang the export on a bad icon
        img.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
    });

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    let size = 66;
    do { ctx.font = `800 ${size}px ${FONT}`; size -= 2; }
    while (ctx.measureText(habit.name).width > 730 && size > 30);
    ctx.fillStyle = TEXT;
    ctx.fillText(habit.name, 228, 162);
    ctx.font = `800 42px ${FONT}`;
    ctx.fillStyle = DIM;
    ctx.fillText(String(year), 228, 220);

    // month rows x day columns, matching the year grid's states
    const done = doneSet(habit);
    const skip = skipSet(habit);
    const today = new Date();
    const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
    const gx = 156, gw = 866, cell = 22, gapX = (gw - 31 * cell) / 30;
    const gy = 306, rowPitch = 46;
    for (let m = 0; m < 12; m++) {
        const y = gy + m * rowPitch;
        ctx.font = `700 26px ${FONT}`;
        ctx.fillStyle = DIM;
        ctx.fillText(MONTHS[m], 106, y + cell - 3);
        const daysInMonth = new Date(year, m + 1, 0).getDate();
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, m, day);
            const k = dateKey(date);
            const x = gx + (day - 1) * (cell + gapX);
            if (done[k]) {
                ctx.fillStyle = habit.color;
                rr(x, y, cell, cell, 6);
                ctx.fill();
            } else if (skip[k] && date <= today) {
                ctx.strokeStyle = habit.color;
                ctx.lineWidth = 2.4;
                ctx.setLineDash([4, 3]);
                rr(x + 1.5, y + 1.5, cell - 3, cell - 3, 5);
                ctx.stroke();
                ctx.setLineDash([]);
            } else {
                ctx.fillStyle = EMPTY;
                ctx.globalAlpha = date > today ? 0.45 : 1;
                rr(x, y, cell, cell, 6);
                ctx.fill();
                ctx.globalAlpha = 1;
            }
        }
    }

    // stat tiles, mirroring the year card's numbers
    const isCurrentYear = year === today.getFullYear();
    let doneCount = 0;
    let scheduledPast = 0;
    for (let d = new Date(year, 0, 1); d <= new Date(year, 11, 31); d = addDays(d, 1)) {
        const k = dateKey(d);
        if (done[k]) doneCount++;
        if (d <= today && isScheduled(habit, d) && !skip[k]) scheduledPast++;
    }
    let stats;
    if (isCurrentYear && habit.type === 'weekly') {
        const w = weeklyStats(habit);
        stats = [[String(weeklyStreak(habit)), 'week streak'],
                 [String(w.best), 'best streak'],
                 [`${w.weeksMet}/${w.weeksTotal}`, 'weeks met']];
    } else if (isCurrentYear) {
        stats = [[String(currentStreak(habit)), 'day streak'],
                 [String(longestStreak(habit)), 'longest streak'],
                 [completionStats(habit).pct + '%', 'completion']];
    } else {
        stats = [[String(doneCount), 'days done'],
                 [String(scheduledPast), 'days scheduled']];
    }
    ctx.textAlign = 'center';
    const tileW = (W - 160) / stats.length;
    stats.forEach(([v, l], i) => {
        const cx = 80 + tileW * (i + 0.5);
        let ts = 86;
        do { ctx.font = `800 ${ts}px ${FONT}`; ts -= 4; }
        while (ctx.measureText(v).width > tileW - 40 && ts > 34);
        ctx.fillStyle = habit.color;
        ctx.fillText(v, cx, 1030);
        ctx.font = `600 30px ${FONT}`;
        ctx.fillStyle = DIM;
        ctx.fillText(l, cx, 1080);
    });

    ctx.font = `600 26px ${FONT}`;
    ctx.fillStyle = DIM;
    ctx.fillText(`AMS Tracking \u00b7 ${year}, pixel by pixel`, W / 2, 1236);
    return canvas;
}

async function exportYearPoster(habit, year) {
    try {
        const canvas = await renderYearPoster(habit, year);
        const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
        if (!blob) throw new Error('could not render the image');
        const file = new File([blob], posterFileName(habit, year), { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file] });
            showToast('Poster shared');
        } else {
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = file.name;
            a.click();
            URL.revokeObjectURL(a.href);
            showToast('Poster saved');
        }
    } catch (err) {
        if (!err || err.name !== 'AbortError') alert('Poster export failed: ' + (err && err.message));
    }
}

/* ================= fasting stages ================= */

/* Commonly-cited fast phases — a popular rule of thumb, not medical advice */
const FAST_STAGES = [
    { from: 0,  to: 4,  name: 'Digestion',   desc: 'the body is still processing the last meal', color: '#d9463e' },
    { from: 4,  to: 12, name: 'Settling in', desc: 'blood sugar and insulin drift down',          color: '#e0a80f' },
    { from: 12, to: 16, name: 'Fat burning', desc: 'the body leans on its fat stores',            color: '#7bc496' },
    { from: 16, to: 20, name: 'Deep fast',   desc: 'ketosis territory for many people',           color: '#2fa96d' }
];

function buildStagesCard(habit) {
    const card = document.createElement('div');
    card.className = 'detail-card';
    const h = document.createElement('h3');
    h.textContent = 'Fasting stages';
    card.appendChild(h);

    const active = activeSession(habit);
    const elapsedH = active ? (Date.now() - active.s) / 3600e3 : null;
    const stage = active ? FAST_STAGES.filter(s => elapsedH >= s.from).pop() : null;

    // hand-drawn horizontal track, 0-20h, with the elapsed marker while fasting
    const W = 320, TRACK_MAX = 20;
    const x = hr => 10 + Math.min(hr, TRACK_MAX) / TRACK_MAX * 300;
    let marks = '';
    FAST_STAGES.forEach(s => {
        const x1 = x(s.from) + (s.from ? 1 : 0);
        const x2 = x(s.to) - (s.to < TRACK_MAX ? 1 : 0);
        marks += `<rect x="${x1.toFixed(1)}" y="16" width="${(x2 - x1).toFixed(1)}" height="12" rx="6" ` +
            `fill="${s.color}" opacity="${!active || stage === s ? 1 : 0.3}"/>`;
    });
    [0, 4, 12, 16].forEach(hb => {
        marks += `<text x="${x(hb).toFixed(1)}" y="42" text-anchor="middle" class="chart-label">${hb}h</text>`;
    });
    marks += `<text x="${x(TRACK_MAX).toFixed(1)}" y="42" text-anchor="end" class="chart-label">${TRACK_MAX}h+</text>`;
    if (active) {
        const mx = x(elapsedH);
        marks += `<path d="M${mx.toFixed(1)} 5 L${mx.toFixed(1)} 31" stroke="var(--text)" ` +
            `stroke-width="2.4" stroke-linecap="round"/>` +
            `<circle cx="${mx.toFixed(1)}" cy="5" r="2.6" fill="var(--text)"/>`;
    }
    const track = document.createElement('div');
    track.innerHTML = `<svg class="stage-track" viewBox="0 0 ${W} 48" role="img" ` +
        `aria-label="Fasting stages track">${marks}</svg>`;
    card.appendChild(track);

    const now = document.createElement('p');
    now.className = 'stage-now';
    if (active) {
        now.innerHTML = `Now: <strong style="color:${stage.color}">${stage.name}</strong> \u00b7 ${fmtDuration(Date.now() - active.s)} h`;
    } else {
        now.className = 'cal-hint';
        now.textContent = 'While a fast runs, a marker shows which stage you are in.';
    }
    card.appendChild(now);

    const rows = document.createElement('div');
    rows.className = 'stage-rows' + (active ? ' stages-active' : '');
    FAST_STAGES.forEach(s => {
        const row = document.createElement('div');
        row.className = 'stage-row' + (stage === s ? ' cur' : '');
        const range = s.to >= TRACK_MAX ? `${s.from}h+` : `${s.from}\u2013${s.to}h`;
        row.innerHTML = `<span class="stage-dot" style="background:${s.color}"></span>` +
            `<span class="stage-text"><span class="stage-name">${s.name}</span>` +
            `<span class="stage-range">${range}</span>` +
            `<span class="stage-desc">${s.desc}</span></span>`;
        rows.appendChild(row);
    });
    card.appendChild(rows);

    const hint = document.createElement('p');
    hint.className = 'cal-hint';
    hint.style.marginBottom = '0';
    hint.textContent = 'A popular approximation from fasting literature \u2014 every body is different. Not medical advice.';
    card.appendChild(hint);
    return card;
}

function buildSessionCard(habit) {
    const card = document.createElement('div');
    card.className = 'detail-card';
    const h = document.createElement('h3');
    h.textContent = 'Fasts';
    card.appendChild(h);

    const finished = (habit.sessions || []).filter(s => s.e);
    if (finished.length) {
        const durations = finished.map(s => s.e - s.s);
        const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
        const max = Math.max(...durations);
        const goalMetDays = Object.keys(fastDayStats(habit).met).length;
        const rows = document.createElement('div');
        rows.className = 'stat-rows';
        [['Average', fmtDuration(avg) + ' h'], ['Longest', fmtDuration(max) + ' h'],
         ['Goal met', `${goalMetDays} ${goalMetDays === 1 ? 'day' : 'days'}`],
         ['Total fasts', String(finished.length)]]
            .forEach(([k, v]) => {
                const row = document.createElement('div');
                row.className = 'stat-row';
                row.innerHTML = `<span class="k">${k}</span><span class="v">${v}</span>`;
                rows.appendChild(row);
            });
        card.appendChild(rows);
    }

    const chart = buildFastChart(habit, finished);
    if (chart) card.appendChild(chart);

    const ul = document.createElement('ul');
    ul.className = 'session-list';

    const active = activeSession(habit);
    if (active) {
        const li = document.createElement('li');
        li.className = 'session-active';
        li.innerHTML = `<span class="session-when">In progress \u2014 started ` +
            `${new Date(active.s).toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' })}</span>` +
            `<span class="session-dur">${fmtDuration(Date.now() - active.s)} h</span>`;
        li.addEventListener('click', () => openFastSheet(habit, active));
        ul.appendChild(li);
    }

    const recent = finished.slice(-10).reverse();
    if (!recent.length && !active) {
        const li = document.createElement('li');
        li.style.cursor = 'default';
        li.innerHTML = '<span class="session-when">No completed fasts yet — press the round button on the card to start one.</span>';
        ul.appendChild(li);
    }
    recent.forEach(s => {
        const li = document.createElement('li');
        li.innerHTML = `<span class="session-when">${fmtSessionDate(s)}</span>` +
            `<span class="session-dur">${fmtDuration(s.e - s.s)} h</span>`;
        li.addEventListener('click', () => openFastSheet(habit, s));
        ul.appendChild(li);
    });

    const editHint = document.createElement('p');
    editHint.className = 'cal-hint';
    editHint.textContent = 'Tap a fast to correct its times or delete it.';
    card.appendChild(editHint);
    card.appendChild(ul);
    return card;
}

/* Bar chart of recent fasts against the goal line. Single series in the
   habit's color; the fast list right below acts as its table view. */
function buildFastChart(habit, finished) {
    const data = finished.slice(-30);
    if (data.length < 2) return null;

    const W = 320, H = 118, padT = 16, padB = 4;
    const plotH = H - padT - padB;
    const goalMs = habit.goalHours ? habit.goalHours * 3600e3 : null;
    const maxV = Math.max(...data.map(s => s.e - s.s), goalMs || 0) * 1.12;
    const bw = W / data.length;
    const barW = Math.max(3, Math.min(14, bw - 2));

    let marks = `<line x1="0" x2="${W}" y1="${H - padB}" y2="${H - padB}" stroke="var(--border)" stroke-width="1.5"/>`;
    data.forEach((s, i) => {
        const v = s.e - s.s;
        const h = Math.max(3, (v / maxV) * plotH);
        const x = i * bw + (bw - barW) / 2;
        marks += `<rect data-i="${i}" x="${x.toFixed(1)}" y="${(H - padB - h).toFixed(1)}" ` +
            `width="${barW.toFixed(1)}" height="${h.toFixed(1)}" rx="3" fill="${habit.color}">` +
            `<title>${fmtSessionDate(s)}: ${fmtDuration(v)} h</title></rect>`;
    });
    if (goalMs) {
        const gy = H - padB - (goalMs / maxV) * plotH;
        marks += `<line x1="0" x2="${W}" y1="${gy.toFixed(1)}" y2="${gy.toFixed(1)}" ` +
            `stroke="var(--text-dim)" stroke-width="1.3" stroke-dasharray="5 4" opacity="0.75"/>` +
            `<text x="${W - 2}" y="${(gy - 4).toFixed(1)}" text-anchor="end" class="chart-label">goal ${habit.goalHours}h</text>`;
    }

    const box = document.createElement('div');
    box.innerHTML = `<svg class="fast-chart" viewBox="0 0 ${W} ${H}" role="img" ` +
        `aria-label="Length of the last ${data.length} fasts">${marks}</svg>` +
        `<p class="cal-hint">Last ${data.length} fasts \u00b7 tap a bar to edit that fast.</p>`;
    box.querySelectorAll('rect[data-i]').forEach(r => {
        r.addEventListener('click', () => openFastSheet(habit, data[Number(r.dataset.i)]));
    });
    return box;
}

/* ================= fast edit sheet ================= */

let fastEdit = null; // { habitId, session }

function toLocalInput(ms) {
    const d = new Date(ms);
    return dateKey(d) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}

const FAST_GOAL_PRESETS = [13, 15, 16, 18];

function openFastSheet(habit, session, fromToday) {
    fastEdit = { habitId: habit.id, session, goal: session.g || null, fromToday: !!fromToday };
    $('#fast-sheet-title').textContent = session.e ? 'Edit fast' : 'Fast in progress';
    $('#fast-start').value = toLocalInput(session.s);
    $('#fast-end-wrap').hidden = !session.e;
    if (session.e) $('#fast-end').value = toLocalInput(session.e);
    $('#fast-goal-wrap').hidden = !!session.e;
    if (!session.e) renderFastGoalChips(habit);
    updateFastNote();
    $('#sheet-fast').hidden = false;
}

function renderFastGoalChips(habit) {
    const row = $('#fast-goal');
    row.innerHTML = '';
    const def = document.createElement('button');
    def.type = 'button';
    def.className = 'chip goal-chip' + (fastEdit.goal === null ? ' sel' : '');
    def.textContent = habit.goalHours ? `${habit.goalHours}h` : '\u2014';
    def.title = 'Habit default';
    def.addEventListener('click', () => { fastEdit.goal = null; renderFastGoalChips(habit); });
    row.appendChild(def);
    FAST_GOAL_PRESETS.filter(h => h !== habit.goalHours).forEach(h => {
        const c = document.createElement('button');
        c.type = 'button';
        c.className = 'chip goal-chip' + (fastEdit.goal === h ? ' sel' : '');
        c.textContent = `${h}h`;
        c.addEventListener('click', () => { fastEdit.goal = h; renderFastGoalChips(habit); });
        row.appendChild(c);
    });
}

function updateFastNote() {
    if (!fastEdit) return;
    const s = new Date($('#fast-start').value).getTime();
    const e = fastEdit.session.e ? new Date($('#fast-end').value).getTime() : Date.now();
    $('#fast-duration-note').textContent =
        isFinite(s) && isFinite(e) && e > s ? `Duration: ${fmtDuration(e - s)} h` : '';
}

$('#btn-startgoal-cancel').addEventListener('click', () => { $('#sheet-startgoal').hidden = true; });
$('#sheet-startgoal').addEventListener('click', (e) => {
    if (e.target === $('#sheet-startgoal')) $('#sheet-startgoal').hidden = true;
});

$('#fast-start').addEventListener('input', updateFastNote);
$('#fast-end').addEventListener('input', updateFastNote);
$('#btn-fast-cancel').addEventListener('click', () => { $('#sheet-fast').hidden = true; });
$('#sheet-fast').addEventListener('click', (e) => {
    if (e.target === $('#sheet-fast')) $('#sheet-fast').hidden = true;
});

$('#btn-fast-save').addEventListener('click', () => {
    const habit = state.habits.find(h => h.id === fastEdit.habitId);
    const session = fastEdit.session;
    if (!habit || !habit.sessions.includes(session)) { $('#sheet-fast').hidden = true; return; }
    const start = new Date($('#fast-start').value).getTime();
    if (!isFinite(start)) { alert('Please enter a valid start time.'); return; }
    if (start > Date.now()) { alert("The start can't be in the future."); return; }
    if (session.e) {
        const end = new Date($('#fast-end').value).getTime();
        if (!isFinite(end)) { alert('Please enter a valid end time.'); return; }
        if (end <= start) { alert('The end must be after the start.'); return; }
        if (end - start > 48 * 3600e3) { alert('A fast can be at most 48 hours.'); return; }
        if (end > Date.now() + 60000) { alert("The end can't be in the future."); return; }
        session.e = end;
    }
    session.s = start;
    if (!session.e) {
        if (fastEdit.goal) session.g = fastEdit.goal;
        else delete session.g;
    }
    habit.sessions.sort((a, b) => a.s - b.s);
    save();
    $('#sheet-fast').hidden = true;
    if (fastEdit.fromToday) renderToday();
    else openDetail(habit.id, true);
});

$('#btn-fast-delete').addEventListener('click', () => {
    const habit = state.habits.find(h => h.id === fastEdit.habitId);
    const session = fastEdit.session;
    habit.sessions = habit.sessions.filter(x => x !== session);
    const fromToday = fastEdit.fromToday;
    save();
    $('#sheet-fast').hidden = true;
    if (fromToday) renderToday();
    else openDetail(habit.id, true);
    showToast(session.e ? 'Fast deleted' : 'Running fast deleted', () => {
        habit.sessions.push(session);
        habit.sessions.sort((a, b) => a.s - b.s);
        save();
        if (fromToday) renderToday();
        else openDetail(habit.id, true);
    });
});

$('#btn-back').addEventListener('click', () => showScreen('today'));

$('#btn-delete').addEventListener('click', () => {
    const habit = state.habits.find(h => h.id === detailId);
    if (!habit) return;
    if (!confirm(`Delete “${habit.name}” and all of its history? This cannot be undone.`)) return;
    state.habits = state.habits.filter(h => h.id !== detailId);
    save();
    showScreen('today');
});

$('#btn-edit').addEventListener('click', () => openSheet(detailId));

function showScreen(which) {
    $('#screen-today').hidden = which !== 'today';
    $('#screen-detail').hidden = which !== 'detail';
    $('#screen-stats').hidden = which !== 'stats';
    if (which === 'today') renderToday();
    if (which === 'stats') renderStats();
    window.scrollTo(0, 0);
}

/* ================= stats screen ================= */

function monthStats(habit, y, m) {
    const done = doneSet(habit);
    const skip = skipSet(habit);
    const today = new Date();
    let start = new Date(y, m, 1);
    const created = keyToDate(habit.createdAt || dateKey(today));
    const firstKey = Object.keys(done).sort()[0];
    const tracked = firstKey && keyToDate(firstKey) < created ? keyToDate(firstKey) : created;
    if (tracked > start) start = tracked;
    const lastOfMonth = new Date(y, m + 1, 0);
    const end = lastOfMonth < today ? lastOfMonth : today;
    let sched = 0;
    let dn = 0;
    for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
        const k = dateKey(d);
        if (done[k]) dn++;
        if (isScheduled(habit, d) && !skip[k]) sched++;
    }
    return { dn, sched, pct: sched ? Math.round(100 * dn / sched) : 0 };
}

function renderStats() {
    const body = $('#stats-body');
    body.innerHTML = '';
    const now = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const habits = state.habits.filter(h => !h.archived);
    if (!habits.length) {
        body.innerHTML = '<p class="cal-hint">No habits yet.</p>';
        return;
    }
    habits.forEach(habit => {
        const card = document.createElement('div');
        card.className = 'detail-card stats-card';
        card.style.cursor = 'pointer';
        const weekly = habit.type === 'weekly';
        const cur = weekly ? weeklyStreak(habit) : currentStreak(habit);
        const best = weekly ? weeklyStats(habit).best : longestStreak(habit);
        const unit = weekly ? 'wk' : 'd';
        const mNow = monthStats(habit, now.getFullYear(), now.getMonth());
        const mPrev = monthStats(habit, prev.getFullYear(), prev.getMonth());
        const monthVal = (m) => weekly ? `${m.dn}\u00d7` : (m.sched ? m.pct + '%' : '\u2013');

        const h = document.createElement('h3');
        h.innerHTML = `<span class="habit-icon" style="color:${habit.color}">${icon(habit.icon)}</span>${escapeHtml(habit.name)}`;
        card.appendChild(h);

        const tiles = document.createElement('div');
        tiles.className = 'tile-row';
        [[`${cur}${unit}`, 'streak'], [`${best}${unit}`, 'best'],
         [monthVal(mNow), 'this month'], [monthVal(mPrev), 'last month']].forEach(([v, l]) => {
            const t = document.createElement('div');
            t.className = 'tile';
            t.innerHTML = `<div class="tile-num" style="color:${habit.color}">${v}</div>` +
                `<div class="tile-lbl">${l}</div>`;
            tiles.appendChild(t);
        });
        card.appendChild(tiles);

        // last 30 days as a pixel strip
        const done = doneSet(habit);
        const skip = skipSet(habit);
        const strip = document.createElement('div');
        strip.className = 'strip-grid';
        for (let i = 29; i >= 0; i--) {
            const k = dateKey(addDays(now, -i));
            const px = document.createElement('span');
            px.className = 'px';
            if (done[k]) px.style.background = habit.color;
            else if (skip[k]) {
                px.classList.add('skip');
                px.style.color = habit.color;
            }
            strip.appendChild(px);
        }
        card.appendChild(strip);
        card.addEventListener('click', () => openDetail(habit.id));
        body.appendChild(card);
    });
}

$('#btn-stats').addEventListener('click', () => showScreen('stats'));
$('#btn-stats-back').addEventListener('click', () => showScreen('today'));

/* ================= add / edit sheet ================= */

const sheet = {
    editingId: null,
    icon: ICON_NAMES_HABIT[0],
    color: PALETTE[0],
    type: 'daily',
    days: [true, true, true, true, true, true, true],
    target: 3
};

function openSheet(editId) {
    sheet.editingId = editId || null;
    const habit = editId ? state.habits.find(h => h.id === editId) : null;
    sheet.icon = habit ? habit.icon : ICON_NAMES_HABIT[0];
    sheet.color = habit ? habit.color : PALETTE[state.habits.length % PALETTE.length];
    sheet.type = habit ? habit.type : 'daily';
    sheet.days = habit && habit.days ? [...habit.days] : [true, true, true, true, true, true, true];
    sheet.target = habit && habit.target ? habit.target : 3;

    $('#sheet-title').textContent = habit ? 'Edit habit' : 'New habit';
    $('#f-name').value = habit ? habit.name : '';
    $('#f-icon-search').value = '';
    $('#f-goal').value = habit && habit.goalHours ? habit.goalHours : '';
    renderSheetChips();
    $('#sheet-edit').hidden = false;
    if (!habit) setTimeout(() => $('#f-name').focus(), 250);
}

function renderSheetChips() {
    // icons, filtered by the search box (names + English/German keywords)
    const q = ($('#f-icon-search').value || '').trim().toLowerCase();
    const names = ICON_NAMES_HABIT.filter(n =>
        !q || n.toLowerCase().includes(q) || (ICON_KEYWORDS[n] || '').includes(q));
    const iconRow = $('#f-icons');
    iconRow.innerHTML = '';
    $('#f-icons-empty').hidden = names.length > 0;
    names.forEach(ic => {
        const c = document.createElement('button');
        c.type = 'button';
        c.className = 'chip' + (ic === sheet.icon ? ' sel' : '');
        c.innerHTML = icon(ic);
        c.setAttribute('aria-label', ic);
        c.addEventListener('click', () => { sheet.icon = ic; renderSheetChips(); });
        iconRow.appendChild(c);
    });

    // colors
    const colorRow = $('#f-colors');
    colorRow.innerHTML = '';
    PALETTE.forEach(col => {
        const c = document.createElement('button');
        c.type = 'button';
        c.className = 'chip color-chip' + (col === sheet.color ? ' sel' : '');
        c.style.setProperty('--chip-color', col);
        c.addEventListener('click', () => { sheet.color = col; renderSheetChips(); });
        colorRow.appendChild(c);
    });

    // type (locked while editing — history formats differ)
    document.querySelectorAll('.type-btn').forEach(btn => {
        btn.classList.toggle('sel', btn.dataset.type === sheet.type);
        btn.disabled = !!sheet.editingId;
        btn.onclick = () => { sheet.type = btn.dataset.type; renderSheetChips(); };
    });

    // fasting goal (timer only), scheduled days (daily only), target (weekly only)
    $('#f-goal-wrap').hidden = sheet.type !== 'timer';
    $('#f-days-wrap').hidden = sheet.type !== 'daily';
    $('#f-target-wrap').hidden = sheet.type !== 'weekly';
    const targetRow = $('#f-target');
    targetRow.innerHTML = '';
    for (let n = 1; n <= 7; n++) {
        const c = document.createElement('button');
        c.type = 'button';
        c.className = 'chip day-chip' + (n === sheet.target ? ' sel' : '');
        c.textContent = n;
        c.addEventListener('click', () => { sheet.target = n; renderSheetChips(); });
        targetRow.appendChild(c);
    }
    const dayRow = $('#f-days');
    dayRow.innerHTML = '';
    DAY_NAMES.forEach((n, i) => {
        const c = document.createElement('button');
        c.type = 'button';
        c.className = 'chip day-chip' + (sheet.days[i] ? ' sel' : '');
        c.textContent = n;
        c.addEventListener('click', () => {
            if (sheet.days[i] && sheet.days.filter(Boolean).length === 1) return; // keep at least one day
            sheet.days[i] = !sheet.days[i];
            renderSheetChips();
        });
        dayRow.appendChild(c);
    });
}

$('#f-icon-search').addEventListener('input', renderSheetChips);

$('#btn-add').addEventListener('click', () => openSheet(null));
$('#btn-sheet-cancel').addEventListener('click', () => { $('#sheet-edit').hidden = true; });
$('#sheet-edit').addEventListener('click', (e) => {
    if (e.target === $('#sheet-edit')) $('#sheet-edit').hidden = true;
});

$('#btn-sheet-save').addEventListener('click', () => {
    const name = $('#f-name').value.trim();
    if (!name) { $('#f-name').focus(); return; }
    const g = parseFloat(String($('#f-goal').value).replace(',', '.'));
    const goalHours = isFinite(g) && g > 0 && g <= 48 ? g : null;

    if (sheet.editingId) {
        const habit = state.habits.find(h => h.id === sheet.editingId);
        if (habit) {
            habit.name = name;
            habit.icon = sheet.icon;
            habit.color = sheet.color;
            habit.days = [...sheet.days];
            if (habit.type === 'timer') habit.goalHours = goalHours;
            if (habit.type === 'weekly') habit.target = sheet.target;
        }
    } else {
        state.habits.push({
            id: newId(),
            name,
            icon: sheet.icon,
            color: sheet.color,
            type: sheet.type,
            days: [...sheet.days],
            goalHours: sheet.type === 'timer' ? goalHours : null,
            target: sheet.type === 'weekly' ? sheet.target : null,
            createdAt: dateKey(new Date()),
            done: {},
            sessions: []
        });
    }
    save();
    $('#sheet-edit').hidden = true;
    if (sheet.editingId) openDetail(sheet.editingId);
    else renderToday();
});

/* ================= reorder sheet ================= */

function renderReorder() {
    const list = $('#reorder-list');
    list.innerHTML = '';
    state.habits.forEach((h, i) => {
        const row = document.createElement('div');
        row.className = 'reorder-row';
        const name = document.createElement('span');
        name.className = 'reorder-name';
        name.innerHTML = `<span style="color:${h.color}">${icon(h.icon)}</span>${escapeHtml(h.name)}`;
        const up = document.createElement('button');
        up.className = 'pill-btn icon-only';
        up.innerHTML = icon('chevU');
        up.disabled = i === 0;
        up.setAttribute('aria-label', 'Move up');
        up.addEventListener('click', () => {
            [state.habits[i - 1], state.habits[i]] = [state.habits[i], state.habits[i - 1]];
            save();
            renderReorder();
        });
        const down = document.createElement('button');
        down.className = 'pill-btn icon-only';
        down.innerHTML = icon('chevD');
        down.disabled = i === state.habits.length - 1;
        down.setAttribute('aria-label', 'Move down');
        down.addEventListener('click', () => {
            [state.habits[i], state.habits[i + 1]] = [state.habits[i + 1], state.habits[i]];
            save();
            renderReorder();
        });
        row.appendChild(name);
        row.appendChild(up);
        row.appendChild(down);
        list.appendChild(row);
    });
}

$('#btn-reorder').addEventListener('click', () => {
    $('#sheet-settings').hidden = true;
    renderReorder();
    $('#sheet-reorder').hidden = false;
});
$('#btn-reorder-close').addEventListener('click', () => {
    $('#sheet-reorder').hidden = true;
    renderToday();
});
$('#sheet-reorder').addEventListener('click', (e) => {
    if (e.target === $('#sheet-reorder')) {
        $('#sheet-reorder').hidden = true;
        renderToday();
    }
});

/* ================= archive ================= */

$('#btn-archive').addEventListener('click', () => {
    const habit = state.habits.find(h => h.id === detailId);
    if (!habit) return;
    habit.archived = true;
    save();
    showScreen('today');
    showToast(`\u201c${habit.name}\u201d archived`, () => {
        habit.archived = false;
        save();
        renderToday();
    });
});

function renderArchived() {
    $('#archived-count').textContent = state.habits.filter(h => h.archived).length;
    const list = $('#archived-list');
    list.innerHTML = '';
    const archived = state.habits.filter(h => h.archived);
    if (!archived.length) {
        const empty = document.createElement('p');
        empty.className = 'cal-hint';
        empty.textContent = 'Nothing here \u2014 archive a habit from its detail view.';
        list.appendChild(empty);
    }
    archived.forEach(h => {
        const row = document.createElement('div');
        row.className = 'archived-row';
        const name = document.createElement('span');
        name.className = 'reorder-name';
        name.innerHTML = `<span style="color:${h.color}">${icon(h.icon)}</span>${escapeHtml(h.name)}`;
        const restore = document.createElement('button');
        restore.className = 'restore-btn';
        restore.textContent = 'Restore';
        restore.addEventListener('click', () => {
            h.archived = false;
            save();
            renderArchived();
            renderToday();
        });
        row.appendChild(name);
        row.appendChild(restore);
        list.appendChild(row);
    });
}

$('#btn-archived').addEventListener('click', () => {
    $('#sheet-settings').hidden = true;
    renderArchived();
    $('#sheet-archived').hidden = false;
});
/* bring a dismissed week review back on demand */
$('#btn-weekreview').addEventListener('click', () => {
    delete state.settings.lastReviewWeek;
    save();
    $('#sheet-settings').hidden = true;
    renderToday();
    const box = $('#week-review');
    if (box.hidden) showToast('Nothing to review yet \u2014 come back after your first tracked week');
    else box.scrollIntoView({ behavior: 'smooth', block: 'end' });
});

$('#btn-archived-close').addEventListener('click', () => { $('#sheet-archived').hidden = true; });
$('#sheet-archived').addEventListener('click', (e) => {
    if (e.target === $('#sheet-archived')) $('#sheet-archived').hidden = true;
});

/* ================= layout toggle ================= */

function updateLayoutLabel() {
    $('#layout-label').textContent = 'Layout: ' + state.settings.layout;
}

$('#btn-layout').addEventListener('click', () => {
    state.settings.layout = state.settings.layout === 'grid' ? 'list' : 'grid';
    save();
    updateLayoutLabel();
    renderToday();
});

function updateThemeLabel() {
    $('#theme-label').textContent = 'Theme: ' + state.settings.theme;
}

$('#btn-theme').addEventListener('click', () => {
    const order = ['auto', 'light', 'dark'];
    state.settings.theme = order[(order.indexOf(state.settings.theme) + 1) % 3];
    save();
    applyTheme();
    updateThemeLabel();
});

async function updateStorageNote() {
    const el = $('#storage-note');
    try {
        const persisted = navigator.storage && await navigator.storage.persisted();
        let size = '';
        if (navigator.storage && navigator.storage.estimate) {
            const est = await navigator.storage.estimate();
            if (est.usage) size = ' \u00b7 ' + Math.max(1, Math.round(est.usage / 1024)) + ' KB';
        }
        el.textContent = (persisted ? 'Storage: protected' : 'Storage: not yet protected') + size;
    } catch (e) {
        el.textContent = '';
    }
}

/* ================= settings / backup ================= */

$('#btn-settings').addEventListener('click', () => {
    updateLayoutLabel();
    updateThemeLabel();
    updateBackupNote();
    updateStorageNote();
    $('#archived-count').textContent = state.habits.filter(h => h.archived).length;
    $('#sheet-settings').hidden = false;
});
$('#btn-settings-close').addEventListener('click', () => { $('#sheet-settings').hidden = true; });
$('#sheet-settings').addEventListener('click', (e) => {
    if (e.target === $('#sheet-settings')) $('#sheet-settings').hidden = true;
});
$('#app-version').textContent = 'AMS Tracking v' + APP_VERSION;

$('#btn-export').addEventListener('click', async () => {
    const json = JSON.stringify(state, null, 2);
    const filename = 'ams-tracking-backup-' + dateKey(new Date()) + '.json';
    try {
        const file = new File([json], filename, { type: 'application/json' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file] });
        } else {
            const a = document.createElement('a');
            a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
            a.download = filename;
            a.click();
            URL.revokeObjectURL(a.href);
        }
        state.settings.lastBackup = Date.now();
        save();
        updateBackupNote();
        showToast('Backup saved');
    } catch (err) {
        if (!err || err.name !== 'AbortError') alert('Backup failed: ' + (err && err.message));
    }
});

function csvField(v) {
    const s = String(v);
    return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function fmtCsvDateTime(ms) {
    const d = new Date(ms);
    return dateKey(d) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}

async function exportCsv() {
    // Semicolon-separated with decimal commas: opens cleanly in DACH Excel
    const dayRows = ['date;habit;type;status;note'];
    const fastRows = ['habit;start;end;hours'];
    state.habits.forEach(h => {
        const done = doneSet(h);
        const skip = skipSet(h);
        const notes = h.notes || {};
        const keys = [...new Set([...Object.keys(done), ...Object.keys(skip), ...Object.keys(notes)])].sort();
        keys.forEach(k => {
            const status = done[k] ? 'done' : skip[k] ? 'skip' : '';
            dayRows.push([k, csvField(h.name), h.type, status, csvField(notes[k] || '')].join(';'));
        });
        (h.sessions || []).filter(s => s.e).forEach(s => {
            const hours = ((s.e - s.s) / 3600e3).toFixed(2).replace('.', ',');
            fastRows.push([csvField(h.name), fmtCsvDateTime(s.s), fmtCsvDateTime(s.e), hours].join(';'));
        });
    });
    const stamp = dateKey(new Date());
    const files = [
        new File([dayRows.join('\n')], `ams-tracking-days-${stamp}.csv`, { type: 'text/csv' }),
        new File([fastRows.join('\n')], `ams-tracking-fasts-${stamp}.csv`, { type: 'text/csv' })
    ];
    try {
        if (navigator.canShare && navigator.canShare({ files })) {
            await navigator.share({ files });
        } else {
            files.forEach(f => {
                const a = document.createElement('a');
                a.href = URL.createObjectURL(f);
                a.download = f.name;
                a.click();
                URL.revokeObjectURL(a.href);
            });
        }
        showToast('CSV exported');
    } catch (err) {
        if (!err || err.name !== 'AbortError') alert('CSV export failed: ' + (err && err.message));
    }
}

$('#btn-csv').addEventListener('click', exportCsv);

function updateBackupNote() {
    const el = $('#backup-note');
    const last = state.settings.lastBackup;
    if (!last) {
        const hasData = state.habits.some(h => Object.keys(doneSet(h)).length || (h.sessions || []).length);
        el.innerHTML = hasData ? '<span class="stale">No backup yet.</span>' : 'No backup yet.';
        return;
    }
    const days = Math.floor((Date.now() - last) / 86400e3);
    const text = days === 0 ? 'Last backup: today.' :
        days === 1 ? 'Last backup: yesterday.' : `Last backup: ${days} days ago.`;
    el.innerHTML = days > 30 ? `<span class="stale">${text}</span>` : text;
}

$('#btn-import').addEventListener('click', () => $('#import-file').click());
$('#import-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
        try {
            const data = JSON.parse(reader.result);
            if (!data || !Array.isArray(data.habits)) throw new Error('Not an AMS Tracking backup');
            if (!confirm(`Replace current data with this backup (${data.habits.length} habits)?`)) return;
            state = data;
            save();
            $('#sheet-settings').hidden = true;
            renderToday();
        } catch (err) {
            alert('Import failed: ' + err.message);
        }
    };
    reader.readAsText(file);
});

/* ================= misc ================= */

function escapeHtml(s) {
    return s.replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(err => console.error('SW registration failed', err));
    });
}

document.querySelectorAll('[data-hi]').forEach(el => { el.innerHTML = icon(el.dataset.hi); });

$('#toast-undo').addEventListener('click', () => {
    const t = $('#toast');
    t.hidden = true;
    if (t._undo) { const fn = t._undo; t._undo = null; fn(); }
});

/* drag a bottom sheet down (from its top, or when scrolled to the top) to close it */
function setupSheetDismiss() {
    [['#sheet-edit', null], ['#sheet-settings', null], ['#sheet-fast', null],
     ['#sheet-reorder', () => renderToday()], ['#sheet-archived', null], ['#sheet-startgoal', null],
     ['#sheet-skiprange', null]]
        .forEach(([sel, after]) => {
            const backdrop = document.querySelector(sel);
            const sheetEl = backdrop.querySelector('.sheet');
            let startY = null;
            let delta = 0;
            let dragging = false;
            sheetEl.addEventListener('touchstart', (e) => {
                if (sheetEl.scrollTop > 0) return;
                startY = e.touches[0].clientY;
                delta = 0;
                dragging = false;
            }, { passive: true });
            sheetEl.addEventListener('touchmove', (e) => {
                if (startY === null) return;
                delta = e.touches[0].clientY - startY;
                if (delta > 8) dragging = true;
                if (dragging && delta > 0) {
                    sheetEl.style.transition = 'none';
                    sheetEl.style.transform = `translateY(${delta}px)`;
                    if (e.cancelable) e.preventDefault();
                }
            }, { passive: false });
            sheetEl.addEventListener('touchend', () => {
                if (startY === null) return;
                startY = null;
                sheetEl.style.transition = 'transform 0.2s ease';
                if (dragging && delta > 90) {
                    sheetEl.style.transform = 'translateY(110%)';
                    setTimeout(() => {
                        backdrop.hidden = true;
                        sheetEl.style.transition = '';
                        sheetEl.style.transform = '';
                        if (after) after();
                    }, 180);
                } else {
                    sheetEl.style.transform = '';
                    setTimeout(() => { sheetEl.style.transition = ''; }, 220);
                }
            });
        });
}
setupSheetDismiss();

$('#btn-update').addEventListener('click', () => {
    $('#sheet-settings').hidden = true;
    checkForUpdate(true);
});
setTimeout(() => checkForUpdate(false), 2500);

/* Voice / Shortcut commands: ?fast=start | stop | toggle acts on the
   first (non-archived) fasting habit, so a Siri Shortcut opening that
   URL starts or ends the fast. */
function handleUrlAction() {
    const action = new URLSearchParams(location.search).get('fast');
    if (!action) return;
    history.replaceState(null, '', location.pathname);
    const habit = state.habits.find(h => h.type === 'timer' && !h.archived);
    if (!habit) {
        showToast('No fasting habit found');
        return;
    }
    const active = activeSession(habit);
    if (action === 'start' || (action === 'toggle' && !active)) {
        if (active) showToast(`Already fasting \u2014 ${fmtDuration(Date.now() - active.s)} h`);
        else startFast(habit, null);
    } else if (action === 'stop' || (action === 'toggle' && active)) {
        if (!active) showToast('No fast is running');
        else toggleTimer(habit);
    }
}
handleUrlAction();

applyTheme();
if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().catch(() => {});
}

save();
renderToday();
