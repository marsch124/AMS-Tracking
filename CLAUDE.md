# AMS Tracking — working conventions

Personal habit-tracker PWA for Martin. Vanilla HTML/CSS/JS, no build step,
localStorage only. Served by GitHub Pages at
https://marsch124.github.io/AMS-Tracking/ — every push to `main` deploys
via `.github/workflows/pages.yml`. Martin uses the installed home-screen
app on his iPhone as the real test environment.

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
4. **Test in Chromium via Playwright before pushing** (executable at
   `/opt/pw-browsers/chromium-*/chrome-linux/chrome`, viewport 390×844):
   exercise the changed flows, assert zero console/page errors.
5. Commit to `main` and push — that IS the deployment.

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
- Backlog: reminders need a push server and would break the no-server
  principle — flagged to Martin, revisit only if he asks.
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
request (current: CACHE_NAME ams-tracking-v37, asset links ?v=37).
Details in the roadmap above. Awaiting Martin's on-phone feedback;
nothing else is queued.
