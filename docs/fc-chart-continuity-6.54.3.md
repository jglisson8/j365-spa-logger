# FC chart continuity — 6.54.3

Rendering-only fix. Forecast calculations, calibration, confidence windows, observations and recorded doses are unchanged.

The faint extension previously used only the final event anchor. When a soak or addition occurred after the supported forecast horizon, this omitted the interval from the horizon to that event.

Both supported and extended curves now sample the existing piecewise forecast over their respective time windows. They retain the active preceding anchor and all later anchors, including vertical dose/soak jumps. The extension retains its faint dotted styling and lower-confidence inspection label. Explicit chart start clipping is honored.

Regression coverage reproduces the October 21–22 timeline geometry with synthetic values: a 15.05-hour support horizon followed by a later soak. It checks continuity at the horizon, the previously blank interval, event discontinuities, multiple later doses/soaks, exact-boundary events, windows entirely beyond the horizon, and input immutability.
