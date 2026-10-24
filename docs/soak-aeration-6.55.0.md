# Aeration from Soak — 6.55.0

## Design review

Use the existing `maintenance / custom / Standalone jets` exposure schema, not a zero-bather `soak`. Existing Worker validation and pH gas-loss/learned exposure, FC jets-only exposure, evaporation, weather and fill-cycle handling therefore remain in use. No bather entry or delayed bather-demand term is introduced. No new pH coefficients or invented measured endpoint are added.

## Entry

- Soak → Bathers → **0 — Aeration only**. Positive-bather default remains 1.
- Showered beforehand is unchecked, disabled and dimmed; its previous value returns when switching back.
- Minutes is now a whole-number input (1–720) for arbitrary actual durations, default 15.
- Air controls open/closed remain selectable. Mixed/off/unknown are unavailable for this jets-only path to avoid inventing an unrecorded air schedule; normal soak choices are restored when switching back.
- Aeration date/time is explicitly the **end**, defaulting to now, matching the existing Service exposure form. The start is calculated from duration. The date/time panel opens automatically and its label changes to Aeration ended at; normal soak time semantics are unchanged.
- Save aeration uses the normal offline save, sync, weather, draft guard and reversible Undo pipeline. Date, notes, temperature and fill association are retained.
- Duration and air state can be corrected using the normal append-only history correction flow. Prior records are not overwritten.
- Jets / aeration appears as a blue J marker and conditional legend item when activity markers are enabled. History describes duration and air state; filter under Service → Standalone jets.

No historical session was added: the requested past session still needs the user's actual time and duration. Existing records and model coefficients are unchanged.

Regression tests cover zero/positive switching, shower restoration, duration/time validation, completed-session metadata, exact pH aeration air-hours, chart marker/key, Undo and append-only corrections, input preservation and regular soak compatibility. Real phone tests exercise the zero-bather save path as well as existing charts, navigation and drafts.
