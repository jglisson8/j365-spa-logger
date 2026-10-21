# Reliability audit · 6.50.0

## Executive summary

Audited the current default-branch source (6.49.0, `c903b84`) before editing and ran the existing chemistry, service, product, browser/UI and mocked Worker suites. Changes are targeted: spa-local time, conflict-safe configuration, repeatable tests/CI, one duplicate render and visible forecast warnings. No private history was rewritten, normalized or backfilled; no live Worker configuration, OAuth or credentials were changed. No MPS, new chemical treatments or automatic dosing were added.

## Confirmed defects and corrections

- Offset-free `Date.parse` and device-local formatting changed elapsed time/default entries when traveling. `SpaTime` now interprets unambiguous legacy wall times as `America/Denver`, as confirmed by the user. Chemistry and inventory, delayed demand, exposure, calibration, validation cutoffs, ordering, reminders and chart inputs use the shared boundary.
- General configuration sync previously merged stale local objects over the current remote document. New-fill pointer, maintenance fields, product profiles and defaults now carry field-level intent and the original base. Every attempt starts from fresh remote config. Unrelated remote changes survive; incompatible same-field edits stop with both values preserved.
- Two offline product revisions could have the same ID/revision but different formulas. Custom calibration identity additionally includes canonical composition (family, form, concentration and density). This prevents cross-training incompatible formulas; legacy calibration groups and all physical constants remain unchanged. Earlier custom frozen checks keep their original evidence and values.
- Core save already rendered; the feature save wrapper rendered again. One duplicate synchronous render was removed, retaining form reset, persistence, forecast freezing, weather and synchronization order. Historical removal markers copy the record's existing time/provenance rather than pass date-only or unresolved historical hours through the strict new-entry clock; removal/restoration stays available without inventing an instant.
- Expanded-chart CSS hid all help paragraphs, including paused/conditional/extrapolated warnings. Those remain visible now. The summary says “Alerts” rather than implying that the 10-ppm FC chart alert is a manufacturer maximum.

## Time and compatibility contract

Existing raw timestamps, dates and event bodies remain untouched. Date-only records use calendar anchors only for display/reminders, never invented chemistry times. Invalid spring-forward times are rejected. Repeated fall-back historical hours remain unresolved and excluded from precise modeling unless the record already supplies a real instant. New manually entered repeated hours require an explicit earlier/later choice; an actual current-time default can retain its known occurrence.

New events retain `timestamp` as the entered spa wall time and add `timestamp_instant` (UTC ISO), `time_zone: America/Denver`, and `utc_offset_minutes`. `created_at` is UTC ISO. Inconsistent metadata is not trusted. Corrections retain unchanged time metadata; an edited event time is resolved again. Monthly storage still uses the original spa-local timestamp month. Existing schema v2, local-storage keys, raw imports, product snapshots, fill IDs, legacy `/api/log`, CSRF and OAuth remain compatible. The reviewed Worker accepts/preserves the additive fields; a mocked authenticated round-trip was tested separately without changing the Worker.

Reminder age is calendar days in the spa timezone, including 23/25-hour days. Calendar ordering for undated-hour history is not evidence of a precise event time.

## Configuration synchronization

The cache now also retains a remote baseline. Generic pending intent and conflict records are saved under new additive local keys; existing service/product queue formats remain readable. Values, missing fields and unknown legacy bases are distinguished. SHA conflicts refetch/retry at most three times per sync call. Acknowledgement clears only the exact sent value; edits made during a request stay queued/rebase on that acknowledged value. Failed requests retain local state across reload/online/foreground reconnects.

Service → Sync conflicts, and a visible header shortcut, offer “Keep my change” or “Use synced value.” Keeping a product change rebases it to a new revision, never changes prior dose snapshots. Further concurrent edits ask again. Resolved conflict records retain both states locally. Old pending queues without a reliable baseline may require this one-time choice rather than silently overwriting remote settings. Conflicting settings do not block event synchronization.

Only explicitly changed fields are sent; the general writer supports the current-fill pointer, its only current generic caller. Do not add a generic setting without adding intent/base capture and a regression.

## Testing and CI

Use Node.js 24, `npm ci`, then `npm test`. All development dependencies are locked; jsdom is pinned exactly. No production dependency/build service was introduced. Tests run with a declared Mountain fixture timezone; a separate child-process test compares the same real model calculations in Denver, Eastern, Pacific and UTC. Synthetic fixtures replace dependencies on private historical exports. The supported partial-acid reference scenario remains covered, using synthetic IDs for same-minute test relationships.

Coverage includes FC anchoring/decay, sanitizer conversion, balancing additions, activity/immediate/delayed/showering demand, inventory bands/fills, depletion, uncertainty/crossings; Taylor partial/full/nonlinear responses, 8+ bounds, buffer inventory, personal calibration, bicarbonate/TA, CO₂/aeration and reset; staged units/corrections/removals/restores, immutable product snapshots, monthly persistence, failures and config conflict recovery. Frozen forecast tests distinguish prospective scoring from later fitted data: future tests cannot improve an old prediction, and corrected/removed evidence invalidates its eligibility without rewriting its saved review.

`.github/workflows/test.yml` runs the same regression command on pushes and pull requests. Pages deployment remains independent. jsdom covers interaction and CSS contracts, not actual mobile touch physics or native orientation behavior; real-device checks remain useful.

## Logo and infrastructure decision

The inline PNG and `assets/spa-mountain-logo.png` are byte-identical (525,451 decoded bytes, SHA-256 `b3f5dd956a0bafec509e5b290bda7ff508249e22d3f27c8a9e8aee33ef242e27`). The inline URI occupies 700,626 bytes. Replacing it with `assets/spa-mountain-logo.png` would remove 700,598 HTML bytes, but the reviewed Worker serves only the HTML proxy, has no `/assets/` route, and permits images only from self/data/blob. A relative URL would fail there, while a Pages absolute image would be blocked by CSP.

Therefore **actual logo-related HTML reduction is 0 bytes** in this release. Keep the inline logo until a separately reviewed Worker asset proxy or narrowly allowed Pages image source is implemented and tested. Dimensions, appearance, alt text and responsiveness stay unchanged. The time helper also remains inline, avoiding the same deployment trap for executable code.

## Files and release verification

- `index.html`: bundled clock, sync/conflict controls, calibration identity isolation, one render, chart-warning presentation, 6.50.0 version.
- `src/spa-time.js`, `scripts/build-time.cjs`: canonical pure clock plus checked inline bundling.
- `package.json`, lockfile, `.nvmrc`, `scripts/test.cjs`, workflow and `.gitignore`: reproducible development/CI tooling; static production unchanged.
- `tests/`: retained chemistry regressions, timezone/conflict/forecast/save tests and portable jsdom scenarios with synthetic fixtures.
- This audit, execution-order document and README: contracts, limitations and reproducible commands.

Local validation completed with Node 24.15.0: clean `npm ci` succeeded (36 packages installed; audit reported 0 vulnerabilities), all **22** commands in `npm test` passed, and `git diff --check` passed. The separate workspace command `node work/test_worker_v3.mjs` passed, including authenticated mocked schema-v2 metadata round-trip, config/monthly/legacy endpoints and existing protections. No actual private-data writes were made by these tests.

After publishing, verify the Regression tests workflow separately from Pages, then read Pages and secure Worker HTML to confirm `APP_VERSION='6.50.0'` and intact inline logo/CSP.

Manual authenticated checks: refresh the secure app, confirm identity and Sync; log a real test normally (do not create fake production chemistry); travel-device time defaults should remain Mountain. A second device changing an unrelated service field must retain both changes; a same-field conflict must offer an explicit choice. These live writes were not used as automated regression tests.

## Deferred risks

Chemistry uncertainty remains provisional and does not establish validated 95% coverage. No physical constants, spa targets or calibrated legacy conversions changed. Timezone corrections can legitimately change outputs formerly interpreted in the wrong device zone. Historical repeated hours remain unresolved rather than guessed. The monolithic wrapper architecture is documented but not broadly refactored; model caching/extraction and external logo serving are separate tasks. Local-storage quota exhaustion is surfaced by existing failure behavior; this release does not introduce a replacement storage engine.
