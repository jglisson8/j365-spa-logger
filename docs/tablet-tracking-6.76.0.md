# Trichlor dispenser tracking · 6.76.0

Continuous-source ledger, not a count-to-instantaneous-FC conversion.
Owner-confirmed historical load: four GLB 1-inch trichlor tablets placed in a
floater approximately November 12, 2026 at 17:00 MST, on the November 7 fill.
No replacements reported; still present November 23. Stable import ID,
separate creation/reporting time, and timestamp_approximate flag.

## Ledger and owner policy

The start is a schema-v2 chemical_addition in tablets with additive
tablet_dispenser metadata. Notes hold cumulative dissolved-weight observations
or explicit removal/exhaustion, linked to the start ID. A full refill ends the
preceding fill's exposure. Time alone never exhausts a load.

By explicit owner instruction, the first later recognized liquid-bleach
addition ends the load as assumed exhausted / removed. This is derived, not
written as an observed removal. Corrections recompute windows. Dichlor and
acid do not end dispensing. Measurements at the stop timestamp conservatively
remain pre-removal for calibration; later clean intervals resume normally.

Service → Tablet dispenser supports checkpoints, removal, exhaustion, and new
GLB loads with optional verified gram weight per tablet. The original load is
immutable. Existing History correction/removal audit applies. No replacement
is inferred, and a new load does not remove another active load. Owner-only
controls do not grant tablet management to guests. The Worker read allowlist
shares only relevant tablet fields. Older Workers expose recognizable product
and count for conservative start detection; the new Worker is needed for
explicit removal/checkpoint parity in guest Trends.

## Calibration and forecasting

Intervals overlapping dispensing are excluded from ordinary FC decay,
bleach/dichlor dose response, immediate/delayed soak demand, exposure loss,
acid response, empirical pH/TA and CO₂-loss fitting—even when tablet placement
preceded the interval's first sample. Earlier valid fits, actual measurements,
frozen forecasts and dose amounts are unchanged. Backdated evidence naturally
invalidates later forecast-check digests without rewriting frozen contents.

Stable FC alone cannot separately identify source release and demand.
FC history stays visible. An available pre-tablet model supplies a labeled
conditional curve without further tablet release—not actual current FC,
a confidence bound, a threshold prediction or dosing advice. Unknown tablet
acidity also prevents treating retained pH/TA scenarios as actual concentration.

## Product and inventory

Primary sources identify 90% available chlorine and 99% trichlor:

- https://glbpool.com/product-category/sanitizers/
- https://www3.epa.gov/pesticides/chem_search/ppls/007364-00057-20250310.pdf

No individual tablet mass was verified from primary evidence. Historical
mass stays null. A GLB Small 1 Inch Tablets product sheet hosted by Imperial
Pools documents a nominal half-ounce tablet:
https://imperialpoolsb2b.com/documents/glb71250-Installation-Manual.pdf
This older sheet is a nominal mass reference only, not a measurement of the
owner's tablets or proof of the current package's exact weight. Its 89%
available-chlorine figure is not substituted for the current EPA label's 90%.
CYA uses
one mole trichlor (232.41 g/mol) yielding one mole CYA (129.07 g/mol), at 99%
product purity. Existing bleach/dichlor/acid constants are unchanged.

Unknown mass gives known baseline/dichlor CYA as a lower bound with unknown
upper bound—not 30 ppm by assumption. Known mass gives capacity bounds, not
proof of dissolution. Cumulative dissolved-mass observations constrain inventory
without inventing a constant release rate. Measured CYA resets the baseline to
avoid double counting; water replacement broadens uncertain timing bounds.
Owner-assumed exhaustion credits known initial mass only. Without mass, CYA
remains unknown. No exact pH/TA acidity is invented without dissolution and
chlorine-consumption context. No automatic future release schedule or re-entry
recommendation is made.

The November fill contains three logged one-tablespoon dichlor doses, each
contributing 4.8266 ppm CYA using the existing saved reference. Total: 14.4799.
Four nominal half-ounce GLB tablets contain capacity for another 20.8483 ppm,
or 35.3282 total after full dissolution. A 30 ppm target corresponds to 74.44%
dissolution. These values are exposed in a separate capacity_scenario API
object and Trends → CYA tablet inventory. They are not current CYA or a hard
upper bound; no capacity is credited before placement. A subsequent measured
CYA baseline or water-loss dilution disables this simple endpoint scenario
rather than double counting or inventing release timing.

## Verification and import

Full suite: npm test; npm run check:generated;
node scripts/build-guest-worker.cjs --check.
Focused: tests/tablets.test.cjs, tests/tablets-ui.test.cjs,
tests/tablets-worker.test.mjs.

scripts/record-confirmed-tablets.cjs defaults to a read-only live check.
With --write, it adds only the confirmed load using GitHub SHA protection,
then verifies all previous events are unchanged. Existing tablet records
prevent duplicate import. The app never runs this script automatically.
