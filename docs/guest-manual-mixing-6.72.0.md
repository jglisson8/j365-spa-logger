# Manual mixing and concise guest instructions — v6.72.0

The guest bleach → acid flow no longer has a countdown, periodic timer refresh,
20-minute unlock or hard-coded minimum elapsed time. It shows circulation
instructions and “Mixing finished—continue to pH Down.”

Continue refreshes the saved context and rechecks the supported acid correction.
It neither records a dose nor fabricates a new measurement. Actual dose
confirmation and Save remain separate. Double taps are guarded. A failed
refresh keeps dosing unavailable and offers Reconnect.

The mixing confirmation is scoped to the saved bleach event. Refreshing a real
guest page restores the saved sequence and asks for mixing confirmation again,
without restarting any wait. Preview still discards temporary rehearsal entries.
Source-test freshness, sequence expiry, intervening-activity, product identity,
FC, TA and single/daily quantity guards remain.

General guest calculators now require a chronologically subsequent post-dose
test rather than imposing a 20-minute minimum on a real reading. An old or
same-time pre-dose sample still cannot justify repeated additions.

No particular short interval is certified as sufficient mixing. Instructions
retain one-product-at-a-time handling, both jets, open cover, label precautions,
and final testing before soaking. No zero-chloramine shortcut is introduced.

## Instruction review

- One concise guide uses the actual Log / Check water / Save test / Save dose
  controls. Removed legacy Dose-tab and hidden-shortcut references.
- Removed repeated endpoint, buffer-bound and invented-Taylor-drop explanations
  from the user guide; calculation details remain available on dose cards.
- Removed hard-coded 20-minute claims and duplicated workflow copy.
- Kept useful save-failure, actual-amount, mistake-correction, Trends and
  chemical-handling information.
- Hide “From the owner” when no owner instructions are saved.

Chemical equations, limits, recorded quantities and history are unchanged.
No Worker deployment is needed.
