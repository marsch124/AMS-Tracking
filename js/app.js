/* AMS Tracking — simple, visual habit tracker (vanilla JS, localStorage) */
'use strict';

const APP_VERSION = '1.6';
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

function weeklyStreak(habit) {
    const target = habit.target || 1;
    let w = weekStart(new Date());
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

function currentStreak(habit) {
    const done = doneSet(habit);
    const today = new Date();
    let d = new Date(today);
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

function showToast(msg, undoFn) {
    const t = document.querySelector('#toast');
    t.querySelector('#toast-msg').textContent = msg;
    t.querySelector('#toast-undo').hidden = !undoFn;
    t._undo = undoFn || null;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 5000);
}

/* ================= today screen ================= */

const $ = (sel) => document.querySelector(sel);

function tint(color, pct) {
    return `color-mix(in srgb, ${color} ${pct}%, var(--card-fallback))`;
}

function renderToday() {
    $('#today-date').textContent = new Date().toLocaleDateString(undefined, {
        weekday: 'long', day: 'numeric', month: 'long'
    });

    const list = $('#habit-list');
    list.innerHTML = '';
    list.classList.toggle('grid-layout', state.settings.layout === 'grid');
    const visible = state.habits.filter(h => !h.archived);
    $('#empty-state').hidden = visible.length > 0;

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

    // long-press on an idle fasting button picks tonight's goal before starting
    if (habit.type === 'timer' && !active) {
        let lpTimer = null;
        btn.addEventListener('pointerdown', () => {
            lpTimer = setTimeout(() => {
                lpTimer = null;
                btn.dataset.lp = '1';
                openStartGoalSheet(habit);
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
        wrap.innerHTML = `<svg class="ring" viewBox="0 0 66 66">` +
            `<circle class="track" cx="33" cy="33" r="30" fill="none" stroke-width="4"/>` +
            `<circle class="ring-progress${progress >= 1 ? ' done' : ''}" cx="33" cy="33" r="30" fill="none" ` +
            `stroke="${habit.color}" stroke-width="4" stroke-linecap="round" ` +
            `stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - progress)}"/></svg>`;
    }
    wrap.appendChild(btn);

    // --- middle: name + week dots ---
    const main = document.createElement('div');
    main.className = 'habit-main';
    const name = document.createElement('p');
    name.className = 'habit-name';
    name.innerHTML = `<span class="habit-icon" style="color:${habit.color}">${icon(habit.icon)}</span>${escapeHtml(habit.name)}`;
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

function toggleToday(habit) {
    const key = dateKey(new Date());
    habit.done = habit.done || {};
    if (habit.skip && habit.skip[key]) delete habit.skip[key];
    if (habit.done[key]) delete habit.done[key];
    else habit.done[key] = 1;
    save();
    renderToday();
    if (habit.done[key]) maybeCelebrateStreak(habit);
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

    $('#detail-title').innerHTML =
        `<span class="habit-icon" style="color:${habit.color}">${icon(habit.icon)}</span>${escapeHtml(habit.name)}`;
    $('#detail-subtitle').textContent = habit.type === 'timer'
        ? 'Start / stop timer habit'
        : habit.type === 'weekly'
            ? `Weekly target \u00b7 ${habit.target || 1}\u00d7 per week`
            : 'Daily habit';

    const body = $('#detail-body');
    body.innerHTML = '';

    // --- editable history calendar ---
    body.appendChild(buildHistoryCard(habit));

    // --- timer: session history ---
    if (habit.type === 'timer') {
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
    next.disabled = calMonth.y === now.getFullYear() && calMonth.m === now.getMonth();
    prev.addEventListener('click', () => {
        calMonth.m--;
        if (calMonth.m < 0) { calMonth.m = 11; calMonth.y--; }
        openDetail(habit.id, true);
    });
    next.addEventListener('click', () => {
        calMonth.m++;
        if (calMonth.m > 11) { calMonth.m = 0; calMonth.y++; }
        openDetail(habit.id, true);
    });
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
            ? 'Tap a day to record a forgotten fast (0 hours marks a skip day), or to remove one.'
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
        if (key > todayKey) {
            el.disabled = true;
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
            if (notes[key]) el.classList.add('has-note');
            el.addEventListener('click', () => {
                if (noteMode) editDayNote(habit, d);
                else toggleHistoryDay(habit, d, !!done[key]);
            });
        }
        grid.appendChild(el);
    }
    card.appendChild(grid);

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
        const victims = (habit.sessions || []).filter(s => s.e && dateKey(new Date(s.e)) === key);
        habit.sessions = habit.sessions.filter(s => !victims.includes(s));
        save();
        openDetail(habit.id, true);
        showToast(victims.length === 1 ? 'Fast removed' : `${victims.length} fasts removed`, () => {
            habit.sessions.push(...victims);
            habit.sessions.sort((a, b) => a.s - b.s);
            save();
            openDetail(habit.id, true);
        });
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
    const h = document.createElement('h3');
    h.textContent = year;
    card.appendChild(h);

    const grid = document.createElement('div');
    grid.className = 'pixel-grid';
    const today = new Date();
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31);
    let doneCount = 0;
    let scheduledPast = 0;
    for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
        const px = document.createElement('span');
        px.className = 'px';
        if (d > today) px.classList.add('future');
        else if (isScheduled(habit, d)) scheduledPast++;
        if (done[dateKey(d)]) {
            px.style.background = habit.color;
            doneCount++;
        }
        grid.appendChild(px);
    }
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
        const rows = document.createElement('div');
        rows.className = 'stat-rows';
        [['Average', fmtDuration(avg) + ' h'], ['Longest', fmtDuration(max) + ' h'], ['Total fasts', String(finished.length)]]
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

function openFastSheet(habit, session) {
    fastEdit = { habitId: habit.id, session, goal: session.g || null };
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
    openDetail(habit.id, true);
});

$('#btn-fast-delete').addEventListener('click', () => {
    const habit = state.habits.find(h => h.id === fastEdit.habitId);
    const session = fastEdit.session;
    habit.sessions = habit.sessions.filter(x => x !== session);
    save();
    $('#sheet-fast').hidden = true;
    openDetail(habit.id, true);
    showToast(session.e ? 'Fast deleted' : 'Running fast deleted', () => {
        habit.sessions.push(session);
        habit.sessions.sort((a, b) => a.s - b.s);
        save();
        openDetail(habit.id, true);
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
    if (which === 'today') renderToday();
    window.scrollTo(0, 0);
}

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
    $('#f-goal').value = habit && habit.goalHours ? habit.goalHours : '';
    renderSheetChips();
    $('#sheet-edit').hidden = false;
    if (!habit) setTimeout(() => $('#f-name').focus(), 250);
}

function renderSheetChips() {
    // icons
    const iconRow = $('#f-icons');
    iconRow.innerHTML = '';
    ICON_NAMES_HABIT.forEach(ic => {
        const c = document.createElement('button');
        c.type = 'button';
        c.className = 'chip' + (ic === sheet.icon ? ' sel' : '');
        c.innerHTML = icon(ic);
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

/* ================= settings / backup ================= */

$('#btn-settings').addEventListener('click', () => {
    updateLayoutLabel();
    updateBackupNote();
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

save();
renderToday();
