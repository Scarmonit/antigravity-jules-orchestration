## 2024-05-23 - Dynamic Metrics Accessibility
**Learning:** Dynamic dashboards often lack loading states and semantic announcements, confusing screen reader users.
**Action:** Always wrap dynamic metrics in `aria-live="polite"` regions and provide skeleton loading states.
