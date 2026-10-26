# Guided guest Test & dose — v6.66.0

- Log has two primary activities: Test & dose and Soak. A smaller "Log a dose
  already added" action preserves straightforward actual-addition recording.
- "Save test & check doses" saves only the test, refreshes synced context, then
  automatically displays its saved strip results and next step on the same screen.
- When both parameters need work, bleach is offered first. Acid does not appear
  as a second immediately actionable amount; mix and log a fresh test first.
  A blocked bleach calculation is not bypassed by automatically suggesting acid.
- "Use this amount" fills a draft only. The guest can edit actual amount/unit,
  confirm it was added, then "Save actual dose". There is no automatic dose save.
- After saving an actual addition, return to blank retest fields with mixing
  guidance and "Save retest & check doses". Early tests are retained, but existing
  mixing/freshness guards prevent another calculated dose before the waiting time.
- No-dose and unavailable results remain explicit and cannot create empty dose
  records. Manual actual-addition recording does not show a new recommendation.
- Correcting tests does not automatically start a new dosing workflow. Correcting
  doses does not issue another mixing/addition instruction. Existing idempotent
  retries, private sync, draft quantities/units, timestamps and confirmation remain.
- If refreshed context changes a calculation while an actual amount is entered,
  preserve it and allow recording only the actual confirmed addition. Never replace
  an entered number or force a duplicate test to record that dose.
- Instructions name current actions. Guest pH/FC goals, equations, invitation caps,
  permissions, historical chemistry and Worker version are unchanged.

Regression coverage includes two-save behavior, no phantom/double additions,
bleach-first curation, a too-early retest, manual records and corrections. Mobile
touch checks cover the combined path, post-mixing acid step, portrait/landscape
navigation and isolated practice storage.
