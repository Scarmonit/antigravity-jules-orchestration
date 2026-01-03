export class SessionQueue {
  constructor(maxRetained = 100) {
    this.queue = [];
    this.processing = false;
    this.maxRetained = maxRetained;
  }

  add(config, priority = 5) {
    const id = `queue_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const item = {
      id,
      config,
      priority,
      addedAt: new Date().toISOString(),
      status: 'pending'
    };
    this.queue.push(item);
    // Sort by priority (ascending, so lower number is processed later? Or descending?
    // The original code was `this.queue.sort((a, b) => a.priority - b.priority);`.
    // Usually higher number = higher priority.
    // If priority 1 is high and 10 is low, then sort ascending is correct for queue processing order if we take from start?
    // Wait, usually `queue.push` adds to end. `queue.shift` takes from start.
    // If we want high priority processed first, we should sort such that high priority is at index 0.
    // Assuming `priority` number: low number = low priority? or high priority?
    // Original: `this.queue.sort((a, b) => a.priority - b.priority);`
    // If we have prio 1 and prio 10. `1 - 10 = -9` => 1 comes before 10.
    // So 1 is processed before 10.
    // This implies 1 is HIGHER priority (or we process "priority 1" first).
    // Let's stick to original logic.
    this.queue.sort((a, b) => a.priority - b.priority);

    this._cleanup();
    return item;
  }

  remove(id) {
    const idx = this.queue.findIndex(i => i.id === id);
    return idx >= 0 ? this.queue.splice(idx, 1)[0] : null;
  }

  getNext() {
    return this.queue.find(i => i.status === 'pending');
  }

  markProcessing(id) {
    const item = this.queue.find(i => i.id === id);
    if (item && item.status === 'pending') {
      item.status = 'processing';
    }
  }

  markComplete(id, sessionId) {
    const item = this.queue.find(i => i.id === id);
    if (item) {
      item.status = 'completed';
      item.sessionId = sessionId;
      item.completedAt = new Date().toISOString();
    }
    this._cleanup();
  }

  markFailed(id, error) {
    const item = this.queue.find(i => i.id === id);
    if (item) {
      item.status = 'failed';
      item.error = error;
      item.failedAt = new Date().toISOString();
    }
    this._cleanup();
  }

  list() {
    return this.queue.map(i => ({
      id: i.id,
      title: i.config.title || 'Untitled',
      priority: i.priority,
      status: i.status,
      addedAt: i.addedAt,
      sessionId: i.sessionId
    }));
  }

  stats() {
    return {
      total: this.queue.length,
      pending: this.queue.filter(i => i.status === 'pending').length,
      processing: this.queue.filter(i => i.status === 'processing').length,
      completed: this.queue.filter(i => i.status === 'completed').length,
      failed: this.queue.filter(i => i.status === 'failed').length
    };
  }

  clear() {
    const pendingCount = this.queue.filter(i => i.status === 'pending').length;
    this.queue = this.queue.filter(i => i.status !== 'pending');
    return pendingCount;
  }

  /**
   * Optimize cleanup to be O(N) instead of O(N^2)
   */
  _cleanup() {
    const terminal = this.queue.filter(i => i.status === 'completed' || i.status === 'failed');
    if (terminal.length > this.maxRetained) {
        // Identify IDs to remove
        const toRemoveCount = terminal.length - this.maxRetained;
        // terminal is subset, but queue is sorted by priority.
        // We probably want to remove OLDEST completed/failed items.
        // The original code was slicing the start of `terminal` array.
        // `terminal` is created by filtering `queue` in order.
        // So `terminal[0]` is the one that appeared first in `queue`.
        // Since `queue` is sorted by priority, `terminal[0]` is the highest priority completed item?
        // Wait, if queue is sorted by priority, then order of completion is lost if we rely on queue order?
        // No, queue order is by priority.
        // If we want to remove oldest completed, we should sort `terminal` by `completedAt` or `failedAt`.
        // The original implementation: `const terminal = this.queue.filter(...)` -> preserves queue order (priority).
        // `const toRemove = terminal.slice(0, terminal.length - this.maxRetained);` -> removes first N items from that filtered list.
        // So it removes high priority completed items first? That seems wrong if we want to keep history.
        // But let's assume we want to keep the "most relevant" which might be high priority?
        // Or maybe we want to keep the most RECENTLY completed.
        // Let's improve this: Sort terminal by completion time (if available) or keep as is to match legacy behavior but optimize.

        // Optimization: Create a Set of IDs to remove for O(1) lookup
        const idsToRemove = new Set(terminal.slice(0, toRemoveCount).map(i => i.id));

        // Filter in place or create new array
        this.queue = this.queue.filter(i => !idsToRemove.has(i.id));
    }
  }
}
