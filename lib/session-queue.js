import fs from 'fs';
import path from 'path';

/**
 * Persistent Session Queue with Priority
 * Optimized for O(1) lookup and efficient cleanup.
 */
export class SessionQueue {
  constructor(maxRetained = 100, persistenceFile = '.jules/session-queue.json') {
    this.queueMap = new Map(); // O(1) lookup: id -> item
    this.queueList = [];       // Ordered list for stats/sorting: item objects
    this.maxRetained = maxRetained;
    this.persistenceFile = persistenceFile;
    this.processing = false;

    // Load persisted state if available
    this._load();
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

    this.queueMap.set(id, item);
    this.queueList.push(item);
    this._sort();
    this._cleanup();
    this._persist();
    return item;
  }

  remove(id) {
    const item = this.queueMap.get(id);
    if (!item) return null;

    this.queueMap.delete(id);
    const idx = this.queueList.findIndex(i => i.id === id);
    if (idx !== -1) {
      this.queueList.splice(idx, 1);
    }
    this._persist();
    return item;
  }

  getNext() {
    return this.queueList.find(i => i.status === 'pending');
  }

  markProcessing(id) {
    const item = this.queueMap.get(id);
    if (item) {
      item.status = 'processing';
      this._persist();
    }
  }

  markComplete(id, sessionId) {
    const item = this.queueMap.get(id);
    if (item) {
      item.status = 'completed';
      item.sessionId = sessionId;
      item.completedAt = new Date().toISOString();
      this._cleanup();
      this._persist();
    }
  }

  markFailed(id, error) {
    const item = this.queueMap.get(id);
    if (item) {
      item.status = 'failed';
      item.error = error;
      item.failedAt = new Date().toISOString();
      this._cleanup();
      this._persist();
    }
  }

  list() {
    return this.queueList.map(i => ({
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
      total: this.queueList.length,
      pending: this.queueList.filter(i => i.status === 'pending').length,
      processing: this.queueList.filter(i => i.status === 'processing').length,
      completed: this.queueList.filter(i => i.status === 'completed').length,
      failed: this.queueList.filter(i => i.status === 'failed').length
    };
  }

  clear() {
    const pending = this.queueList.filter(i => i.status === 'pending');
    const clearedCount = pending.length;

    // Remove pending items
    for (const item of pending) {
      this.queueMap.delete(item.id);
    }
    this.queueList = this.queueList.filter(i => i.status !== 'pending');

    this._persist();
    return clearedCount;
  }

  _sort() {
    this.queueList.sort((a, b) => a.priority - b.priority);
  }

  _cleanup() {
    const terminal = this.queueList.filter(i => i.status === 'completed' || i.status === 'failed');
    if (terminal.length > this.maxRetained) {
      const toRemove = terminal.slice(0, terminal.length - this.maxRetained);
      toRemove.forEach(item => {
        this.queueMap.delete(item.id);
        const idx = this.queueList.indexOf(item);
        if (idx >= 0) this.queueList.splice(idx, 1);
      });
    }
  }

  _persist() {
    try {
      const dir = path.dirname(this.persistenceFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.persistenceFile, JSON.stringify(this.queueList, null, 2));
    } catch (err) {
      console.error('Failed to persist SessionQueue:', err.message);
    }
  }

  _load() {
    try {
      if (fs.existsSync(this.persistenceFile)) {
        const data = fs.readFileSync(this.persistenceFile, 'utf8');
        this.queueList = JSON.parse(data);

        // Rebuild Map
        this.queueMap.clear();
        for (const item of this.queueList) {
          this.queueMap.set(item.id, item);
        }

        // Reset processing items to pending on restart
        let recovered = 0;
        for (const item of this.queueList) {
          if (item.status === 'processing') {
            item.status = 'pending';
            recovered++;
          }
        }
        if (recovered > 0) {
            console.log(`[SessionQueue] Recovered ${recovered} interrupted tasks`);
            this._persist();
        }
      }
    } catch (err) {
      console.error('Failed to load SessionQueue:', err.message);
      // Fallback to empty
      this.queueList = [];
      this.queueMap.clear();
    }
  }
}

export default SessionQueue;
