# Retrospective pH continuity — 6.52.1

The pH history renderer previously required exact-time, unbounded samples and
an uninterrupted supported forecast. A bounded reading, date-only activity,
partial-water-change event, model gap or blocked projection could discard an
entire sample-to-sample line. This made usable pH history look like disconnected
points despite subsequent measured endpoints.

`modeledChartHistory` retains the existing dose-aware model reconstruction.
`calculatedChartHistory` adds pH-only fallback connections where that renderer
cannot produce an interval. Supported curves take precedence.

Fallbacks use monotone smoothstep display interpolation between endpoints and
supported post-dose anchors, with a separate pre-dose point so the dose effect
does not move earlier than its logged time. This smooth shape is **not** a fitted
kinetic equation or a dose-percentage calculation. The actual intervening pH
trajectory cannot be recovered from two samples alone.

Bounded pH and date-only sample connections are dotted conditional scenarios;
8+ remains a bounded sample, using the displayed bound for scenario placement.
Unknown times use the existing calendar-day chart coordinates, never a saved
invented measurement time. Readout, SVG title and key identify these scenarios.

There is no connection across a full refill or differing fill identifiers, nor
an interval between simultaneous samples. A lone sample still needs an eligible
forward model to produce a forecast. No pH evidence, actual dose, forecast,
calibration coefficient, uncertainty calculation or stored event is changed.
FC and TA keep the existing stricter reconstruction rules.

Regression coverage includes the October 19 seven-drop / eighteen-teaspoon
partial-acid case, 90% boundary continuity, supported anchors, uncertain times,
bounded endpoints, blocked models, partial/full water changes, chart inspection
and scenario key rendering. All fallback values are display-only.
