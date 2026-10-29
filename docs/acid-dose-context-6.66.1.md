# Acid recommendation / forecast consistency — v6.66.1

## Verified cause and outcome

`calculate()` calls `acidRecommendation()` / `acidDoseCalibration()` and applies
the learned response correction. `confirmCalculatedDose()` froze that correction
in calculator drafts. Manual additions saved only the actual quantity and
`test_before_dose_id`. `balanceProjection()` ignored that association when
resolving the correction: absent calculator metadata meant factor 1.0.
`partialTaylorAcid()` then correctly solved the wrong partial-dose scenario.
The Taylor table, density, purity and TA stoichiometry were not the cause.

The October 28 nine-drop example was reproduced before editing code using
read-only private records and a failing synthetic regression:

- Raw Taylor reference: 121.9433 g, about 8.60 tbsp.
- Two eligible pre-dose calibration pairs: personal factor 0.69.
- Corrected recommendation: 84.1408 g, 5.936 tbsp (displayed 5.9).
- Actual 6 tbsp: 85.0485 g, 101.08% of the full-precision recommendation
  (102% when dividing by rounded 5.9), not 69.74% of the raw reference.
- Old forecast one minute after dosing: 7.783, conditional partial dose.
- Fixed forecast: Taylor-derived endpoint ≈7.4; with the existing gas-loss
  model, ≈7.408 one minute after the actual dose. This is **not a measurement**.

## Implementation boundaries

`acidReferenceContext()` resolves the Taylor test, fill, immutable product
composition/revision, raw reference and dose-time correction. Existing valid
saved metadata takes priority. Test association, fill and timing must agree.
`freezeAcidDoseContexts()` runs at the common Chemistry Save boundary, for new
manual and calculator-confirmed additions only. It saves reference and corrected
grams, correction evidence, test/product identity, actual dose timestamp and
provenance. Actual amount/unit remain untouched. Calculator-confirmed drafts
retain the recommendation already shown to the user. Corrections of existing
records do not trigger historical backfills.

For new manual saves, the established calibration rules remain in force.
Historical reconstruction is stricter: calibration observations need a known
creation/report time at or before the dose. Later observations cannot enter.
The read-only audit view resolves which original/corrected/removal records
existed at that cutoff. If an active-only archive has lost the superseded
original, reconstruction is unavailable, not a fit from a misleading subset.
Unknown-time activities remain potential confounders. Product-revision-specific
evidence cannot leak across revisions; original immutable legacy profiles still
accept unprofiled legacy records. Retrospective chart subsets retain audit
context. No historical event is mutated and no private repository is written.

Missing reliable historical evidence uses an explicitly labeled uncalibrated
reference assumption, rather than claiming it was the original recommendation.
Reconstructed, stored-manual and stored-calculator contexts are distinguishable.

`balanceProjection()` freezes one corrected denominator for cumulative additions
linked to the same source test/product. Partial responses still use nonlinear
carbonate/borate/CYA equilibrium. It retains the established 100–110% approximate
endpoint range; >110% needs a new sample. There is no discontinuity at 90%.
Intervening chemicals, soaks/exposures, water replacement, another product, or an
expired two-hour Taylor reference cannot reuse that endpoint. A later pH sample
anchors a fresh projection. TA dose physics and automatic learning from later
measurements are unchanged.

An 8+ starting observation remains bounded. A conditional endpoint retains its
bounded-anchor uncertainty and approximate status. An inferred starting pH from
the partial-dose equilibrium is a scenario, not an exact recovered measurement.
The model cannot prove the water actually reached 7.4 without a retest, and this
fix never recommends more acid just to reconcile a forecast.

## Files and verification

- `index.html`: context resolver/save boundary, read-only audit subsets,
  cumulative forecast denominator, bounded endpoint flag and app version.
- `tests/acid-dose-context.test.cjs`: synthetic October 28 reproduction,
  metadata parity/freeze, no mutation/look-ahead, half/split/excess/90% cases,
  retest/interference, fill/revision/timing and correction-audit boundaries.
- `tests/ui/acid-dose-context.cjs`: actual manual/calculator forms, no draft
  write, one final Save, equivalent projections and unchanged originals.
- `package.json`, `package-lock.json`, `sw.js`: v6.66.1 / offline shell.
- `README.md` and this document: investigation and release notes.

Commands: `npm run build:pwa`, `npm test` (49 regression commands),
`npm run check:generated`, `node scripts/build-guest-worker.cjs --check`,
`git diff --check`. All passed. The existing WebKit touch workflow check
(`scripts/check-guest-workflow-browser.cjs`) also passed in phone portrait and
landscape, using synthetic data and no live API writes. Its first sandboxed
browser launch was blocked; the permitted isolated launch succeeded.
The private October 28 read-only reproduction was also rerun
against the corrected engine. Synthetic tests contain no private record IDs.
Schema stays v2; Worker 4.3, OAuth, CSRF and sync interfaces are unchanged.
