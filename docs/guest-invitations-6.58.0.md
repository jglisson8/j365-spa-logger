# Guest invitations — v6.58.0 / Worker v4

## v6.61.0: streamlined guest workflow

- Matching valid invitation sessions skip repeat code entry when reopening the
  original texted link. Another guest's cookie cannot bypass activation.
- Direct Test / Soak / Dose choices, FC/pH first, TA optional; only active
  inputs validate. Account details and recent entries are collapsed.
- New entries default to the current submission time, not page-open time.
  Guests can edit the time; corrections and unchanged retries preserve their
  original instant. The soak summary explicitly labels the start time.
- A four-step guide and shorter invitation replace repeated prose. Trends are
  optional. Essential post-dose circulation/retest guidance stays visible;
  additional precautions remain available under Safety details.
- In-flight form edits are disabled; one immutable payload is saved. Guest
  permissions, private sync, chemistry calculations and historical data are
  unchanged. No new calculated doses or learned 7.8-block acid rule are enabled.

Regression checks cover hidden-field validation, current/manual/retry times,
matching/mismatched invitation reuse, draft/unit preservation, dose corrections,
concise instructions and a phone-width activity row. No Worker update is needed.

## v6.60.0: guest quick guide and dose reminders

Guest navigation now includes Log, Trends and Instructions. The quick guide
covers strip pH/FC checks, measured versus predicted values, approved doses,
actual amount/unit/time logging, retesting, soaks and cover handling. Owner
instructions are also displayed as plain text, with shortcuts back to tests
and Trends. Switching tabs preserves drafts and does not record anything.

The dose form shows circulation guidance before saving. A successful new-dose
save shows a dismissible reminder; correcting an old dose does not re-trigger
it. No timer or reminder automatically logs another dose or certifies safe water.
The guest form remains an actual-addition logger, not a strip-based acid-demand
calculator. Models, historical quantities and server permissions are unchanged.

The reminder uses 20 minutes rather than the proposed five: [Jacuzzi J-300
manual §13.2](https://jacuzzipartners.com/knowledgelibrary/assets/pdf/4666.pdf)
specifies running jet pumps with the cover open for at least 20 minutes after
shock/pH chemicals. Both J-365 jet pumps are named for guest clarity; follow any
longer product-label requirement. The guide includes separation of chemicals,
keeping bathers out during dosing, retesting and supervision of an open spa.

## v6.59.0 / Worker v4.1: one-browser activation

v6.59.1 keeps two separate copy actions: **Copy link + instructions** produces
a ready-to-text message with browser guidance, activation steps, dates and a
notice that the code will arrive separately; **Copy access code** copies only
the code. The first message never includes the code. Clipboard-denied browsers
can manually select the read-only message. Creation/reset refreshes it and
revocation clears it. No message or secret is persisted locally or sent for you.

New invitations include a separately generated 16-character (96-bit) access
code, shown once with its own copy button. Send the link privately; provide the
code separately. Entering the correct code activates the first browser. Later
attempts from other browsers fail, even with the original link and code.

This is browser-cookie binding, not hardware identification or a passkey. It
does not protect against a compromised device or deliberate cookie cloning.
Clearing cookies, private browsing, switching browsers, and some home-screen
browser contexts can require **Reset browser**. Reset rotates both link and
code, immediately invalidates old sessions, and preserves the guest's history
and identity. Sign-out alone does not release the binding.

The device cookie is established before activation, so retrying after a lost
response is safe. Activation uses GitHub SHA compare-and-swap: concurrent
browsers cannot both win. Every authenticated request verifies the binding as
well as expiry/revocation. Only hashes of codes/device secrets enter GitHub;
link/code values never enter persistent browser storage. A high-entropy code
avoids relying on weak short PINs or per-isolate brute-force counters.

Existing invitations remain compatible and reusable until the owner chooses
Reset browser to upgrade them. No grants or credentials are changed by release.

## Owner workflow

Open Service → Guest invitations, load invitations, and check the connection.
Enter the guest's name and start/end dates (Mountain time, at most 90 days).
Optionally approve the current bleach and/or dry-acid product, with explicit
single-dose and daily volume limits. Create the link, copy it, and send privately.
The link and separate access code are shown only once. Use Reset browser if lost.
No invitations are created by publishing this release.

Guests need no account. Their link opens strips-only testing, soaks, approved
actual additions, their own corrections, and read-only interactive Trends.
Saved doses enter the same private monthly history and forecasting pipeline
as owner entries. Guest names identify entries but are not verified identities:
anyone holding both the link and code can activate it first. After activation,
only the bound browser is admitted until expiry, revocation or reset.

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
