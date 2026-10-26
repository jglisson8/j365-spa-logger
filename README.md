# J-365 Spa Logger

Static, local-first logger with authenticated private GitHub synchronization through the existing Cloudflare Worker. Open the secure Worker address for synchronization; GitHub Pages remains the static interface source. Production needs no npm packages or build server.

## Development and tests

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

See [guest invitations](docs/guest-invitations-6.58.0.md). Guests use expiring
private links, without GitHub accounts. The separate guest UI includes strip
tests, soaks, approved actual doses, and read-only Trends. No access is granted
until the owner creates an invitation. Publishing the static app alone does
not deploy Worker v4 or authorize anyone.

Build the standalone Worker with `node scripts/build-guest-worker.cjs`; the
retained base is `worker/base-v3.8.js`. Guest server and UI regression tests are
included in `npm test`. Optional real phone/touch checks are in
`scripts/check-guest-browser.cjs` and use synthetic records only.
