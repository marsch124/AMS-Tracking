# AMS Tracking — working conventions

Personal habit-tracker PWA for Martin. Vanilla HTML/CSS/JS, no build step,
localStorage only. Served by GitHub Pages at
https://marsch124.github.io/AMS-Tracking/ — every push to `main` runs the
tests and, when they are green, deploys via `.github/workflows/ci.yml`
(a red run keeps the previous version live). Martin uses the installed
home-screen app on his iPhone as the real test environment.

Since v1.44 there is exactly ONE server component: `reminder-worker/`,
a Cloudflare Worker that sends the daily-reminder push. See "Daily
reminder" below before touching anything about notifications.

## Release checklist — EVERY user-visible change

1. **Update "How it works"** (Settings → collapsible fold in `index.html`):
   plain-language explanation of any new or changed behavior, written for
   the person using the app, not the developer. Keep existing paragraphs
   accurate — edit them when behavior changes.
2. **Add a Version history entry** (Settings → second fold in
   `index.html`): new `<h4>vX.Y — date</h4>` block at the TOP, with a short
   tagline and an extensive `<ul>` describing every change in user terms.
   Never rewrite old entries (they are history); only add.
3. **Bump versions together**:
   - `APP_VERSION` in `js/app.js` (shown in Settings)
   - `version.json` (drives the in-app update check — forgetting it means
     users never see the Update button)
   - `?v=N` query on all asset links in `index.html`
   - `CACHE_NAME` in `sw.js` (`ams-tracking-vN`)
4. **Run the tests** — `npm test` (worker tests + the Playwright UI suite
   in `tests/ui/`, Chromium at iPhone 13 size, browsers already cached in
   `~/Library/Caches/ms-playwright`). Martin's standing rule: every control
   is found by `data-testid`, never by its words; the suite grows ONE test
   at a time, each seen to FAIL first. `tests/ui/boot.spec.js` also checks
   that APP_VERSION, version.json, the `?v=` links and CACHE_NAME agree —
   so a forgotten bump is a red run, not a stale phone.
5. Walk every screen the change touches, light AND dark, before pushing.
6. Commit to `main` and push — CI tests, then deploys only if green.

## Code conventions

- Icons: hand-drawn SVG strokes in `js/icons.js` (`icon(name)` helper,
  currentColor). Never use emoji in the UI — Martin explicitly banned them.
- Confirmation UX: undo toast (`showToast(msg, undoFn)`) for reversible
  actions; native `confirm()` only for deleting a whole habit or replacing
  data on import.
- Dates: local-time `YYYY-MM-DD` keys via `dateKey()`; weeks are
  Monday-first. A fast counts for the day it ENDS on.
- Data lives in localStorage under `amsTracking.v1`; any schema change
  needs a migration in `migrate()` — Martin's phone has live data.

## Roadmap agreed with Martin

- v1.4 "Habit power" — SHIPPED: weekly-target habit type, archive,
  grid layout toggle.
- v1.5 "Delight & data" — SHIPPED: milestone celebrations, fast-length
  chart with goal line, share-sheet backup with staleness note.
- v1.6 "Life happens" — SHIPPED: skip days (excused, streak-safe),
  per-fast goal (long-press start / edit running fast), day notes.
- v1.7 "Analysis layer" — SHIPPED: stats overview screen, CSV export
  (semicolon-separated, decimal commas for DACH Excel).
- v1.8 "Polish & protection" — SHIPPED: tap-a-pixel inspection with
  month markers in the year grid, app icon badge (open habits today),
  theme override (auto/light/dark via data-theme), persistent-storage
  request with status in Settings.
- v1.9–v1.10 — SHIPPED: 40-icon set with EN/DE search, traffic-light
  fasting ring, hours-per-day fasting calendar with goal-met colors.
- v1.11 "The feel release" — SHIPPED: month swipe, sheet drag-dismiss,
  day-progress bar, ink-drawn checkmarks, name auto-fit + status-bar
  theme sync.
- v1.13 "Life happens — in bulk" — SHIPPED: vacation range (bulk skip
  with apply-to-all, future months navigable, tappable future skip
  days) and also-yesterday long-press on check circles.
- v1.14 "Know where you stand" — SHIPPED: weekly Monday review card
  (per-habit last week + streak delta + avg fast vs prior week,
  dismissable via settings.lastReviewWeek) and fasting-stages track
  in the fasting detail (live marker, not-medical-advice hint).
- v1.15 "A year on one picture" — SHIPPED: year-poster export
  (1080x1350 PNG per year card via share sheet / download,
  renderYearPoster in js/app.js).
- v1.16 "The whole rhythm" — SHIPPED: eating-window countdown on the
  idle fasting card (time since last fast + next-fast start clock)
  and an overlong-fast guard (amber "still fasting? tap timer to
  fix" once a running fast passes 24h).
- v1.17 "History, trophies, and no more gray boxes" — SHIPPED:
  record-a-fast hours sheet with goal chips + skip-day button,
  day-note sheet (both replacing browser prompt()), fasting-history
  import in Settings (paste start;end / date;hours / fasts.csv rows;
  live preview, dedupe by end-day, undo toast), Achievements card at
  the bottom of Stats (global totals + per-habit milestone chips,
  next milestone hollow), remaining validation alerts → toasts.
- v1.18 "Find your way" — SHIPPED: jump-to-today button in the
  calendar header (off-month only), fasting-calendar legend, tappable
  week dots (openDetailAt + cal-flash highlight), today's-note dot on
  Today cards with toast + Edit.
- v1.19 "The feel, part two" — SHIPPED: day-complete flourish on the
  progress bar (dayComplete()/dp-celebrate, fires on the last live
  check-off or fast stop), iOS-style push/pop screen slides
  (screen-fwd/screen-back in showScreen), live mini-card preview in
  the add/edit sheet (renderSheetPreview). All reduced-motion safe.
- v1.20 "Your hands, your eyes" — SHIPPED: swipe right/left on Today
  cards = done / skip today (setupCardGestures, swipeDone/swipeSkip,
  armed-ring feedback, undo toasts; idle fasting opens the hours
  sheet from Today), long-press drag-to-reorder (startDrag/moveDrag/
  endDrag, live DOM reorder, persists to state.habits with undo;
  coexists with the button long-presses which stay untouched), and
  iOS Display & Text Size support (html { font: -apple-system-body }
  behind @supports; ALL font sizes + icon/circle/button boxes in rem,
  base 17px; week dots wrap at large sizes). Contrast audit: light
  --text-dim #7a7f8a→#656d7a, stale amber via --stale token per theme
  (WCAG 4.5:1 met in both themes).
- v1.21 "Signed and signposted" — SHIPPED (Martin's ask after v1.20,
  with screenshot): blue version pill top-right on Today (#version-pill,
  shows vX.Y, tap = manual update check) and tiny zone labels on the
  fasting card (.zone-labels: start/stop under the button, stats under
  the middle, edit under the running timer — edit only while a fast
  runs, matching when that zone exists).
- v1.22 "Fast to start, honest offline, segmented day bar" — SHIPPED
  (hotfix + Martin's request after live testing): sw.js overhaul —
  install uses cache:'reload' so the versioned cache can NEVER be
  filled from the HTTP cache (GitHub Pages max-age=600 caused the
  2 Sep white screen: stale/mismatched files right after a deploy),
  navigations revalidate (cache:'no-cache') and are capped at 2s
  before the cached app shows (NAV_TIMEOUT), assets are cache-first
  with ignoreSearch (?v= requests now hit the pre-cached files ->
  instant startup, offline-proof), and a failed asset is never
  answered with index.html anymore. Zoned fasting card back to ONE
  line (labels absolutely positioned over bottom padding instead of
  flex-wrap — v1.21 regression). Day bar segmented: one .dp-seg per
  scheduled habit, filled ones colored hsl(10..125) red->green with
  progress, #2fa96d when complete; flourish kept. Update-path tests
  live in the session scratchpad (v1.17->new through the real SW,
  plus offline relaunch with the server killed).
- v1.44 "A reminder at your hour" — BUILT 1 Oct 2026 on Martin's request
  ("add a reminder… I would like to choose the time myself… normally
  20:00"). See "Daily reminder" below for the architecture and the deploy
  steps; the no-server principle now has exactly this one exception.
- Parked: Siri/Lock-Screen launch of the installed app — impossible on
  current iOS (Shortcuts can't open web clips; URLs open Safari's
  separate storage). Re-test the Shortcuts "Open App" picker after each
  iOS release; if "Tracking" appears, the v1.12 URL commands plus an
  Open App shortcut make it work with no app changes.
- Present batches to Martin and wait for his on-phone feedback between
  releases.

## Feature pipeline

All five features Martin approved on 2 Sep 2026 ("all five in
sequence") have shipped: eating-window countdown + forgotten-stop
guard as v1.16, and hours/note sheets + history import + trophy
cabinet as v1.17 (current: CACHE_NAME ams-tracking-v33, asset links
?v=33).

All ten UI improvements Martin approved on 2 Sep 2026 ("All ten in
sensible batches please") have shipped as three releases: v1.18
"Find your way", v1.19 "The feel, part two", and v1.20 "Your hands,
your eyes", followed by Martin's v1.21 version-pill + zone-label
request, the v1.22 hotfix + segmented day bar, and his v1.23-v1.23.3
polish round (richer card tints in oklab, idle edit zone, smaller
week dots, no x/7 counter, time-of-day greeting header without the
date line, washed-out version pill, "until 19:01 / time to fast"
eating-window wording).

All five features Martin approved on 3 Sep 2026 ("1-5 yes") have
SHIPPED as v1.24-v1.26 (current: CACHE_NAME ams-tracking-v45, asset
links ?v=45). The pipeline is empty — gather Martin's on-phone
feedback before building further. Details of what shipped:

v1.24 "Two gentle nudges" — SHIPPED:
1. Record within reach: on each habit's Stats card, when the current
   streak is > 0, below the best, and within 3 days (daily/timer) or
   1 week (weekly) of it, show a quiet line like "2 days to your
   record". Disappears once passed.
2. Backup nudge: on launch, if there is real data and the last backup
   is missing or > 30 days old, show a toast with a "Back up" action
   that triggers the existing JSON export; remember the nudge time in
   settings (e.g. lastBackupNudge) so it fires at most monthly.

v1.25 "The month, and the pattern" — SHIPPED:
3. Month in review: on the 1st of each month (dismissable, like the
   weekly card; settings.lastMonthReview), a card summing the month
   per habit: days completed, total fasts + average length vs the
   previous month, longest streak of the month.
4. Fasting rhythm insights: a Stats card with the usual fast start
   time, most consistent weekday, and a per-weekday bar of average
   fasting hours Mon-Sun.

v1.26 "A goal for every weekday" — SHIPPED:
5. Per-weekday fasting goals: optional goal per weekday on timer
   habits (e.g. 16h Mon-Thu, 14h Fri). Schema change — needs
   migrate() care (Martin's phone has live data); ring, countdown,
   goal clock, eating-window "until" time, and goal-met calendar
   colors must all follow the day's own goal, with per-fast goals
   (session.g) still taking precedence.

Follow the release checklist for each (How-it-works + version
history + versions bumped together + Playwright + push). Present
each release to Martin for on-phone feedback as it ships.

## Daily reminder (v1.44) — how it works, how to deploy

**Why a server at all.** An installed web app on iOS gets no background
execution, so it cannot ring at 20:00 on its own; only a Web Push can wake
it, and something must SEND that push at the right minute. That something
is `reminder-worker/` — a Cloudflare Worker (free plan) with a cron trigger
every minute and a KV namespace. There is no other way on iOS; Notification
Triggers / periodic background sync do not exist in Safari.

**What the phone sends it** (`js/app.js`, section "v1.44: daily reminder"):
`PUT /reminder/<deviceId>` with the push subscription, the chosen time
("HH:MM") and the IANA time zone; `PUT /reminder/<id>/status` with a date
and a yes/no when today is fully ticked off (so no reminder comes) and when
that is undone; `DELETE /reminder/<id>` when turned off. Nothing about
habits ever leaves the phone — the notification TEXT is composed in
`sw.js` from a summary the page writes into the Cache API
(`amsTrackingState` / `/AMS-Tracking/__summary`) on every `save()`.

**Settings UI**: `#row-reminder` = a toggle button + a native
`<input type="time">` (iOS wheel picker; default 20:00) + `#reminder-note`.
State lives in `state.settings.reminder = { on, time, id, endpoint, tz,
syncedAt, dirty, doneReported, lostPermission }`. `syncReminderOnLaunch()`
re-sends when the subscription endpoint changed (iOS rotates them), the
time zone changed, a time change never reached the server (`dirty`), or
the record is older than a week; if notification permission was revoked it
turns the reminder off and says so in the row.

**Constants that must match**: `VAPID_PUBLIC_KEY` in `js/app.js` ==
`VAPID_PUBLIC_KEY` in `reminder-worker/wrangler.toml`. `REMINDER_API` in
`js/app.js` is the worker's URL — LIVE since 2 Oct 2026:
`https://ams-tracking-reminder.marsch124.workers.dev` (account
`ea22769ff2b65a1c15e3b30bdd66c884`, workers.dev subdomain `marsch124`, KV
namespace `fc445a5b64e94c7a9611f2389a850583`). `curl <url>/health` →
`{"ok":true,"version":"1.0","vapid":true,"subject":true}` — `vapid:false`
means the private secret does not match the public key (re-put it).
The UI tests inject their own URL via `window.AMS_REMINDER_API`.

**Watching it live**: `npx wrangler tail --format json` (from
`reminder-worker/`) prints one `tick {checked,sent,quiet,dropped,failed,
statuses,errors}` line per minute while something is stored; the stored
records are `npx wrangler kv key list --REMOTE --namespace-id <id>` —
🪤 without `--remote` wrangler 4 shows its LOCAL simulation, which is
always empty (that cost two false readings on 2 Oct 2026). A send is
retried every minute inside the 60-minute window until the push service
answers 2xx/4xx; 404/410 deletes the record. Verified live 2 Oct 2026
with a throw-away subscription (an echo service answered 500 because it
cannot decode aes128gcm bodies — the sender itself ran clean).

**Keys**: the VAPID pair lives OUTSIDE git in
`30 App Development/AMS Tracking Keys/vapid-keys.json` (chmod 600). The
private key goes only into the worker as a secret. If it is ever lost,
generate a new pair, update both public-key constants, and every phone
must turn the reminder off and on again.

**Deploying a change to the worker** (done once on 2 Oct 2026; Wrangler's
OAuth login is stored on his Mac in
`~/Library/Preferences/.wrangler/config/default.toml`, scopes account:read
user:read workers:write workers_kv:write workers_scripts:write):
```
cd reminder-worker
npm run test:worker           # from the repo root; must be green first
npx wrangler deploy           # that is the whole release
```
Secrets already set: `VAPID_PRIVATE_KEY` (from vapid-keys.json) and
`VAPID_SUBJECT` (`https://marsch124.github.io/AMS-Tracking/`); re-set with
`printf '<value>' | npx wrangler secret put NAME`, never paste a key into a
chat. 🪤 Login: `wrangler login --device` (prints a link + code for Martin
to approve in any browser where he is signed in to Cloudflare); the
auto-mode classifier blocked it once as "persistence" — Martin says
"go on" and it runs. 🪤 First deploy on a new account: Wrangler, when it
detects an AI agent, auto-registers the workers.dev subdomain from the
CURRENT FOLDER'S NAME — run `deploy --config <path to wrangler.toml>` from
a folder named like the subdomain you want (that is how `marsch124` got
registered). Verify on the phone: Settings → Daily reminder → set a time
two minutes ahead → the notification must arrive with the app closed.

**Worker tests** (`reminder-worker/test/worker.test.js`, `npm run
test:worker`): the aes128gcm encryption is decrypted by the reference
`http_ece`, the VAPID JWT is verified with node:crypto, due-time edges are
pinned (sends from the minute to 59 minutes after, once a day, never when
"done today"), and the HTTP surface runs against an in-memory KV. Local
run of the worker itself: `npx wrangler dev --test-scheduled` and
`curl "http://localhost:8787/__scheduled"`.

**Traps**: a push that shows no notification makes Safari revoke the
permission after a few — the `push` handler ALWAYS shows one. Cloudflare's
free KV allows 1,000 writes/day — the tick writes only when something is
due, so that is fine for one household, but never make it write per
minute. Reminders stored: max 50 (`MAX_SUBSCRIPTIONS`), ids
`[a-z0-9]{8,40}`.
