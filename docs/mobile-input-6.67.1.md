# Mobile keyboard entry — v6.67.1

The existing fixed bottom navigation and chemistry Save bar consumed substantial
space above a software keyboard. Keyboard height changes also used the general
chart-resize handler, potentially recalculating charts while entering settings.

`src/mobile-input.js` now provides a keyboard-aware presentation layer:

- Detect a substantial viewport-height reduction while a writable text/number
  field is focused on a touch device. Use VisualViewport for iOS/overlay layouts
  and window resize as a fallback for Android-style layout resizing. Pinch zoom
  and focus alone are not treated as a keyboard.
- Temporarily hide the fixed navigation, Save bar and transient notices. Keep
  their existing page-space reservation so closing the keyboard does not force
  a scroll-position reset. Restore the controls on keyboard dismissal or Done.
- A compact Previous / Next / Done toolbar tracks the visible viewport. Next
  skips hidden, disabled, readonly and native date/time/select controls. It
  follows visible writable inputs in the current form/dialog/tab. Native picker
  controls are still selected by tapping them normally.
- Done only blurs the field. Enter/Next on mobile single-line inputs advances
  instead of implicitly submitting; multiline notes keep ordinary line breaks.
  No field values, units, drafts or saved records are converted/reset/submitted.
- Configure numeric/decimal and native return-key hints for new inputs,
  including dynamically added dose fields. Existing inputmode hints are kept.
  Touch inputs use at least 16px text without disabling user zoom.
- Scroll minimally only when the focused field is obscured; do not repeatedly
  center visible inputs. Dialog controls move into the modal top layer, with
  scrolling confined to the dialog while editing there.
- `src/app-ui.js` ignores keyboard-only height changes for chart redraws while
  retaining width/rotation handling and non-editing expanded-chart resizing.
- Generated bundle/offline version updated; Worker, chemistry equations,
  actual dose units, records and sync behaviour unchanged.

Verification:

- `tests/ui/mobile-input.cjs` covers overlay keyboard/pan, Android resize,
  no-VisualViewport fallback, rotation, keyboard Back dismissal, minimal scrolling,
  Previous/Next/Done, no implicit Save, multiline notes, dynamic dose inputs,
  readonly/select/zoom/desktop isolation, modal top-layer controls and unchanged
  amounts/history.
- A WebKit mobile-browser check with simulated VisualViewport shrink verifies
  the focused field and toolbar fit, navigation/Save restoration, functional
  Next/Done, modal editing and preserved drafts/records with no script errors.
- `npm test`: 52 regression commands; generated bundles, Worker compatibility
  and whitespace checks also verified before publication.

Headless browsers cannot open a real OS keyboard: resize/overlay behaviours were
simulated. The system controls the exact keyboard and return-key appearance.
Floating keyboards that do not resize any viewport cannot be reliably detected
by this fallback; ordinary input and explicit Save remain available.
