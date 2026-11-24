# Release QA

## What went wrong

Many earlier checks covered individual fixes, but did not consistently replay
one log through FC, pH, TA, Home and Trends together. The app could also publish
from main before the independent regression workflow finished. Passing 68
commands did not establish that the whole user-visible workflow was correct.

## Required gates

1. Generated app/offline files and Worker source must match their authored files.
2. The complete existing model, sync, guest, inventory and UI regression suite.
3. Eight synthetic acceptance journeys, each checking all three forecast
   parameters, Home/API/chart consistency, immutable stored events, expected
   unsupported states and visible measured history. Measured baselines on Home
   are allowed to differ from a newer forecast, but must match their actual
   source sample. Unsupported values must never be invented just to pass.
4. Before/after forecast report against the last successfully deployed commit
   (or PR base). A failed intermediate push is never the production baseline. Changed
   values, availability, Home estimates or history visibility require a written
   reason scoped to the exact index.html SHA-256. Passing tests do not substitute
   for explaining a changed result. Independent expected ranges still apply;
   an explanation cannot override a failed acceptance contract.
5. Chromium and WebKit mobile browser runs: real execution, expansion, touch
   inspection, landscape geometry, reload persistence, no JavaScript errors,
   no live data and no remote writes. Screenshots and reports are CI artifacts.
6. Only then package the public runtime and publish. Compare exact live HTML
   and offline-worker bytes at both app URLs; verify private routes reject
   unauthenticated requests. A failed verification fails the deployment job.

The canary suite deliberately injects the prior failure classes in memory and
requires the gate to reject them. This protects against tests that accidentally
stop checking the very behavior they were added to cover.

## Local commands

Install development dependencies with npm ci, then install official browsers
using npx playwright install chromium webkit. A temporary browser location can
be selected with PLAYWRIGHT_BROWSERS_PATH.

Run QA_BASE_REF=<starting-commit-sha> npm run qa. Read the ignored local
artifacts/forecast-qa.json and artifacts/browser screenshots. With no baseline,
the report explicitly says no comparison was performed; CI resolves the last
successful deployment automatically and requires a supplied fallback SHA if
there is no deployment history. Do not describe a no-baseline report as a
before/after review.

Before changing independent expected ranges, identify the source equation,
table, or deliberately documented modeling assumption. Never copy new output
into expectations without that review. Every user-visible regression should
join a shared journey when it represents a cross-layer failure.

## Activation and recovery

GitHub Pages must use GitHub Actions as its publishing source, not legacy
main-branch publishing. The deploy job depends on the model/replay job and both
mobile engines. Main pushes and manual dispatch can publish; PRs cannot. No
private-data tokens are provided to these jobs. Public artifacts contain only
index.html, sw.js, manifest.webmanifest and assets.

If any pre-deploy gate fails, the existing live app stays in place. If a
post-deploy smoke test fails, investigate immediately and revert the faulty
source commit through the same pipeline; no automatic reset or data rollback
is performed. The workflow reports failure rather than silently claiming a
successful release. Keep the last known-good commit available for recovery.

Cloudflare dashboard Worker changes remain a separate manual deployment step:
test and review the source diff, preserve bindings/secrets, verify the deployed
health version, authentication guards, and owner/guest metadata compatibility.

## Limits

These checks do not prove forecast accuracy, test every possible chemistry
combination, cover every physical phone, or replace independent scientific
review of changed equations. The real-browser tests isolate network access and
block service workers; offline caching still has its dedicated automated suite
and exact live-file checks. Human visual review and real-device spot checks are
still appropriate for substantial UI changes. No chemistry equations or
production data were changed to introduce this process.
