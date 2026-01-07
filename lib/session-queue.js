/**
 * Session Queue with Priority
 * Manages pending sessions with priority-based processing
 */
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

  // Fix memory leak: remove old completed/failed items, keep only maxRetained
  _cleanup() {
    const terminal = this.queue.filter(i => i.status === 'completed' || i.status === 'failed');
    if (terminal.length > this.maxRetained) {
      const toRemove = terminal.slice(0, terminal.length - this.maxRetained);
      toRemove.forEach(item => {
        const idx = this.queue.indexOf(item);
        if (idx >= 0) this.queue.splice(idx, 1);
      });
    }
  }
}

export default SessionQueue;
