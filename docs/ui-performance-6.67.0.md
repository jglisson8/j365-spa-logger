# UI performance — v6.67.0

## Reproduction

A read-only benchmark of the 153-record private archive reproduced severe
synchronous main-thread work in v6.66.2. A full chart refresh invoked the balance
projection about 200 times and the inventory resolvers thousands of times.
Normal startup/save/sync renders also rebuilt hidden charts and closed advanced
diagnostics. Expanded-chart pinch motion recalculated the model on each move.
Repeated strict timezone metadata validation contributed substantial overhead.

Measured locally, against the same archive and fixed clock where model parity
was compared (not a promise of identical phone timings):

| Operation | Before | After |
| --- | ---: | ---: |
| Isolated DOM UI startup | 19,444 ms | 490 ms |
| Ordinary UI refresh, Trends hidden | 9,706 ms | 163 ms |
| FC input event | 7 ms | 3 ms |
| Full chart refresh | 10,296 ms | 1,967 ms |
| FC projection | 209 ms | 37 ms |
| pH projection | 390 ms | 82 ms |
| TA projection | 107 ms | 20 ms |

## Changes and safety boundaries

- `src/ui-performance.js`: operation-scoped reuse of pure inventory/model work
  and parsed reads. The cache is discarded in `finally` at the end of each
  synchronous operation, including errors. There is no cross-save, cross-sync
  or cross-settings model cache. Reads detect changed stored JSON, invalidate
  cached work and return independent arrays so existing sorts cannot leak.
  Scenario object identity and audit provenance are part of cache keys.
- `src/spa-time.js`: bounded 4,096-entry cache of strict event-time validation,
  keyed by all time metadata (including typed offsets), not mutable event ID.
  Date-only, unresolved DST and inconsistent metadata behavior is unchanged.
- `index.html`: hidden Trends and closed advanced model details calculate when
  opened, not on every unrelated render. Re-entering an unchanged chart within
  a minute reuses its drawing; saves/sync refreshes mark hidden charts dirty.
  Explicit chart calls and expanded views still render immediately.
- Temperature-only carbonate constants are cached (64-entry bound). The exact
  equations and 48-step equilibrium solve remain unchanged.
- `src/app-ui.js`: resize no longer rebuilds hidden charts. Pinch motion previews
  plot ink with a transform; one final redraw runs on release/cancel. Inspection
  remains single-finger, view bounds are preserved, no record is written.
- Expanded-view and final-render operations share calculation scopes across
  their existing nested wrappers. No asynchronous model work or dosing changes.
- `scripts/build-pwa.cjs`, version metadata and generated `index.html`/`sw.js`
  include the new source module and v6.67.0 offline shell.

The initial visit to Trends still has work to do; this avoids silently replacing
the real chart with a simplified model. A worker-based chart engine could be a
future improvement if larger archives still need it.

## Verification

- Exact full JSON parity of released/optimized FC, pH and TA projections against
  the real archive at a fixed clock. No private archive files or quantities were
  modified, and no real-data fixture was committed.
- `tests/ui-performance.test.cjs`: cached/uncached model parity, new inputs and
  settings/time, exception cleanup, read isolation, scenario/audit separation,
  exact original temperature equations.
- `tests/ui/lazy-performance.cjs`: hidden work deferred, unchanged navigation,
  dirty-on-save refresh, current chart values, advanced toggle and pinch motion
  with just one final redraw, unchanged records.
- `tests/timezone.test.cjs`: in-place metadata edits and NaN/null cache separation
  alongside the existing four-timezone/DST suite.
- `tests/ui/check.cjs`: explicitly requests diagnostics/charts where those
  formerly hidden startup calculations were assumed.
- `npm test`: all 51 regression commands pass.
- `npm run check:generated`, `node scripts/build-guest-worker.cjs --check` and
  `git diff --check` pass. Worker source, schema, OAuth/CSRF and sync unchanged.
- Existing WebKit touch guest workflow passes portrait/landscape with no live
  API writes. Isolated benchmark inputs are read-only, not a connected login.
- A separate WebKit owner-mode phone check passes startup deferral, Trends,
  expanded pH, portrait/landscape rotation, no horizontal overflow and preserved
  unsaved fields/records, with no JavaScript errors.
