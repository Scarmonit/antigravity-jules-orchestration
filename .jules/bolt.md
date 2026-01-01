## 2024-05-22 - Initial Setup
**Learning:** Initialized Bolt's journal.
**Action:** Always check for this file before starting work.

## 2025-01-01 - Batch Processing Optimization
**Learning:** Chunk-based parallelism (`Promise.all` on slices) is inefficient when task durations vary significantly, as fast tasks wait for slow ones in the same chunk.
**Action:** Implemented a sliding window (worker pool) pattern in `lib/batch.js` to maximize concurrency. Maintained output order by indexing results into a pre-allocated array.
