# Local-only sign-in — 6.54.4

The compact main-screen status is now a native anchor. On the secure Worker origin, Local only links directly to `/auth/start` with a visible underline, keyboard focus ring and accessible GitHub sign-in label.

Other states still open Service → App & connection. On the public Pages origin, Local only continues to open connection settings rather than an invalid relative OAuth route. Link state follows async status changes.

Sign-in navigation from either this badge or the existing account-detail link is blocked while a test, dose or other tracked work is unsaved; the entry is retained. Saved records, authentication endpoints, model calculations and sync are unchanged.

Regression tests cover clean navigation, unsaved reading/dose protection, account-detail navigation, state changes, public-origin fallback and unchanged local records.
