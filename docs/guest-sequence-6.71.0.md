# Guided guest doses — v6.71.0

When one saved test supports both practical doses:

1. Show bleach only; confirm the actual addition and Save dose.
2. Stay on the mixing screen. Display the remaining 20-minute wait with the
   cover open and Jets 1 and 2 running; follow a longer label interval.
3. Refresh the saved context at expiry, then show pH Down automatically.
   No intervening chemistry test or product selection is required.
4. Confirm/save the actual acid addition, mix again and log a final test before
   soaking. A timer is not proof of safe water.

## Boundaries

The narrowly scoped sequence reuses the original test; it does not invent a
post-bleach pH/FC measurement or globally relax the fresh-test guards.
Both original practical calculations must be supported. The saved bleach's
formulation, actual quantity and units are checked; an estimated upper FC above
10 ppm blocks the continuation. Original single/daily product limits apply.

The source test must precede bleach by no more than 30 minutes, and the combined
workflow expires two hours after the source test. Further tests, soaks, doses,
top-offs, water changes, service, exposure or buffer-baseline updates invalidate
the queue. Unknown-time activity on that day cannot be silently ignored.
After an acid entry, the sequence cannot automatically repeat acid.

Reconnection reconstructs the remaining wait from synced events, not a new
20-minute timer. The app must refresh successfully at/after the deadline before
offering acid. Failed refresh hides dosing and shows Reconnect with a reminder
that bleach is already saved. Preview entries still never sync or persist.
Timer ticks change the countdown only; they do not rebuild charts or models.
No Worker, permission, historical-data or general owner-model changes.

## Usability

- One actionable product at a time, with matching instructions.
- No duplicate wait/dose boxes or test-again button in the normal dose path.
- Proposed amounts/units are prefilled; actual edits are under “change.”
- Clearing an amount while editing keeps the field open; actual confirmation
  and validation remain required.
- Leaving an unsaved dose asks for confirmation.
- Preview details are collapsed, with the no-real-dosing warning still visible.
- Free chlorine is spelled out; optional/history/connection paths stay secondary.

## Verification

Regression coverage includes exact timer boundaries, original-test reuse,
no automatic records, double taps, reconnect/resume, interrupted refresh,
stale/changed data, product/FC/cap guards, actual edits and final-test routing.
Phone-browser checks cover the complete bleach → wait → acid path, guide,
owner preview and portrait/landscape. Tests use isolated fixtures, not private
record mutations.
