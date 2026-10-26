# v6.64.0 — source water and guest rehearsal

## Fill-water profile

Service → Source water → Latest baseline (default), or Average of historical
baselines. The setting syncs privately using the existing field-level conflict
queue. Baselines themselves remain original chemistry events: no redundant
measurements are generated or rewritten.

The first usable Taylor/non-strip reading within three calendar days of a full
fill (or an explicitly labeled initial-fill test) supplies each parameter.
Initial tests entered in the new-fill form qualify. Test-before-dose ordering
also qualifies for one Save containing both. Relevant earlier treatment excludes
a baseline: all additions for pH, acid/bicarbonate for TA, calcium for CH.
One reading per fill per parameter is used. Average weights fills equally;
latest selects the latest available value for each parameter. A later fill
without a baseline can use the prior same-source baseline until tested.
Explicit per-top-off source TA always wins. Untreated incoming FC remains zero;
early chlorinated tub FC is never repurposed as source FC. Source pH is shown as
context, not linearly mixed into the tub. Approximate source TA remains labeled.
The existing September 170 ppm TA reconstruction still works until a new usable
fill baseline supersedes it. No values are inferred from later treated water.

## Guest practice

Service → Guest invitations → Try guest practice mode opens `/guest?practice=1`
in a separate tab. Its permanent practice banner warns not to dose real water.
Only synthetic fill/tests/products are present; no owner records, credentials,
invitations or settings are fetched. Every fetch is intercepted before startup
and fails closed outside the simulated guest API. Owner storage is untouched;
guest data is memory-only and resets on reload. No service worker is registered.
Strip tests, calculated-bleach staging, actual-dose confirmation, caps, soaks,
corrections/removal and Trends can be rehearsed without polluting the archive.
This is a UI rehearsal, not a substitute for server authorization tests or a
real recipient's link/code/browser-activation check. Invitation setup remains
owner-controlled. Practice access never activates an invitation fragment.

## Forecast usability

Chart cards show the anchor time (without consuming expanded chart height).
Paused charts retain their reason and offer Log a test, opening the relevant
field without clearing drafts. Service → Forecast accuracy shows valid frozen
checks only, up to 20 per parameter, with mean absolute error and signed bias.
No prediction equation or chemistry target changes in this release.

## Verification and deployment

Regression coverage includes subsequent fills, equal-weight averages, explicit
overrides, pre-treatment ordering, missing/partial baselines, settings sync and
conflicts, practice memory/network isolation, and valid forecast scoring. Phone
rehearsal: `scripts/check-guest-practice-browser.cjs`; set `J365_WEBKIT=1` for
WebKit, otherwise Chromium. Synthetic-only tests make no private record writes.

Deploy generated Worker 4.3 before publishing the app. It shares only the
allowlisted source-water settings, source-chemistry values and top-off context
needed for guest/owner Trends parity. Guest permissions, OAuth, encrypted access
codes, code/device checks and all existing owner APIs are retained.
