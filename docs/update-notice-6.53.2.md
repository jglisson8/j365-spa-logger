# Discoverable update action — 6.53.2

The complete **Update available — update now** notice is now underlined,
tappable text rather than a separate notice and button. It appears both near
the top of the app and beside the version information under Service → App &
connection, only when an update is waiting. Native button semantics retain
keyboard activation and proper disabled behavior while visually reading as a
link. No fragment navigation or unsafe reload shortcut is introduced.

Both locations use the same guarded update handler, share busy/retry state and
preserve all draft, other-window and activation-race protections. Service brings
any resulting update instruction into view. Tests cover both locations,
hidden-when-current behavior, draft blocking, other-window blocking, double
activation prevention, keyboard activation, retained records and offline launch.
