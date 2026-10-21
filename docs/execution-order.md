# Save and render execution order · 6.50

This is a map of the existing wrapper architecture, not a rewrite. All registration finishes before the final `migrateLegacy(); fillNow(); render(); calculate(); connect();` call. Helpers may refer to later declarations only because user interaction and asynchronous continuations occur after initialization.

## Save pipeline

The final `save` enters these wrappers, outermost first:

1. Automatic forecast checks: freeze a prospective review from prior events, before adding the new sample.
2. Weather: attach available forecast context; schedule a separate asynchronous weather-note save if context arrives later.
3. Evaporation: snapshot top-off assumptions and previous water-level selection.
4. Environment: attach top-off reason and supplied source-water chemistry.
5. Test quality: attach Taylor defaults, explicit idle confirmation and test-before-dose relationship.
6. Form conditions: call the core, then reset conditions only after successful persistence.
7. Core: attach entered soak/chemistry conditions, merge immutable IDs, persist locally, call the **current final render once**, set success toast, optionally synchronize affected months.

The former feature wrapper called render a second time after core save. It was removed; `save-pipeline.test.cjs` proves one synchronous full render and no success/render after failed persistence. A later weather-note save remains a legitimate separate event/render, not a duplicate measurement.

Full-refill handling deliberately uses `save(..., false)` and then synchronizes config and months after staging its fill pointer. Dose calculator confirmation stages a draft only; it never calls save by itself. No recommendations are automatically recorded.

## Render pipeline

The final render traverses these wrappers from outside inward:

1. Configuration conflicts (render conflict controls after inner pipeline).
2. Product library (preserve dirty editor/default inputs and frozen dose rows).
3. Service settings (preserve dirty interval/name inputs).
4. Action guidance.
5. Streamlined header: water age/CYA and history time presentation.
6. Model beta summary.
7. Friendly history details and next-maintenance summary.
8. Final core history renderer plus `renderExtras`: fill summary, maintenance, charts and forecast checks.

The earlier simple render definition is replaced before this chain is installed. Wrapper closures capture the preceding implementation; core save calls the final live binding. Do not move initialization or replace a wrapper without checking this order. Environment/forecast functions do not write new measurements while rendering.

## Deliberately deferred

Do not split chemistry into runtime modules or add model memoization in this release. A future extraction should first isolate pure inputs and cache invalidation keys for events, corrections, settings, clock, weather and product snapshots. The small pure timezone helper is the first build-checked boundary; it stays bundled for both deployment paths.
