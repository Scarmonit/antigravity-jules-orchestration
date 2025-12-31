## 2024-05-23 - Accessibility in Conditional Rendering
**Learning:** React's conditional rendering often leads to missing semantic structure for tab interfaces, as developers focus on the visual toggle rather than the semantic relationship.
**Action:** When implementing tabs, always ensure `role="tablist"`, `role="tab"`, and `role="tabpanel"` are present, even if panels are conditionally rendered.
