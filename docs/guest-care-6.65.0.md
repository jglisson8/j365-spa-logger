# Guest care and real-data practice — v6.65.0

## Guest instructions and dose drafts

Navigation names match the visible interface: Log → Test / Dose / Soak,
Save entry, Use this amount, Trends, Instructions and Your recent entries.
Suggestions never save an event. Actual amounts still require confirmation and
Save entry; corrections do not instruct adding more product. Save failures keep
the same submission ID for safe retry. Cups remain the initial unit and other
volume units remain available; changing units does not reinterpret quantities.
Main instructions stay brief; detailed help is expandable.
Guide shortcuts appear at the top, away from fixed navigation. A landscape CSS
fix also prevents the closed chart dialog from covering the app after rotation.

## Bleach target

Service → Guest invitations → Bleach dosing target saves
`targets.fc_target_ppm` privately using the existing conflict-aware config
queue. The patch touches only that leaf, preserving other chemistry settings.
Owner and guest calculators use it. Older configs retain 5 ppm with an explicit
default label until saved. This is not the chart's lower or upper limit.

## Conservative pH Down steps from strips

This is provisional decision support, not a validated safety guarantee or a
replacement for the product label. No acid-demand drops or exact starting/final
pH are fabricated. Historical readings, doses and existing forecast equations
are unchanged.

- Requires an approved bisulfate profile with usable purity and loose-volume
  density, a current-fill inventory, and a timed pH test no older than 30 minutes.
- Requires a usable FC test within 30 minutes of the pH test; high/offscale FC
  blocks a suggestion. Intervening dosing/use/water changes invalidate the test.
- Uses the strip's lower working bound. At least five paired Taylor comparisons
  for that block can replace this with the lowest observed Taylor value minus
  0.1 pH. These working bounds are not verified confidence intervals.
- Normally the 7.8 block overlaps the 7.8 limit and suggests no acid. The 8.4
  block has an 8.1 lower working boundary and may qualify. The target is the
  upper acceptable boundary, 7.8, not the owner's preferred 7.4 endpoint.
- TA must have a usable same-fill reading within 30 days. Supported additions
  update TA. Use the smaller of current TA minus 10 ppm, its uncertainty lower
  edge, and any applicable strip lower-bound scenario. The proposed step must
  leave this conservative TA scenario at or above 40 ppm. That 40 ppm guard is
  an engineering stop, not a Jacuzzi target or proof of safe water.
- Solve carbonate/borate/CYA acid equivalents nonlinearly at the lower starting
  pH. Compare zero-to-inventory buffer endpoint scenarios and take the smallest
  supported demand. Suggest half that acid demand, reduced further by any
  existing product-specific downward correction. Cap each step to 1 ppm TA
  consumption, the 40 ppm TA floor, and invitation single/daily limits.
- Convert acid equivalents through the approved product's purity and density.
  Round mL and displayed volumes downward. Small cup amounts may require tsp
  or mL; the app says so rather than rounding upward.
- A new test must be taken at least 20 minutes after the last chemical addition
  before another calculated dose. The instructions retain the Jacuzzi mixing
  guidance, cover open, no bathers and fresh testing before use.
- Strip-only values remain excluded from exact Taylor calibration. Later Taylor
  tests continue to update existing automatic product-response calibration.

## Real-data practice

The owner practice link requests a saved snapshot with existing owner-authenticated
GET APIs only. It loads saved config, months, active events and invitation product
permissions. No new Worker route or deployment is required. Personal event notes,
guest identities, deleted records and unrelated repair details are not copied
into the practice timeline. Choose among unexpired invitations (including
scheduled future access, without activating it) to rehearse their
products and remaining 24-hour allowance. The snapshot load time is visible.

Practice submissions are intercepted in memory. No network writes, redemption,
real guest activation, owner local storage writes or service-worker changes
occur. Temporary events use the actual fill ID. Switching invitation or resetting
discards practice entries. Missing owner sign-in/unexpired invitation falls back to
a prominently labeled synthetic demo, not a silent imitation of actual data.

## Regression coverage

New coverage includes acid eligibility, lower-bound overlap, TA/buffer/product
guards, stale/intervening tests, mixing/retest locks, downward unit conversion,
immutable inputs, target-leaf config merging/conflicts, actual snapshot forecasts,
invitation switching, note redaction and the prohibition on practice writes.
