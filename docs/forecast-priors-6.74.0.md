# Historical-rate forecasts · v6.74.0

A refill resets the chemistry baseline, not the tub's accumulated evidence.
Trends can display short provisional FC and pH scenarios while the current
fill collects its own observations. No storage schema or product constants
change.

- **FC:** Transfer rates only from qualifying, non-reconstructed earlier-fill
  decay intervals. Prefer similar CYA bands; a mismatch widens the sensitivity
  range and reduces the historical weight when local evidence exists. No
  CYA-to-half-life multiplier is assumed. The curve needs a positive timed
  current-fill measurement, not a theoretical first-dose value. Existing
  activity and addition handling still applies.
- **pH:** Transfer a conservatively shrunk CO₂-loss rate, not the earlier
  fill's pH or buffer inventory. A numeric current-fill pH and supported
  carbonate/TA/CYA/borate context are required. The existing aeration windows
  act on the current fill's equilibrium. A single new clean numeric interval
  can adjust the provisional overall rate without attempting to identify
  separate idle and jet rates.
- As qualifying local intervals accumulate, they take over. A historical
  scenario extends at most 72 hours from its latest current-fill anchor and
  still obeys the existing chemistry limits. Shading is rate and measurement
  sensitivity, not a confidence interval; values may reach a model limit.
  Provisional forecasts are excluded from treatment guidance and from the
  frozen comparable-forecast score. Measurements and actual doses are never
  rewritten. TA and CH behavior is unchanged.

Run `npm test` and `npm run check:generated`. The focused
`tests/forecast-priors.test.cjs` covers anchor isolation, a different CYA
band, bounded pH, aeration, local refitting, expiry, and chart labeling.
