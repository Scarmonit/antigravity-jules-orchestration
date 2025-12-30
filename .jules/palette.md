# Palette's Journal

## 2024-05-22 - Metric Loading States
**Learning:** Users perceive data as "broken" if async metrics load without a specific loading state, even if the rest of the UI is responsive.
**Action:** Always wrap async metric displays in a container that handles `isLoading` explicitly, using skeleton loaders or simple spinners, and use `aria-live="polite"` for the region.
