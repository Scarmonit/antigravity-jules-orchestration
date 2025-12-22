## 2024-05-22 - RAG Optimization
**Learning:** Moving synchronous query processing (splitting, lowercasing) out of tight loops in RAG search yields 10x+ performance improvement (O(N*M) -> O(N)).
**Action:** Always preprocess invariant data before entering loops, especially for text processing.
