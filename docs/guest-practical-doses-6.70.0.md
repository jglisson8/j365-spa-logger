# Practical guest doses — v6.70.0

Guest acid dosing no longer halves the conservative equilibrium demand or
imposes the blanket 1 ppm TA-consumption cap. It uses the strip's lower working
pH (8.1 for the 8.4 block), conservative current TA, current-fill usable CYA and
borate inventory, temperature, product purity/density, and the existing personal
acid-response correction (downward factors only). It does not invent Taylor
acid-demand drops from a strip result.

Zero-buffer alternatives no longer override an available fill inventory.
Missing/inconsistent inventory still blocks calculation. The TA floor of
40 ppm, fresh test and mixing guards, chlorine interference checks, product
information requirements and invitation single/daily caps are preserved.
An exact endpoint is not promised. No historical data or owner equations change.

## Practical measures

- Bleach: largest supported measure from ¼, ⅓, ½ US cup.
- Dry acid: whole US tablespoons, rounded down.
- Never round up to the minimum measure. Below it, explain that no practical
  measure is supported rather than invent a larger dose.
- The displayed fraction stages its actual numeric quantity and unit only when
  Use this amount is clicked. Replacing a typed amount or unit requires
  confirmation. Manual actual additions and corrections retain other units.
- Calculated doses remain drafts until actual addition is confirmed and saved.

Bleach comes first when both are indicated. Instructions explicitly require
separate additions, circulation with the cover open, mixing/retesting before
the next supported adjustment and a final test before soaking. The existing
20-minute minimum remains, not 15; follow a longer product-label interval.
No automatic repeat acid dosing or guarantee that one correction reaches target.

## Checks

Regression cases cover practical-measure boundaries, no upward rounding,
low TA, missing buffers/density, off-scale FC, invitation caps, immediate repeat
guards, saved quantities, corrections and unchanged originals. A TA/CYA/borate
matrix checks that supported practical acid doses lower modeled pH without
overshooting the target in the conservative scenario or breaching the TA floor.
These are consistency tests, not empirical validation of strip-derived endpoints.
Phone-browser tests cover bleach → confirmation/mixing → retest → acid, unit
staging, Instructions and portrait/landscape layout. No private writes are used.

No Worker deployment or permission changes are required.
