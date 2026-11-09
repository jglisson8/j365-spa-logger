# Refill startup, forecasts and aeration · v6.73.0

Local implementation; no deployment or production data migration.

## Workflow

- **Service → full water change** retains the purge, source/volume and optional
  chemistry wizard. One local event batch saves a refill and at most one
  initial sample, including zero FC and optional temperature and pH 8+.
  Equipment checks are optional, recorded on the refill only when selected.
- **Service → Refill startup** reports progress for the latest fill from real
  records: measurements, sanitizer, TA/pH, CH, CYA and borates. Use the existing
  chemistry form for measurements and actual additions. The guide points to
  aeration or a fresh test/acid-demand calculation as appropriate; a stale
  test or forecast is not the basis for another dose. Acid removes alkalinity;
  CO₂ exchange can raise pH without adding alkalinity ([Taylor pH/TA guidance](https://www.taylortechnologies.com/en/content/technical-supportfaqs)). Each cycle can be
  repeated without creating another fill or a synthetic sample.
- **Service → Refill and aeration settings** uses normal settings sync with a
  separate on-device queue. Rolling back to 6.72 does not strand older
  settings or discard unsynced refill edits. Defaults are CYA 30 ppm,
  borates 40 ppm after balance, post-acid pH
  7.2–7.4, four seats and a 120-minute acid retest limit. Existing chart
  limits and existing configured startup targets are retained. These are
  operational preferences, not criteria for re-entry.
- **Soak → 0** offers Start now and Finish now. The active clock is derived
  from the saved start, so closing/reloading does not restart it. The planned
  duration is optional and does not stop, log or forecast future jet use.
  Finish early or correct the resulting start/duration in History. Manual
  completed entry and Service → Jets without a soak still work.

The refill guide and Next Steps hold pH/TA adjustment prompts when the latest
measured FC is above the Taylor interference threshold. A new FC reading
does not make an earlier affected pH/TA reading usable. During aeration the
next action is to finish and retest; samples taken before the confirmed end
do not satisfy that retest. Event ownership uses the resolved UTC instant;
the analysis clips exposure at a refill without modifying the recorded log.

## Chronology and forecasting

The full-refill boundary owns the new fill for analysis, although its stored
`fill_cycle_id` can refer to the old fill for provenance. A boundary at the
same instant precedes chemistry. Explicit event ownership, Mountain time,
UTC offsets and existing historical order exceptions are retained. Live FC
decay uses evidence within the current fill available at the evaluation time;
the advanced historical analysis remains available separately. The initial
zero reading and subsequent recognized dichlor dose remain visible without
decay data. The Nov 7 case gives approximately +5.3 ppm theoretical FC and
+4.8 ppm calculated CYA from 1 tbsp at 395 gal. This is not a measurement.
Without a valid decay interval, the app makes no current/future FC estimate.
For a nonzero earlier sample it can show the dose increment without assuming
the earlier FC carried through unchanged.

Bounded pH remains a bound. A consistent Taylor endpoint may support a
conditional nonlinear carbonate/borate/CYA response. When the reconstructed
starting pH conflicts with the observed bound, the app will not force an
endpoint. It can show a conditional *post-dose* lower bound from the observed
boundary, known buffer state and recorded acid equivalent under closed-water
assumptions, or just the sample/bound and reason. That number is not a current
pH or a confidence limit. Trends keeps measured history, labeled retrospective
curves and the earlier supported same-fill projection, clipped before the
unsupported segment. Exact later samples reanchor the model.

## Adaptive acid response

New recommendations use the nonlinear alkalinity-equivalent response for
independently timed pre-dose and post-dose pH measurements. The fit requires
supported product mass and concentration, fresh measured TA and usable
buffer inventories; it rejects intervening chemicals, soaks, jet/cover
activity, top-offs, changes of fill and contradictory chemistry. Retests
must be at least 15 minutes after dosing and after any recorded circulation
time. The 15–60-minute range carries more weight than later retests. A
pre-dose test recorded in the same minute as its dose does not train the new fit.
The app cannot verify mixing or detect unlogged activity.

Same-product current-fill observations are weighted by TA, CYA, borates
and temperature context. A single usable numeric pair moves the estimate
away from the Taylor reference, with shrinkage toward that reference;
earlier fills contribute only a weak prior. Bounds can constrain the fit
but do not count as exact pairs. The displayed sensitivity range is not a
statistical confidence interval. Calibration does not increase the Taylor
recommendation above the original reference. Stored dose-time factors,
quantities, and frozen validation snapshots are not rewritten. Legacy
reconstruction is retained for archived un-snapshotted doses.

## Aeration data and assumptions

Starts are immutable `maintenance/custom` events with `aeration_session`
metadata and no completed exposure. A finish supersedes the start in the
normal audit log and stores `aeration_session_id` and a completed
`exposure.kind = jets` with confirmed elapsed duration. Seat capacity,
effective seat count and optional air-on minutes are additive; no old
record is migrated. Repeated clicks are guarded and competing finishes
of the same start are deduplicated in the owner's active view. Two devices
starting independently while offline cannot see each other's starts until
sync; use one device for each physical session. The app does not control jets.

Standalone jets default to four air-injected seats; a soak uses bather count
capped at four, with mixed mode at 50%. Actual air-on minutes multiply the
seat count separately. Water-only has zero air-injected seats but retains
the previous smaller water-jet exchange term. Where sub-session air timing
is unknown, the gas model spreads the observed fraction over the interval.
The provisional intensity scales by the square root of effective seats;
this is not a fourfold pH change. With varied, eligible current-fill data,
the model compares bounded alternative exponents using held-out errors;
without identifiable evidence the default remains. Absolute CO₂ loss
still requires evidence; this work introduces no fixed pH-rise-per-minute
constant. Temperature without a usable log still uses the existing 106°F
model assumption; calibration downweights that case. The pre-existing
carbonate, product and sanitizer conversion constants are unchanged.

Owner records use the same schema-v2 monthly/config sync. The existing
guest Worker projection continues to read legacy exposure fields and
infer defaults, but its allowlist does not expose new owner-only active
session or seat-override metadata. Guest write access is unchanged.

## Tests

`tests/refill-models.test.cjs` exercises the two November cases, chart
fallback, fill isolation, refill progress, seat math and conditional
scaling, calibration updates and confounders.
`tests/refill-aeration-ui.test.cjs` runs the real forms in a DOM, including
reload, actual timestamps, early finish, correction, and deduplication.
Run `npm test` and `npm run check:generated`.
