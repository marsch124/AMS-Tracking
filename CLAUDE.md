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

**APPROVED and in progress (2 Sep 2026): ten UI improvements, Martin
said "All ten in sensible batches please." Ship as three releases,
each through the full release checklist above. Nothing built yet.**

v1.18 "Find your way" — four small wins:
1. Jump-to-today button in the detail month calendar header, shown
   only when the viewed month (calMonth, js/app.js ~line 881) is not
   the current month; resets calMonth and re-renders.
2. One-line legend under the fasting (timer) calendar explaining the
   circles: green = goal met, gray = fell short, red = running,
   dashed = skip day. Timer habits only.
3. Tappable week dots on Today cards (.week-dots built ~line 624 in
   buildCard): tapping a dot opens that habit's detail with calMonth
   set to that day's month and briefly highlights the day cell.
4. Note indicator on Today cards when habit.notes[todayKey] exists: a
   small dot; tapping shows the note in a toast with an Edit action
   that opens the note sheet (editDayNote).

v1.19 "The feel, part two":
5. Day-complete moment: when the last scheduled habit of the day is
   checked off, the day-progress bar fills with a short flourish and
   a hand-drawn checkmark; honor prefers-reduced-motion.
6. Screen transitions: slide-in/out between Today <-> detail/stats,
   native-iOS feel, reduced-motion safe.
7. Live preview in the habit add/edit sheet: a mini Today card at the
   top of the sheet updates as name/icon/color are chosen.

v1.20 "Your hands, your eyes" (gesture-heavy + layout-wide, together
so the gestures don't conflict):
8. Drag-to-reorder habits on the Today list via long-press drag;
   persist order in state (habit order in state.habits).
9. Swipe actions on Today cards: swipe right = mark done, swipe
   left = mark today skipped, both with the usual undo toast. Must
   coexist with the long-press drag and existing long-press handlers
   (also-yesterday, per-fast goal).
10. Respect the iPhone text-size setting: move fixed px font sizes to
    scalable units (rem with -apple-system text sizing) so the iOS
    Display & Text Size preference scales the app without breaking
    layouts; audit both themes for contrast while in there.

Follow the release checklist above for every release; the
self-updater shows Martin the Update button automatically. Present
each release to Martin for on-phone feedback as it ships.
