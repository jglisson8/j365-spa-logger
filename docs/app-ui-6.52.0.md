# App-oriented interface — 6.52.0

Presentation-only release. Chemistry equations, fitted coefficients, predictions, immutable dose snapshots, source observations, event timestamps, schemas and private synchronization are unchanged. Offline shell version advances with APP_VERSION/package version; Worker 3.8 already serves the required fixed public resources, so no new backend deployment is needed.

## Charts

The existing SVG renderer retains the exact sampled/model curves but uses viewport-aware geometry, labeled major gridlines and lighter minor subdivisions. Auto scale follows the plotted samples and calculated values; Full limits also includes alert thresholds and the dosing target. Custom numeric limits are validated and retained per parameter on the device. An off-scale alert remains visible as a labeled, editable edge chip; scaling never changes a chemistry target. Axis subdivisions are not a claim of measurement precision.

Expanded charts use a dedicated chart-first screen with a stable value/readout area, a horizontal bottom legend and quick 24h/7d/14d/Fill windows. Numeric preset durations describe the total displayed span, reserving up to one quarter (maximum 72h) for forward projections. Custom From/To controls remain available. Drag inspects, pinch zooms, and explicit zoom/earlier/later controls provide non-gesture alternatives. Phone rotation recomputes geometry; fullscreen/orientation ownership cleanup remains intact. Conditional, paused and extrapolation warnings remain visible. Only applicable legend series are shown, while editable limit entries remain available.

A recent/future window with no sample inside it can use the current fill's preceding timed sample as a clearly labeled forecast anchor. The selected time window stays exact; the earlier sample is not drawn as if measured inside it, copied into storage, or promoted into new training data. Context never crosses a newer refill boundary. Empty parameter views clear the previous parameter's headline/model details.

## Navigation and entry

Five labeled bottom destinations retain the existing screens. Switching destinations preserves DOM input values and per-screen scroll positions. A fixed original form submit button sits above the navigation with an explicit staged-addition status; it still uses the existing single-save pipeline. Next Steps keeps its existing decision engine and safety text, but moves the first detailed action into its existing disclosure. All-clear behavior remains unchanged. Installation help and verbose backup details live under Service → App & connection; water age, next service and primary sync state remain accessible.

History is grouped by existing displayed calendar dates and opens an entry sheet, delegating correction/removal/restoration to existing original controls. Browser/Android Back closes the top dialog first, including nested editors. No historical records or quantities are rewritten by these views.

## Verification / future maintenance

`src/app-ui.js` is canonical and embedded by `node scripts/build-pwa.cjs`, with generated-source checks in the regression suite. `tests/app-ui.test.cjs` covers tick generation/scales, off-scale bounds, range presets, readouts, pinch, navigation/draft preservation, nested dialog Back and history without record mutation. Existing model, correction, save, sync, fullscreen and PWA suites still run.

`scripts/check-app-layout.cjs` is an optional isolated Chromium touch/layout check using `J365_PLAYWRIGHT` / `J365_CHROMIUM`. It asserts the plot and legend fit in landscape, portrait plot height, save/nav separation, real two-touch pinch, Back and record retention. It uses only synthetic records and an isolated browser origin/profile. The existing `scripts/check-pwa-browser.cjs` additionally validates a fresh offline launch and API/auth cache isolation.
