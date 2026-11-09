# J-365 Spa Logger

Static, local-first logger with authenticated private GitHub synchronization through the existing Cloudflare Worker. Open the secure Worker address for synchronization; GitHub Pages remains the static interface source. Production needs no npm packages or build server.

## Development and tests

See [v6.73.0 refill, forecasts and aeration](docs/refill-forecasts-aeration-6.73.0.md)
for the startup guide, additive event fields, model assumptions and regression cases.

See [v6.67.1 mobile keyboard notes](docs/mobile-input-6.67.1.md) for viewport-aware
entry controls and mobile keyboard testing limitations.

See [v6.67.0 UI performance notes](docs/ui-performance-6.67.0.md) for profiling,
operation-scoped model reuse, on-demand charts and numerical-parity checks.

For the targeted manual/calculated acid-response consistency fix, see
[v6.66.1 investigation and regression notes](docs/acid-dose-context-6.66.1.md).

Use Node.js 24 (`nvm use`), then:

```sh
npm ci
npm test
```

The locked jsdom dependency is development-only. The test runner checks generated time helpers, chemistry regressions, four runtime timezones, offline configuration conflicts, prospective forecasts and browser/UI interactions. It makes no live private-data writes. GitHub Actions runs the same command on pushes and pull requests; the separate Pages deployment is not evidence that regression tests passed.

The canonical timezone helper is `src/spa-time.js`. After editing it, run `npm run build:time` to update its marked inline copy in `index.html`, then `npm test`. The single-file production bundle deliberately avoids new asset/module requirements in the Worker.

See [reliability audit and release notes](docs/reliability-6.50.md), [execution order](docs/execution-order.md), [product library](docs/product-library.md), and [chemistry regression notes](tests/README.md).

## Top-off source-water fallback (v6.63.1)

Entered top-off source TA takes priority, including zero. If missing, the model
uses recorded source TA on the same fill, otherwise the earliest non-strip TA
within three calendar days of that fill, before known acid/bicarbonate treatment.
The latter is labeled an approximate initial-fill source proxy, with its event
ID retained in the resolver; it is not a new measurement or training pair.
No future or previous-fill reading is used. Without a usable baseline, the
existing pause remains. FC still defaults to zero, never a chlorinated fill test.
pH is not arithmetically averaged. Original events and saved forecast reviews
are unchanged; current projections recompute from the new assumption.

## Temporary guest access (beta)

Service → Guest invitations → **Preview guest mode · real data** loads the signed-in
owner's saved history in a temporary guest view. No invitation is needed for
the full workflow. Without one, dosing uses saved products with clearly labeled
preview-only limits; selecting an invitation uses its exact approved products and
limits. Preview never saves real entries or grants access.
See [v6.69 guest workflow notes](docs/guest-workflow-6.69.0.md).
For practical cup/tablespoon suggestions and the revised guest acid calculation,
see [v6.70 dosing notes](docs/guest-practical-doses-6.70.0.md).
The [v6.72 guided sequence](docs/guest-manual-mixing-6.72.0.md) uses circulation
instructions and a manual “Mixing finished” button after bleach, then offers
supported pH Down without an intervening test. There is no countdown or timed lock.

For the current source-water profile, practice guest mode, compact forecast
status and accuracy summary, see [v6.64 readiness notes](docs/readiness-6.64.md).

See [guest invitations](docs/guest-invitations-6.58.0.md). Guests use expiring
private links, without GitHub accounts. The separate guest UI includes strip
tests, soaks, approved actual doses, and read-only Trends. No access is granted
until the owner creates an invitation. Publishing the static app alone does
not deploy Worker v4 or authorize anyone.

Build the standalone Worker with `node scripts/build-guest-worker.cjs`; the
retained base is `worker/base-v3.8.js`. Guest server and UI regression tests are
included in `npm test`. Optional real phone/touch checks are in
`scripts/check-guest-browser.cjs` and use synthetic records only.
