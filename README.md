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

## Temporary guest access (beta)

See [guest mode and activation checklist](docs/guest-mode-6.57.0.md). The guest
UI is separate from owner entry and includes read-only Trends. Guest access is
disabled until the Worker is deployed/configured and an owner saves a dated
grant for a specific GitHub user. Publishing this static app does not deploy
the Worker or authorize a guest.

Build the standalone Worker with `node scripts/build-guest-worker.cjs`; the
retained base is `worker/base-v3.8.js`. Guest server and UI regression tests are
included in `npm test`. Optional real phone/touch checks are in
`scripts/check-guest-browser.cjs` and use synthetic records only.
