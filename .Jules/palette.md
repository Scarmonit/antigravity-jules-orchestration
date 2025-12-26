## 2024-05-23 - Loading State Clarity
**Learning:** Users can misinterpret "empty" or "default" data values (like 0.0 or "Failover") as system errors if shown immediately before data loads.
**Action:** Always implement explicit loading states (skeletons or spinners) for async components to prevent "false alarm" panic. Even a simple text indicator is better than misleading data.
