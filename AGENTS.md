# Forecasting QA and publishing rules

The logger is a coupled chemistry/event/UI system. A green collection of
isolated model tests is not enough to publish a change.

Before editing, inspect the relevant model, event handling, display and tests.
Preserve dirty user changes and capture the starting commit for comparison.
Do not fetch private spa-data into public fixtures or screenshots. Use the
synthetic journeys in tests/fixtures/forecast-journeys.cjs instead.

For every runtime change:

1. Reproduce the reported failure in an automated regression test first.
2. Check FC, pH and TA together, even for a supposedly single-parameter fix.
3. Check model results, Home, compact/expanded Trends, actual dose quantities,
   measured-versus-calculated labels, retest reset and fill isolation.
4. Run npm run qa with QA_BASE_REF set to the starting commit SHA. This runs
   generated-file checks, all regressions, release journeys, forecast comparison,
   and real Chromium/WebKit mobile browser checks. Browser runtimes must be
   installed; a skipped or failed browser launch is not a passing check.
5. Inspect artifacts/forecast-qa.json and screenshots. If forecast outputs
   changed, explain each change in qa/forecast-change-reviews.json with its
   source_sha256, scenario, parameter, and substantive reason. Never approve
   differences automatically, weaken acceptance ranges, or update expected
   values simply to make a failing test green. Independent chemistry/reference
   expectations and immutable original records remain required.
6. Publishing uses the gated GitHub Actions workflow. Never restore legacy
   branch publishing to bypass a failure. After deployment, run npm run
   verify:live and report the verified version, tests, and remaining limits.

No change can guarantee chemical accuracy or future prediction precision.
Unsupported chemistry needs a specific reason while preserving sample history.
Conditional estimates must remain distinct from measurements and must not
silently train clean-data calibration or establish safe-to-soak clearance.

Do not modify production spa-data or Cloudflare secrets without explicit user
authorization. A Worker change needs its own regression checks and deployment
verification; the front-end Pages gate does not deploy the Worker automatically.
