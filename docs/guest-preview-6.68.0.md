# Guest preview uses saved tub data — v6.68.0

Service → Guest invitations → **Preview guest mode · real data** opens an
owner-authenticated, read-only snapshot of saved water history in guest view.
The existing `?practice=1` and `?practice=1&source=owner` URLs both use this mode.

- No invitation is required to preview real history, Trends, temporary strip
  tests and soaks. Without an unexpired invitation there are no approved dose
  products; the banner explains how to enable full dose rehearsal. No product
  permissions or safety caps are invented and no guest access is created.
- Existing unexpired/upcoming invitations still supply their actual profiles,
  instructions and remaining limits. Switching invitations discards temporary
  activity, not original data. Real guest authentication/sync are unchanged.
- Production never falls back to synthetic data. Sign-in, network or archive
  failures show a clear unavailable state, no forms with invented readings, and
  a retry/return-to-owner path. A failed initialization can be retried after
  reauthentication/recovery without a stale rejected promise.
- The banner shows snapshot load time. **Reload latest tub data** retrieves a new
  snapshot and discards temporary preview entries after confirmation. It is not
  continuous background synchronization; actual guest mode still uses real sync.
- Every preview submission remains in memory. The fetch interceptor is installed
  before startup, blocks all non-allowlisted requests before initialization, and
  permits only explicit owner snapshot GETs through captured original fetch.
  No real invitations, session activation, repository files or owner storage
  are modified. Source events are redacted before appearing in the guest UI.
- Explicit `source=demo` is retained solely on local test hosts (`spa.test`,
  localhost, 127.0.0.1) for isolated regression fixtures. It is not linked in the
  user interface and cannot enable synthetic mode on the production origin.
- Ignored invitation fragments are still stripped, while preserving preview
  query parameters. Practice mode never redeems an invitation.

Verification: `tests/guest-preview.test.cjs` covers default/production URLs,
no-invitation actual data, limited temporary saves, redaction, no synthetic
fallback, auth/network failures, retry recovery, blocked real writes/redemption
and unchanged owner storage/source data. Existing invitation snapshot tests
still cover real products, caps and invitation switching. Synthetic fixture
tests/browser scripts now opt in explicitly on the local test host.

`npm test`: 54 regression commands. Generated bundle/Worker compatibility and
whitespace checks remain required. No Worker deployment or data migration.

The isolated WebKit phone check (`scripts/check-guest-preview-browser.cjs`) also
passes with mocked owner-authenticated reads: actual snapshot/no invitation,
temporary soak, reloading newer data with preview activity discarded, Trends and
portrait/landscape layout. It asserts the browser's real persistent storage via
`globalThis.localStorage`, distinct from the guest's intentional in-memory
`localStorage` binding. The existing fixture-based mobile workflow also passes.
