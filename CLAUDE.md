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
- Backlog: reminders need a push server and would break the no-server
  principle — flagged to Martin, revisit only if he asks.
- Parked: Siri/Lock-Screen launch of the installed app — impossible on
  current iOS (Shortcuts can't open web clips; URLs open Safari's
  separate storage). Re-test the Shortcuts "Open App" picker after each
  iOS release; if "Tracking" appears, the v1.12 URL commands plus an
  Open App shortcut make it work with no app changes.
- Present batches to Martin and wait for his on-phone feedback between
  releases.

## Proposed next features (suggested to Martin 31 Aug 2026)

Batch (1+3) shipped as v1.13 on 2 Sep 2026 (CACHE_NAME ams-tracking-v27,
asset links ?v=27). Remaining suggested batching: (2+4), then (5).
Martin picked 1+3 explicitly; ask before building 2, 4 or 5.

2. **Fasting stages** — in the fasting detail (and/or under the running
   timer), show commonly-cited fast phases with the current one
   highlighted: 0-4h digestion, 4-12h transition, 12-16h fat burning,
   16h+ deep/ketosis territory. Draw as a horizontal hand-drawn track
   with markers; MUST carry a visible "popular approximation, not
   medical advice" hint. Live-updates with the existing 20s tick.

4. **Week in review** — on first open in a new ISO week (store
   settings.lastReviewWeek = weekStart key), show a dismissable card
   above the habit list: per habit last week's done/scheduled, streak
   delta, avg fast h vs week before. Pure derived data, no schema
   change except settings.lastReviewWeek.

5. **Year-poster export** — button in habit detail renders the year
   pixel grid + name + streak stats to a canvas (~1080x1350) in app
   style and shares via navigator.share({files:[png]}) with download
   fallback (same pattern as CSV/backup export).

Implementation reminders for all: follow the release checklist above
(How-it-works + version history + APP_VERSION + version.json + ?v= +
CACHE_NAME bumps, Playwright test, push = deploy). The self-updater
shows Martin the Update button automatically.
