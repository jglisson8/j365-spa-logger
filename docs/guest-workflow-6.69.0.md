# Guest next steps — v6.69.0

## Main workflow

Log → Check water → Save test automatically opens the next step:
a supported bleach/pH Down suggestion, no adjustment, or an explanation of the
missing information. Bleach remains first when both corrections are supported.

Use this amount stages a draft. An adult confirms the actual quantity and unit,
checks the confirmation, then taps Save dose. Test and dose are independent,
idempotent saves; a recommendation is never recorded as an addition.
After a dose, the existing mixing/retest instructions and 20-minute calculation
lock remain unchanged. An early retest is still saved as an actual measurement.

Missing readings can be added by correcting the same saved test. A correction
reopens its next step without manufacturing a second active test.
Technical calculation details are collapsed. Manual entry lives under
Other options → Enter a dose manually and also requires actual-dose confirmation.
Instructions name the current tabs and buttons; chemical handling is adult-only.

## Owner preview

Real saved history and products are used. Without an invitation, saved active
bleach/acid defaults are validated and paired with preview-only limits:
bleach 250 mL single / 500 mL daily, acid 100 mL single / 200 mL daily.
These are preview caps, not recommended amounts or real guest permissions.
Invalid/archived product data does not get invented. An invitation still uses
its own profiles and exact limits. Preview remains isolated in memory; owner
storage, GitHub records, invitations and real authorization are unchanged.

## Verification

Regression coverage includes default-preview dosing with no invitation,
isolated temporary saves, automatic bleach/acid/no-dose next steps, completion
of a missing parameter on the same test, confirmation, duplicate-submit guards,
mixing/retest guards, corrections, and unchanged chemical calculations.
Touch-browser checks cover portrait/landscape, guide navigation, staged doses,
and real-data preview with mocked authenticated reads and no live writes.

No Worker deployment is needed.
