# App interaction improvements — 6.53.0

No chemistry equations, calibration, recorded quantities, historic events,
private API routes or storage schema are changed.

## Updating

Waiting service workers still never activate automatically. **Update now**
checks staged doses, pending calculated-dose confirmation, input changes in all
three entry forms, explicitly edited dates, record/product editors, and unsaved
service/product-default settings. Saved-but-not-yet-synced records do not block
updating: their original local storage and pending queues are not erased.

The waiting worker accepts only the explicit same-origin window activation
message. It refuses while any other window on the app scope is open (including
older clients that cannot report draft state). No `clients.claim()` occurs.
Only the initiating page reloads on controller change, and only after another
draft check. If typing raced activation, it stays open and asks the user to
finish before reloading. A timeout enables retry; a blocked update says which
action to take. No local storage is cleared and no private responses are cached.

Existing pre-6.53 clients need the normal close-all-windows update once to gain
the button. Thereafter the button is part of the cached app shell.

## Logging and Undo

The existing test/dose staging pipeline remains the single commit path. A
compact summary lists entered measurements and actual staged dose amounts,
units and times, without writing records. Confirmation only stages. The save
button count includes both tests and additions. Repeated taps during async
service saves are ignored until the original handler finishes.

After a normal user entry saves locally, a separate 15-second **Undo** notice
offers to reverse the complete new batch. Undo appends the existing removal
markers; the original entries remain recoverable using Show originals. If any
entry was superseded/removed meanwhile, Undo refuses the stale batch. Full
refills are excluded because they require fill/config reassignment. Correction,
sync and weather-note saves do not create an Undo action. No Undo is inferred
for a previously existing duplicate measurement.

## Preferences and charts

`j365_app_choices_v1` holds optional device/browser-local UI preferences: last
active manual product, units by product, last successful non-full-refill service
activity, and expanded chart presets/custom time windows by parameter. Stale/archived products and
unknown units/activities are ignored. Preferences never carry an amount or old
dose time into a new row, nor rewrite a product snapshot. They do not change the
privately synced product library/calculator defaults.

On first opening a calculated-dose confirmation, the untouched suggestion can
be converted to the remembered compatible unit. Editing that unit afterward
continues to preserve the user's numeric entry, as in earlier fixes. Saved
actual units/amounts remain separate from the original calculator suggestion.

Tap or drag in a chart to pin its readout; tap outside the plot/readout to
dismiss. Pins survive redraw within the same time window. Pinch is treated
separately and never pins a spurious single-finger value. The readout size stays
fixed. Routine account/offline-readiness detail is under Service → App &
connection; the compact sync badge opens that section, while offline and update
notices remain prominent.

## Verification

`tests/app-workflow.test.cjs` covers one-save measurement/dose entry, draft
protection, actual units, preferences, reversible Undo and stale correction
protection, pin persistence, status and unsafe refill defaults. PWA tests cover
explicit activation, draft race checks, foreign messages and multiple windows.
`scripts/check-pwa-update-browser.cjs` exercises a real two-version update in
isolated Chromium: draft blocks, second-window blocks, successful activation,
reload, retained local records and new-version offline startup. The phone
layout and public-only offline-cache scripts are run separately.
