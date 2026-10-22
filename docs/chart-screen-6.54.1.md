# Expanded chart layout — 6.54.1

Presentation-only update. No model, measurement, chemical quantity or synchronization changes.

- Remove the repeated Expand chart button and duplicate headline value from the expanded screen.
- Release old inline padding/overflow so the safe-area-aware app layout controls the dialog.
- On short landscape screens, place the toolbar and horizontally scrollable time/scale controls in one row.
- Keep a fixed-height touch inspection readout and the bottom legend visible.
- Move the verbose target/context summary into Custom / info, retaining chart target lines, legend editing and important warning messages.
- Reduce expanded SVG axis padding while retaining readable time labels and the pH glyph gutters. Main-card geometry is unchanged.
- Use a short Full screen label with an accessible Full screen / landscape name.

Browser regression checks cover FC/pH/TA/CH across 852×393, 740×360, 667×320, tablet 1024×768 and portrait 393×852. Assert actual plot height, legend visibility, no dialog overflow, hidden duplicate expansion control, details access, real fullscreen entry/exit, touch inspection, pinch zoom and unchanged records.

Synthetic phone reference: expanded SVG height rises from 178 to 256 px in landscape and from 569 to 626 px in portrait. The actual data area also benefits from smaller expanded-only axis margins.
