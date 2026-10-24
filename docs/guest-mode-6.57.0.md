# Guest mode beta — 6.57.0 / Worker 3.9

## Evaluation and scope

Guests use their own GitHub account and the secure `/guest` link. Owner access
to the main app remains unchanged. Guest rights are enforced in the Worker;
removing a hidden control or calling the owner APIs does not grant owner access.

Guest capabilities:

- AQUANEXO strip tests only, using the owner's exact six blocks per parameter.
- Soaks: bathers, actual duration, showering, and air-control setting.
- Actual additions of owner-approved bleach/dry-acid product revisions, with
  cups/tbsp/tsp/fl oz/mL and explicit owner-set per-dose/24-hour volume caps.
- Read-only Trends using the existing forecasting/chart engine: measured versus
  predicted series, strip ranges, activity markers, touch inspection, expansion,
  time range, and local vertical scaling. No target or model edits.
- Corrections/removal of their own active submissions within the same access
  grant, same calendar month, and 48-hour recording window. Originals remain in
  the repository. No owner/other-guest edits, configuration changes, or service.

No automatic acid instruction is derived from a strip or pH forecast. Product
caps are authorization limits, not chemical recommendations. Instructions are
owner-written. No guest is authorized by this release itself.

## Private-data and model boundaries

The context endpoint sends an explicit allowlist of active chemistry, dose,
soak, water/fill, filter/UV, exposure, and weather model inputs. It excludes
free-form event notes, repair costs, imported source documents, superseded
records, saved forecast-review payloads, access lists and tokens. Guest-visible
instructions and product names are deliberate owner-shared text.

The guest view uses in-memory storage, never the owner's localStorage. History
and configuration are not retained across closing/reloading the guest page.
The guest beta requires internet for saves; there is no durable offline guest
queue or guest-specific installed PWA yet. The owner's PWA is unchanged.

Guests see the same model implementation, but not a promise of pixel-identical
owner predictions: device-only model preferences and private saved validation
payloads are not shared. Strip observations retain ranges and do not train
precise chemistry response coefficients. Paired owner observations remain
available as redacted chemistry inputs. Forecasts are not safety guarantees.

## Authorization and sync

`guest-access.json` is separate from chemistry configuration and stores immutable
numeric GitHub user IDs, display logins, grant IDs, UTC access boundaries,
revocation, instructions and pinned product profiles. The owner UI accepts
Mountain-time dates and converts explicitly through SpaTime. Grants are limited
to 90 days and 20 retained grants. Existing config and legacy APIs are untouched.

Each request rechecks the current private access list (not a cached grant).
Guest OAuth tokens identify the guest only. A server-held GitHub App installation
token is restricted to `j365-spa-data` with Contents write permission; no private
repository membership is required for the guest. Both PKCS#1 and PKCS#8 PEM
private keys are supported. Tokens and signing keys never go to the client.

Writes require same-origin JSON and the encrypted session's CSRF token. The
server constructs canonical events from allowlisted request fields, computes
strip ranges, resolves fill membership, pins the approved product snapshot and
stamps the actor/receipt time. It rejects future, >48-hour-old, out-of-window,
unknown, cross-type or forged fields. Client roles/calculations are not trusted.

Guest writes use a pinned Git repository head and fast-forward-only Git Data
commits. Concurrent owner/guest writes cause a bounded reread/retry rather than
overwriting a monthly document. This also serializes submissions spanning a
month boundary. Submission IDs plus a canonical request fingerprint make an
unchanged retry idempotent. Daily caps are per grant/product, based on active
recorded additions and server receipt time, not a claim about unlogged doses.

The shared archive currently fails closed beyond 24 monthly files to remain
within ordinary Worker subrequest budgets. Pagination/cached model context is
needed before that scale. Owner archive handling remains unchanged.

## Deployment and activation checklist

1. Run `node scripts/build-guest-worker.cjs`, `npm test`, and browser checks.
2. Compare `worker/base-v3.8.js` with the current Cloudflare source, preserve a
   rollback version, then deploy `worker/j365-worker-v3.9.mjs`. Do not deploy the
   base alone. App publication by GitHub Pages does not deploy this Worker.
3. Existing `GITHUB_APP_ID`, `GITHUB_INSTALLATION_ID`, `GITHUB_PRIVATE_KEY` must
   identify an installation with Contents read/write on `j365-spa-data`.
   Existing OAuth and SESSION_SECRET bindings remain unchanged.
4. While signed in as owner, Service → Guest access → Check guest connection
   (`GET /api/guests/check`) validates that installation connection without
   revealing a token or enabling guest access.
5. Set `GUEST_ACCESS_ENABLED=true` only when ready. The default is disabled;
   missing/invalid bindings fail closed. An empty access list permits nobody.
6. In Service → Guest access, load settings, enter the actual guest username,
   start/end dates and instructions. Optionally enable each current product
   with deliberate limits. Save resolves the login to an immutable GitHub ID.
7. Test with a real authorized non-owner account, including upload, Trends,
   own correction/removal, expiry and revocation, before relying on it away.
8. Share `https://j365-spa-sync.jglisson8.workers.dev/guest` only after activation.

No production guest grant, chemical quantity, measurement, or fill boundary is
created by build/test scripts. All automated account/data fixtures are synthetic.

Protocol references: [installation tokens](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-an-installation-access-token-for-a-github-app),
[App JWTs](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-json-web-token-jwt-for-a-github-app).
