# Soak duration dropdown — v6.67.2

v6.67.3: owner and guest standard choices now stop at **120 minutes** (24 options
from 5 to 120). Historical corrections retain their original longer durations;
the change does not shorten old records or change exact-minute aeration entry.

Owner and guest soak entry now use a native duration dropdown in five-minute
increments, defaulting to 15 minutes. Existing owner (720 min) and guest (180 min)
limits are retained. The existing numeric value remains the canonical save input;
selection stages it and does not save a record or open a number pad.

Aeration-only mode retains exact-minute numeric entry. Historical corrections
with non-grid durations retain their exact value as a temporary “current” option;
no old durations are rounded or rewritten. Owner history correction fields are
unchanged. Models, event schema, Worker and sync are unchanged.

Regression coverage: owner and guest option ranges, five-minute increments,
default, selection-only staging, saved duration, 37-minute aeration and preserved
17-minute correction; existing soak/aeration and guest workflow regressions.
`npm test` runs 53 checks; generated bundles and Worker compatibility checked.
