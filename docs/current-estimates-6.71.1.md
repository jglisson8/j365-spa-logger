# Current estimates and next steps — v6.71.1

The test/dose summary now has two correctly ordered headings:

1. Current estimates — FC, pH and TA values.
2. Next steps — the first action and its visible instruction, or the existing
   in-range/deferred message.

TA carried forward as the current value uses ≈, without “sample” or
“carried forward” text in the concentration line. This includes a recent TA
measurement being held as the current estimate. The underlying source remains
unchanged: action-context kinds, freshness rules, limits and calculations are
not modified. Inline sample/provenance suffixes are removed from the quick row;
recent FC/pH samples retain their values without ≈, and provenance is explained
under How guidance works. Each value and unit stays together when wrapping.
Exact readings remain exact in History and sample-only chart
fallbacks; unknown values still request a reading rather than invent a number.

The first actionable instruction is no longer moved into the collapsed
“Why & suggested sequence” details. Reasons and subsequent sequence details
remain available there. Existing safety notes, deferrals and all-clear rules
are unchanged. Small-screen concentration text is readable without treating it
as secondary explanatory text.

Regression checks cover heading order, recent/carried/modeled/unknown TA,
measurement-versus-estimate labels elsewhere, visible actions, deferrals,
54 chemistry combinations, navigation and unchanged records.

Display-only release: no Worker or private-data changes.
