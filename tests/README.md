# Partial-acid regression

Run `node tests/partial-acid.test.cjs` from the repository root. No packages are required.

The test covers the October 19 case: 395 gallons, reported pH ≥8.0, TA 140 ppm, calculated CYA 30 ppm / borates 40 ppm, seven Taylor acid-demand drops targeting 7.4, and an actual six-tablespoon Spa Down dose. The recorded 20.1-tsp suggestion and actual quantity are not changed. Percentage calculations use the existing unrounded Taylor mass reference, so approximately 89.8% from that reference corresponds to approximately 89.6% of the displayed rounded suggestion.

Partial doses no longer use a 90% completion switch. Numeric starting pH uses the existing carbonate/borate/CYA state, reducing TA by acid equivalents while retaining dissolved inorganic carbon. Bounded starting pH uses a conditional state constrained by TA and the full Taylor endpoint; it is accepted only if its inferred starting pH satisfies the reported bound. This does not recover an exact starting measurement or validate an exact endpoint. Insufficient/inconsistent chemistry produces qualitative partial-response information instead. As before, a full reference dose (or a small excess within the existing 10% tolerance) is an approximate Taylor endpoint estimate, not a measurement.

The calculation assumes mixing without significant CO₂ loss during the immediate response. Existing temperature/constant, inventory, TA carry-forward, product-density and calibration assumptions remain provisional. Neither the scenario nor the qualitative bound is a validated confidence interval. Later samples reset the forecast and remain available to the existing automatic calibration pipeline; scenario points are never inserted as measurements.
