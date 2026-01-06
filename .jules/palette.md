## 2024-05-22 - Connection Status Accessibility
**Learning:** Status indicators that rely solely on color and text without semantic roles are invisible to screen readers as status updates.
**Action:** Always add `role="status"` and `aria-live="polite"` to real-time connection indicators. Use `title` attributes to provide additional context for mouse users.
