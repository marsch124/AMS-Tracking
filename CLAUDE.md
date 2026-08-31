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
- Backlog: reminders need a push server and would break the no-server
  principle — flagged to Martin, revisit only if he asks.
- Present batches to Martin and wait for his on-phone feedback between
  releases.
