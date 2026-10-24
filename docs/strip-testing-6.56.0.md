# Taylor / AQUANEXO testing — 6.56.0

## Entry and storage

The owner starts in Taylor K-2006 only on each launch. Testing method can switch to Taylor + AQUANEXO strips or Strips only. Switching preserves unsaved Taylor fields; hidden/disabled Taylor values cannot leak into a strip-only save. Mode selection remains during the current session. No guest role or shared-account access is introduced in this release.

Owner-supplied AQUANEXO 3-in-1 profile:

- FC: 0.5, 1, 3, 5, 10, 20 ppm.
- TA: 0, 40, 80, 120, 180, 240 ppm.
- pH: 6.2, 6.8, 7.2, 7.6, 7.8, 8.4.

Each strip parameter permits a bottle block, below/above scale, or Not tested. Follow the bottle's reading procedure. No colors or read-time specifications were invented.

One chemistry record stores a paired test. Taylor stays canonical for each parameter actually tested with Taylor; a missing Taylor parameter may use the strip. `measurement_sources` identifies each field independently. `strip_observations` preserves the raw choice, versioned product profile, frozen working range/value and paired-comparison evidence. Top-level numeric strip fields are explicitly working estimates for compatibility, not exact observations. Legacy entries and their default Taylor interpretation are unchanged. Source metadata is set before prospective forecast checks and preserved by the old save pipeline.

## Range and calibration policy

Interior block boundaries start at midpoints between adjacent standards. These are **provisional working bins**, not manufacturer-certified error limits or 95% confidence intervals. Upper-edge/off-scale results and the lowest pH block remain censored; no precise forward forecast is produced for them.

Paired results teach a per-parameter/per-block product-specific reference distribution, not a generic linear strip correction. The most recent 100 pairs per block are retained for comparison. Taylor bounded pH is not an exact calibration reference. A provisional median correction begins at five pairs for that block, blended with the uncorrected block value using n/(n+8). The original bin floor is retained and enlarged to cover paired observations with working reference allowances (pH .1, FC .2 ppm, TA 5 ppm). These are modeling allowances, not verified instrument specifications. Original raw and working readings are never rewritten. Future/reported-later evidence is excluded from a backdated snapshot.

The comparison summary exposes counts, Taylor medians and observed spreads. Product, lighting, storage and observer changes can introduce errors beyond these working bins; user-specific accuracy is not guaranteed.

## Models and guidance

Strip-only readings may re-anchor FC/pH/TA forecasts as low-precision observations. Existing equations are evaluated at both strip limits; pH also includes strip-TA corner scenarios at its anchor. Inspection displays the resulting working range. Existing uncertainty bands cannot be narrower than that range. FC crossing windows are enlarged by its endpoint scenarios; exact pH/TA strip-based crossing intervals are withheld. These are sensitivity scenarios, not validated probability coverage.

Training views omit strip-derived parameter fields (not their doses, soaks or other activities). Paired Taylor fields remain eligible. FC decay, bleach response, immediate/delayed bather demand, exposure response, pH gas fitting, empirical balance effects, acid calibration and parameter-framework training therefore retain Taylor-based evidence. Strip-only endpoints do not score as precise prospective validation tests. A later Taylor reading can independently check a prior strip-informed forecast.

Action guidance uses ranges rather than treating strip numbers as exact. A range crossing an alert boundary is not silently classified as acceptable. Strip-only entries do not drive the existing precision-dose calculators; Taylor acid-demand results still require a Taylor pH reading. Manually confirmed actual additions remain loggable.

Charts use amber squares and a Strip ≈ key for strip-derived fields, while paired Taylor fields remain normal samples. History retains the strip choices and method. Correct a strip observation by removing/re-entering it; its computed numeric proxy is read-only in the generic editor. Original data is retained by the existing reversible removal flow.

## Compatibility and tests

Uses existing chemistry numeric fields plus additive metadata, compatible with the existing Worker and monthly files; no Worker deployment or historical rewrite is needed. Guest permissions, server-side guest restrictions and strip-only guest UI remain separate future work.

Tests cover exact blocks, paired priority, mixed per-parameter sources, automatic method tags, range forecasts, censored observations, calibration and prospective time cutoffs, training/scoring isolation, legacy tests, draft/reset semantics, dose-calculator isolation, phone paired/strip-only saves, chart symbols and offline startup.
