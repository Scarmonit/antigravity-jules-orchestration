// Session Queue with Priority
export class SessionQueue {
  constructor(maxRetained = 100) {
    this.queue = [];
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
    this.queue.sort((a, b) => a.priority - b.priority);
    this._cleanup(); // Clean old completed/failed items
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
    if (item) item.status = 'processing';
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
    const cleared = this.queue.filter(i => i.status === 'pending').length;
    this.queue = this.queue.filter(i => i.status !== 'pending');
    return cleared;
  }

  // Optimized cleanup: remove old completed/failed items, keep only maxRetained
  _cleanup() {
    const terminal = this.queue.filter(i => i.status === 'completed' || i.status === 'failed');
    if (terminal.length > this.maxRetained) {
      // Sort by completion/failure time to keep most recent?
      // For now, assuming standard array order roughly correlates to time if added sequentially.
      // But status changes happen later.
      // Let's sort terminal items by completion time (if available) or failedAt.
      terminal.sort((a, b) => {
        const timeA = new Date(a.completedAt || a.failedAt).getTime();
        const timeB = new Date(b.completedAt || b.failedAt).getTime();
        return timeA - timeB; // Ascending time
      });

      const toRemove = terminal.slice(0, terminal.length - this.maxRetained);
      const toRemoveIds = new Set(toRemove.map(i => i.id));

      this.queue = this.queue.filter(item => !toRemoveIds.has(item.id));
    }
  }
}
