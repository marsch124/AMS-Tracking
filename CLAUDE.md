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
  per-fast goal (REMOVED in v1.46/1.47 — the goal lives only in Edit habit; old session.g values are still honoured), day notes.
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
- v1.48 "A grid for an icon, and Today without a header" — BUILT 24 Nov
  2026 on Martin's request (annotated screenshot with four crosses + "I
  have never really liked the icon. Let's make it more like tracking").
  App icon = day grid (he picked "B" out of four candidates); source is
  `icons/icon.svg`, all five PNGs are rendered from it (512, 512
  maskable, 192, 180 apple-touch — full-bleed RGB; favicon-64 with
  rounded transparent corners). Today lost its whole header: greeting
  (#today-title), version pill (#version-pill, v1.21), segmented day bar
  + "x of y done" (#day-progress, v1.11/v1.22) and the day-complete
  flourish (dayComplete()/dp-celebrate, v1.19) — do not bring any of
  them back unasked. The version is read from `data-testid="app-version"`
  at the bottom of Settings (boot.spec.js uses it). Habit icons on the
  Today cards grew 19px -> 24px (`.habit-name .hi`; grid 18 -> 22) on his
  follow-up "make the icons in the list a bit larger"; v1.49 (same day,
  "Why not still bigger?") took them to 32px in the list — he chose 32
  out of 24/28/32, pinned by tests/ui/cardicon.spec.js. The grid layout
  stays at 22px: its narrow cards already cut "Medit | Brea | Cold" at
  the old 18px, and every extra pixel of icon cuts more. 🪤 An installed iOS
  app keeps the icon it was added with; getting the new one means remove
  + re-add, which can wipe its localStorage — backup first, import after,
  reminder on again (written into How it works → App icon).
- v1.50 "A real iPhone app, through TestFlight" — BUILT 24 Nov 2026 on
  Martin's request ("take it all the way from here to test flight,
  including GitHub"). See "iPhone app (TestFlight)" below.
- v1.51 "Start and stop a fast from the icon and Siri" — BUILT 26 Nov 2026:
  Start/Stop Fasting in the Home Screen long-press menu, by Siri and in
  Shortcuts, iPhone app only; deployment target 17.0. See "Start/Stop
  Fasting from the menu and Siri (v1.51)" below.
- Siri/Lock-Screen launch of the INSTALLED WEB APP stays impossible (Shortcuts
  can't open web clips; URLs open Safari's separate storage). Solved in
  v1.51 inside the iPhone app instead — the web app is unchanged.
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
`{"ok":true,"version":"1.1","vapid":true,"subject":true}` — `vapid:false`
means the private secret does not match the public key (re-put it).
The UI tests inject their own URL via `window.AMS_REMINDER_API`.

**Watching it live**: `npx wrangler tail --format json` (from
`reminder-worker/`) prints one `tick {checked,sent,quiet,dropped,failed,
statuses,errors}` line per minute while something is stored. Since worker
1.1 (12 Oct 2026) every phone lives in ONE KV key, `reminders` =
`{ "<deviceId>": { subscription, time, tz, updatedAt, lastSent, doneDate,
lastStatus } }`; v1.0's per-phone keys (`sub:<id>`, state in metadata) were
folded in automatically on the first tick and stay behind as harmless
leftovers (DELETE removes a phone's old key too). 🪤 `wrangler kv key list
--remote` answered "Authentication error [10000]" on 12 Oct 2026 although
namespace list and deploy worked — use Cloudflare's GraphQL analytics
(`kvOperationsAdaptiveGroups`, by `actionType`/`datetimeMinute`, wrangler's
OAuth token from `default.toml`) to see what the worker really does.
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
"done today"), the HTTP surface runs against an in-memory KV that counts
every operation (a simulated day must cost 0 lists, 1,440 reads, 1 write
per send), and the v1.0 → 1.1 storage move is pinned. Local
run of the worker itself: `npx wrangler dev --test-scheduled` and
`curl "http://localhost:8787/__scheduled"`.

**Traps**: a push that shows no notification makes Safari revoke the
permission after a few — the `push` handler ALWAYS shows one. Cloudflare's
free KV allows per day 100,000 reads but only 1,000 writes, 1,000 deletes
and 1,000 LISTS. 🚨 Worker 1.0 listed the keys every minute = 1,440 lists a
day: Cloudflare mailed Martin "KV daily operation limit 50 % / … reached"
several times a day from 3 Oct and warned over-limit calls would fail (it
had not refused one yet — the 20:00 reminder went out every evening).
Worker 1.1 reads one key per tick (1,440 reads = 1.4 %) and writes only
when something was due; the test "a whole day of minute ticks stays far
inside the free plan" counts every operation of 1,440 ticks — keep it
green. Never put a list() or a write on the per-minute path. Reminders stored: max 50 (`MAX_SUBSCRIPTIONS`), ids
`[a-z0-9]{8,40}`.

## iPhone app (TestFlight, v1.50) — how it works, how to release

**What it is.** The same web files inside a native shell: Capacitor 8, Swift
Package Manager (no CocoaPods), Xcode project in `ios/App/App.xcodeproj`,
bundle id `io.github.marsch124.amstracking`, display name "Tracking",
iPhone only, portrait only. The web app keeps NO build step:
`scripts/native-www.mjs` only copies `index.html`, `css/`, `js/`, `icons/`,
`manifest.json`, `version.json` into `www/` (git-ignored) and puts
`js/capacitor.js` (from `@capacitor/core`) in front of the app's scripts;
`npm run native:sync` = that + `cap sync ios`. `ios/App/App/public` and the
generated `capacitor.config.json` there are git-ignored too.

**What differs inside the app** (`js/app.js`, block "v1.50: inside the
iPhone app"; everything hangs on `NATIVE`, which is false in any browser):
- no service worker, no update check (`#btn-update` hidden, `checkForUpdate`
  returns) — a new version is a new TestFlight build;
- notification permission via `notifPermission()` / `askNotifPermission()`
  (plugin in the app, `Notification` on the web) — use these two, never
  `Notification.permission` directly;
- reminder = local notifications, ids 4400–4429, one per day for 30 days,
  re-planned by `planNativeReminders()` on every `save()`, every start and
  every return to the foreground. NEVER talks to `reminder-worker/` — and
  must not: a backup imported from the web app carries that app's device id,
  and a DELETE from here would switch the web app's reminder off;
- badge through `@capawesome/capacitor-badge` (`setBadge()`);
- sharing: `navigator.canShare` / `navigator.share` are REPLACED in the app
  by functions that write the file to the cache folder and open the native
  sheet (`@capacitor/filesystem` + `@capacitor/share`) — call sites unchanged;
- safety copy: every save also writes `amsTracking.v1.json` to the app's
  Library folder; a start with empty localStorage restores from it
  (`restoreFromSafetyCopy`). `safetyCopyArmed` keeps a first start from
  overwriting the copy before it was looked at — do not remove that guard.

**Tests.** `tests/ui/native-*.spec.js` run the same pages with a stand-in
bridge (`fakeNative()` in `tests/ui/_app.js`, records every plugin call in
`window.__native.calls`). They prove the app's side; they cannot prove the
plugins. For that the `ios` job in `.github/workflows/ci.yml` compiles the
project on a Mac runner (no signing), starts it in a simulator, keeps a
screenshot + the app's console as the artifact `ios-simulator-run`, and
fails unless the app printed its own `AMS native start …` line.

**What the simulator run showed (24 Nov 2026, iPhone 17 Pro, Xcode 26.3).**
The app loads at `capacitor://localhost`; SystemBars, Filesystem and
LocalNotifications answer; the safety copy is written to
`Library/amsTracking.v1.json`; permission starts as `prompt`. A first start
logs one `[error] readFile … does not exist` — that is the look for the
safety copy and is expected. 🪤 The artifact cannot be downloaded from a
cloud session (the blob host is blocked), so the step also prints a small
JPEG of the screenshot as base64 into the job log, between
`---- picture (base64 jpeg) ----` and `---- end of picture ----`: cut it out,
`base64 -d`, and LOOK at it. 🪤 The Chromium tests run at a 16px base, an
iPhone at 17px with a wider font — widths that fit in the tests can be cut
on the phone; that is how "Intermittent Fas…" got through v1.49 and why
`fitNames()` (js/app.js) now measures names, tested at 17px in
`tests/ui/namefit.spec.js`. 🪤 Mac runners: `macos-latest` jobs sat queued
for 60+ minutes twice that day, `macos-15` between 2 and 63; the jobs use
`macos-15` and select its newest Xcode.

**Releasing.** Push to `main` → `tests` → `ios` → `testflight` (also on the
1st of each month by schedule, because a TestFlight build expires after 90
days; GitHub pauses schedules in a repository with no activity for 60 days).
Version = `APP_VERSION`, build number = `<run number>.<attempt>`. The upload
is skipped with a notice — not failed — while the four repository secrets
are missing:
`ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_PRIVATE_KEY` (the whole text of the .p8
file), `APPLE_TEAM_ID`. Signing is Apple's cloud signing: the archive is
built unsigned and `xcodebuild -exportArchive -allowProvisioningUpdates`
signs and uploads it with the API key (`ios/ExportOptions.plist`); no
certificate or profile is stored anywhere. The key needs the **Admin** role
(cloud-managed distribution certificates require it).
🚨 As of 24 Nov 2026 the `testflight` job has NEVER RUN — the secrets were
not set yet. Everything up to and including the simulator run is verified;
signing and upload are written from documentation and must be watched on
their first real run.

**What only Martin can do** (Apple gives no API for these): be in the Apple
Developer Program (99 USD a year); register the bundle id under
Certificates, Identifiers & Profiles; create the app record in App Store
Connect (New App → iOS → that bundle id); create the API key (Users and
Access → Integrations → App Store Connect API, role Admin) and put the four
values into GitHub → Settings → Secrets and variables → Actions; add
himself to an internal TestFlight group and install the TestFlight app.
Never paste the .p8 key into a chat.

**Changing the native side.** Plugins are added with `npm i` + `npm run
native:sync` (rewrites `ios/App/CapApp-SPM/Package.swift`; commit it). The
project was generated on Linux with `npx cap add ios --packagemanager SPM`
— no Mac was involved, so the only place it has ever been compiled is the
CI job. The app icon is `ios/App/App/Assets.xcassets/AppIcon.appiconset/
AppIcon-512@2x.png` (1024 px, rendered from `icons/icon.svg`, no alpha —
Apple rejects icons with transparency).

## Start/Stop Fasting from the menu and Siri (v1.51)

iPhone app only (iOS 17+, deployment target 17.0). The web app has none of it.

- **Native file** `ios/App/App/Fasting.swift`: App Intents `StartFastingIntent`
  / `StopFastingIntent` + an `AppShortcutsProvider` whose phrases contain the
  app name ("start fasting in Tracking", "start a fast in Tracking", "stop
  fasting in Tracking", "end my fast in Tracking"); they run without opening
  the app and answer in Siri's voice. They also show up in Shortcuts under
  "Tracking" with no setup. Home Screen quick actions are set dynamically as
  `UIApplication.shortcutItems` — ONE item, the one that fits (Start =
  moon, Stop = fork and knife, subtitle "Since HH:MM"); a tap opens the app
  and starts/ends the fast.
- **Plugin** "AMSFasting": a small in-app Capacitor plugin, registered from
  `AppViewController.capacitorDidLoad` (not an npm plugin, so no `cap sync`).
- **Hand-off.** JS mirrors `{habit name, running, since, goal hours}` to native
  on every save via `AMSFasting.setStatus`; native uses it for the menu item
  and Siri's answers. Siri and the menu append `{a:'start'|'stop', t:ms,
  src:'siri'|'menu'}` to a queue in UserDefaults (t = the exact moment).
  JS takes the queue with `AMSFasting.takePending()` at start, on return to
  the foreground and on the plugin's "pending" event, and applies it in order
  with `applyFastAction()`: a start is ignored while a fast runs; a stop is
  ignored when none runs or when its time is before the start. Message + Undo
  like the fasting card ("Siri: fast started at 20:13").
- Target = the first non-archived timer habit (same as the old `?fast=` link,
  which stays for the web app).
- Apple requires the app name in every App Shortcut phrase, so plain "Hey
  Siri, start fasting" only works through his own shortcut named "Start
  Fasting" (the tip in How it works) — keep that tip whenever the phrases
  are mentioned.
- Siri's answers come from `FastingStore` (status + waiting steps): goal of a
  new fast = weekday goal of the day it is expected to end (start >= 12:00 →
  tomorrow), like `goalDayFor()`.
- **Tests:** `tests/ui/native-fasting.spec.js` (stand-in `AMSFasting` in
  `fakeNative()`, `opts.steps`) proves the page side. 🪤 Running an App
  Shortcut in the SIMULATOR always fails ("Unable to run App Shortcut";
  linkd: "Failed to generate bundleIdentity … requiresValidBundle") for any
  local build — unsigned, ad-hoc, team, Debug or Release. The shortcuts are
  listed in the Shortcuts app all the same. On 26 Nov 2026 the Swift side was
  proved with a temporary `-amsSiri stop` launch argument calling
  `FastingStore.stopBySiri()` (answer "Fast ended after 3 min. Goal was 16
  h.", the page then applied the step); real Siri needs the TestFlight build
  on a phone. The quick actions DO work in the simulator (long-press the
  icon with a >0.5 s tap).

## App Store Connect (since v1.51)

App "AMS Tracking", Apple id 6839502190, bundle-id record 4TPCUXJXNK
(`io.github.marsch124.amstracking`), SKU `amstracking`, internal beta group
"Martin" (`c3fa83df-eb47-4dd3-97d5-1455a092a729`, all builds). First build
1.51 (1) was uploaded from the Mac on 26 Nov 2026 (archive + exportArchive
with the Admin key, see the TestFlight memory note). The four repository
secrets the `testflight` job needs were set the same morning with Martin's
yes in chat (the agent's safety check had refused `gh secret set` once
without it). From then on every push to `main` and the 1st of each month
upload a build from GitHub (build number `<run>.<attempt>`, always above the
Mac's 1.51 (1)).
