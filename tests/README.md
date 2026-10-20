# Partial-acid regression

Run `node tests/partial-acid.test.cjs` from the repository root. No packages are required.

The test covers the October 19 case: 395 gallons, reported pH ≥8.0, TA 140 ppm, calculated CYA 30 ppm / borates 40 ppm, seven Taylor acid-demand drops targeting 7.4, and an actual six-tablespoon Spa Down dose. The recorded 20.1-tsp suggestion and actual quantity are not changed. Percentage calculations use the existing unrounded Taylor mass reference, so approximately 89.8% from that reference corresponds to approximately 89.6% of the displayed rounded suggestion.

Partial doses no longer use a 90% completion switch. Numeric starting pH uses the existing carbonate/borate/CYA state, reducing TA by acid equivalents while retaining dissolved inorganic carbon. Bounded starting pH uses a conditional state constrained by TA and the full Taylor endpoint; it is accepted only if its inferred starting pH satisfies the reported bound. This does not recover an exact starting measurement or validate an exact endpoint. Insufficient/inconsistent chemistry produces qualitative partial-response information instead. As before, a full reference dose (or a small excess within the existing 10% tolerance) is an approximate Taylor endpoint estimate, not a measurement.

The calculation assumes mixing without significant CO₂ loss during the immediate response. Existing temperature/constant, inventory, TA carry-forward, product-density and calibration assumptions remain provisional. Neither the scenario nor the qualitative bound is a validated confidence interval. Later samples reset the forecast and remain available to the existing automatic calibration pipeline; scenario points are never inserted as measurements.

## Personal acid-dose correction (6.43)

The calculator now separately reports a provisional personal response correction and the unchanged Taylor reference. Eligible dose/retest pairs require a recent acid-demand sample, TA within one hour without intervening TA changes, usable buffer inventory, the same fill, and a numerical post-dose pH within two hours without competing activity. A single pair is explicitly provisional; up to eight recent qualifying pairs are pooled by median. Corrections are rounded to whole percentage points and bounded to 50–100% of the reference; the app does not automatically increase the reference dose. This is a response correction, not a change to product density, purity, or historical quantities. Dose staging/label cautions remain in effect.

The October 19 same-minute pH 7.3 sample has user-confirmed post-dose order. That explicit relationship—not the later save time—allows it to be used without inventing a test timestamp. Other same-minute tests keep their default pre-dose order. Results saved later than a forecast's cutoff cannot train that forecast. New calculator-confirmed doses snapshot the correction for future endpoint estimates; legacy doses retain their original reference.

## Provisional pH uncertainty (6.44)

Supported pH forecasts have a provisional range immediately; no 20-check gate remains. The range blends six prior-weight units with squared, elapsed-time-normalized errors from up to 100 valid frozen checks. Priors are a 0.25-pH baseline range component and 0.08-pH/√hour rate-error scale, with a 0.1-pH minimum baseline component. Similarity weights decrease with TA/CYA/borate differences, bounded/endpoint/aeration state changes, environmental differences, and a 90-day age decay. These are explicit engineering assumptions, not probabilities or independent sample counts. Different contexts contribute less rather than requiring identical categories.

The range can narrow with consistent evidence or widen with large errors; it never promises validated 95% coverage. Additional margins apply to bounded-start scenarios, inferred endpoints and uncalibrated aeration. Bounded-start ranges are conditional on the scenario, not bounds on all possible real starting pH values. Crossing times are scenario-envelope crossings, not calibrated confidence limits. Missing or paused forecasts still cannot produce a supported numeric range.

Corrections that invalidate the original evidence hash continue to exclude those forecast checks. They are not silently regenerated or reused for training; old frozen bands remain unchanged. The UI separately reports forecast evidence, invalidated checks, and Spa Down dosing calibration.

## Data-informed CO₂-loss scenarios (6.45)

Run `node tests/ph-gas.test.cjs` in addition to the partial-acid regression. With sufficient usable history, this replaces the generic pH drift and symmetric elapsed-time range above. It fits nonnegative covered-water and additional aeration DIC-loss rates, then solves pH with the existing carbonate/borate/CYA equilibrium model. These are local effective rates, not universal gas-transfer constants. The current implementation does not estimate an atmospheric equilibrium endpoint; forecasts remain limited by the existing horizon and chemistry solver domain.

Numeric endpoints contribute two-sided residuals; 8+ endpoints contribute only lower-bound constraints. At least two upward intervals are required. Current-fill evidence is preferred when sufficient, otherwise prior fills are pooled. Confounded acid/baking-soda/water-change intervals, unknown exposure settings, and future observations are excluded. Bleach intervals receive reduced weight because their immediate pH effect is confounded. Bounds alone do not uniquely identify rates; the fitted seed and sensitivity range remain explicitly provisional.

Air-on soaks act continuously over their recorded duration. Water-only jets and post-dose mixing use a provisional 0.25 air-equivalent factor; open-cover exposure uses 0.1. Overlaps use the strongest exposure, not their sum. A measured retest resets the state and absorbs all preceding dose effects; only remaining exposure and later additions are replayed. CO₂ loss conserves TA and cannot itself drive pH down. New acid additions still lower modeled TA/pH through the existing nonlinear dose response.

Scenario ranges separately vary nonnegative gas rates, a working ±0.1-pH reading allowance, and ±10% response for post-baseline doses only. Initial rate variation is broad; usable numeric intervals refine it automatically, with a minimum sensitivity allowance and room to widen after errors. These are sensitivity scenarios, not validated 95% prediction intervals. Out-of-domain sides are labeled rather than presented as exact endpoints. New measurements automatically refit the model and restart the forward projection without modifying historical samples, doses, bounds, or frozen forecast checks.

## Compact chart presentation (6.46)

Run `node tests/compact-charts.test.cjs`. FC, pH, TA and CH now share a short value/target summary. Threshold timing is displayed only where supported; CH remains sample-only and TA does not invent drift. Long model explanations and sample counts are inside a closed-by-default Model details disclosure below each chart. Paused forecasts, conditional bounded-start scenarios and older-sample extrapolation warnings stay visible. Expanded charts use the same renderer. This is a presentation change; model calculations, calibration and historical records are unchanged.

## Useful next steps (6.47)

Run `node tests/action-guidance.test.cjs`. Action facts now call the same full-history projections as Trends instead of removing date-only/historical refill context first. pH also advances with the model after an hour even without a new activity. Current-fill measured facts, bounds and carried TA remain distinct from estimates. An outstanding optional retest alone no longer creates a card when the modeled values are in range. Actual out-of-range/unknown essential values, high-FC interference and water-quality concerns remain actionable. An empty plan displays “Things look good—enjoy the tub,” qualified as based on logged readings/estimates, not safety clearance. Deferred problems never produce that all-clear. Action cards show the immediate step with the explanation/sequence collapsed. Historical events and dose quantities remain unchanged.

## Saved service settings (6.48)

Run `node tests/service-settings.test.cjs`. The Service tab has editable day intervals and filter display names, with an Edit intervals shortcut in All maintenance. Rinse defaults to 30 days; swap and deep clean to 60. UV bulb and quartz cleaning default to 365 days, and water change to 120; existing saved values take precedence. Swap reminders also recognize filter replacement events. Both reminder displays use the same task list and saved intervals. These are day intervals, not calendar-month schedules.

Names are stored under `maintenance.filter_set_labels`, retaining A/B IDs in `filter_sets` and all history. Saves validate integers 1–3650 days and nonblank names of at most 80 characters, cache immediately, and queue only edited fields for private `/api/config` sync. Sync merges into the latest remote config with SHA-conflict retries, preserving unrelated remote settings and fill changes. Offline/failed saves remain visibly pending and survive reload; unsaved form input survives background renders. New-fill config updates preserve remote maintenance settings. Manual Sync refreshes remote config as well as events. No service event is invented by editing a setting.

## Product library (6.49)

Run `node tests/products.test.cjs`. Run `node tests/products-ui.test.cjs` with jsdom installed (in this workspace: `NODE_PATH=../ui-test/node_modules node tests/products-ui.test.cjs`). Tests cover density units, concentration bases, legacy parity, missing-data restrictions, supported dry-acid response, log-only muriatic acid, frozen product revisions in drafts/final doses/corrections, calibration isolation, CYA/borates, calculator defaults, archive behavior, escaping and conflict-safe private sync. See [product-library.md](../docs/product-library.md) for the schema and operating limits.
