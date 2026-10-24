# Guest invitations — v6.58.0 / Worker v4

## Owner workflow

Open Service → Guest invitations, load invitations, and check the connection.
Enter the guest's name and start/end dates (Mountain time, at most 90 days).
Optionally approve the current bleach and/or dry-acid product, with explicit
single-dose and daily volume limits. Create the link, copy it, and send privately.
The secret is shown only once. Revoke and create another invitation if lost.
No invitations are created by publishing this release.

Guests need no account. Their link opens strips-only testing, soaks, approved
actual additions, their own corrections, and read-only interactive Trends.
Saved doses enter the same private monthly history and forecasting pipeline
as owner entries. Guest names identify entries but are not verified identities:
anyone holding the link can use that invitation until expiry or revocation.

## Security and compatibility

The 256-bit random secret travels in a URL fragment, removed before startup
requests, and is not persisted in local storage. GitHub stores only its SHA-256
digest. A separate encrypted HttpOnly Secure guest cookie preserves owner login
on the same device. Every guest API request rechecks expiry and revocation.
Origin and CSRF checks, product snapshots, volume caps, strict event validation,
retry IDs and fast-forward-only writes remain enforced.

An absent GUEST_ACCESS_ENABLED binding permits only explicit valid invitation
grants; setting it to `false` is the emergency kill switch. Legacy GitHub guest
grants still require `true`. Existing owner OAuth and legacy APIs are retained.
No new secrets are needed: reuse the working GitHub App installation credentials.

Guests remain an online beta with an in-memory draft, not an offline durable
queue. If a save succeeds but refresh fails, the UI warns not to log it again.
If invitation creation loses its response, reload the list and revoke the
unwanted invitation before retrying.

## Release verification

Synthetic regression tests cover separate cookies, no owner API access, secret
redaction, active dates, expiry, revocation, CSRF, duplicate retries, canonical
shared-history doses and forecast effects. No real guest grant is needed to test.
Deploy `worker/j365-worker-v4.mjs` after static publication; retain v3.9 as rollback.
Historical measurements, quantities and chemistry equations are unchanged.
