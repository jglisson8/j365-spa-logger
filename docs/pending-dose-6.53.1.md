# Pending calculated-dose protection — 6.53.1

Previously, a user could type an actual amount in calculated-dose confirmation
and tap the main Save button before Add to draft. The main handler only read
staged `.dose-row` elements, saved the measurement and then cleared calculator
inputs. The actual dose disappeared without being recorded.

The final form handler now refuses Save while a calculated dose is awaiting
confirmation, clearly asks for Add to draft or Cancel, and leaves all readings,
amounts, units and times intact. It never silently records a recommendation as
an actual chemical addition. The visible draft summary includes the pending
confirmation. After confirmation, the existing single-save pipeline records the
test and actual dose together; Cancel explicitly permits a measurement-only save.

Calculator refreshes preserve the pending confirmation DOM and its values and
handler. Attempting another calculation cannot replace it or apply remembered
unit conversion to the existing numeric entry. Original suggested quantities
remain separate from the actual addition.

`tests/ui/pending-dose.cjs` covers the reported .333-cup bleach case, repeated
Save without changes, refresh/replacement, exact-once confirm/save, cancellation,
acid and baking soda, and existing staged rows. No historical data or chemical
equations were changed.
