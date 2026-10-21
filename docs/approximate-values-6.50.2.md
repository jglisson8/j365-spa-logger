# Approximate-value notation · 6.50.2

Use `≈` next to a calculated/approximate number instead of repetitive “estimated” labels. This covers chart summaries and touch readouts, modeled and post-dose keys/markers, retrospective interpolation, forecast crossing times, calculator results, modeled TA/pH changes, next-step facts, working CYA/borates inventories and advanced half-life/demand summaries. Approximate top-off volumes retain their existing `volume_estimated` flag and display the symbol in history. Input labels also clarify approximate volume/time entries.

Samples and actual chemical quantities are not relabeled as approximations. Carried-forward facts retain that qualifier. Bounded starts, conditional scenarios, extrapolation/low-confidence labels, paused forecasts and safety/validation cautions remain explicit; a symbol does not replace a warning. The chart key defines `≈` as calculated or approximate, not sampled.

This is presentation only. No chemistry equations, numerical settings, historical records, product quantities, calculation metadata or persisted field names change. Existing text in user notes and historical saved records is not rewritten. No Worker change is required.

Regression coverage checks the notation across FC/pH/TA summaries, sampled versus modeled chart inspection, post-dose scenarios, next-step cards, approximate top-off labels and unchanged actual-dose labels. Existing calculator, forecast, persistence, chart and UI suites remain required.
