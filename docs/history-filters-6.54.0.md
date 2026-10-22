# History filters — 6.54.0

History has a compact Show selector: all activity, tests, chemical additions,
soaks, service, water events, and notes/other. Contextual subfilters provide:

- Tests: FC, pH (including bounded readings), TA, CH, CC, CYA, borates and
  acid-demand drops. A multi-parameter test stays a single, complete entry.
- Additions: chlorine, acid, baking soda, dichlor/CYA, borates, calcium and
  other/unidentified; optionally choose the exact saved product.
- Service: logged activity, including distinct custom activities, and stable
  filter-set IDs shown with their configured friendly names.
- Water: full refill, partial water change or top-off.

Filtering occurs before the display limit. Matching counts, a Clear filters
action and 100-entry Show more batches make the filtered view explicit. Only
loaded records are searched; the existing older-month loading control remains.
Device-local preferences use `j365_history_filters_v1`, not the private config.
Changing categories resets incompatible subfilters; changing addition type
resets the selected product. No matching records yields a clear empty-state
message instead of implying data has been lost.

Exact products use stable product IDs across revisions; recognized legacy names
share their built-in product ID. Chemical types prefer saved profile families;
unresolved snapshots are not guessed from the current mutable product library.
Older unprofiled records use their existing product descriptions for grouping.
Names/IDs are escaped and not inserted as executable markup.

Original/superseded record visibility is preserved. Removal markers can match
their underlying removed record so Restore remains usable under a category
filter. The Show originals control now invokes the final render pipeline,
preserving grouping and entry sheets as well as updating filter counts.

These are display filters only. Raw records, sync, exports, fill ownership,
forecasts, automatic calibration and training evidence still use the full data.
Regression tests cover zero/bounded tests, products, activities, pagination,
matches older than the first 100 records, preference reload, correction sheets,
removal/restore controls and unchanged records/model evidence.
