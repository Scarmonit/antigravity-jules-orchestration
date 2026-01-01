/**
 * Task Scheduler
 * Runs periodic tasks
 */

export class Scheduler {
  constructor() {
    this.tasks = new Map();
    this.intervals = new Map();
  }

  /**
   * Schedule a task to run periodically
   * @param {string} name - Task name
   * @param {string} interval - Interval string (e.g. '1m', '1h') or ms number
   * @param {Function} callback - Task function
   */
  schedule(name, interval, callback) {
    if (this.tasks.has(name)) {
      throw new Error(`Task ${name} already scheduled`);
    }

    const ms = this.parseInterval(interval);
    this.tasks.set(name, { interval: ms, callback, lastRun: null });

    const timer = setInterval(async () => {
      try {
        console.log(`[Scheduler] Running task: ${name}`);
        await callback();
        const task = this.tasks.get(name);
        if (task) task.lastRun = new Date().toISOString();
      } catch (error) {
        console.error(`[Scheduler] Task ${name} failed:`, error.message);
      }
    }, ms);

    this.intervals.set(name, timer);
    console.log(`[Scheduler] Scheduled task: ${name} every ${ms}ms`);
  }

  /**
   * Stop a scheduled task
   * @param {string} name
   */
  stop(name) {
    const timer = this.intervals.get(name);
    if (timer) {
      clearInterval(timer);
      this.intervals.delete(name);
      this.tasks.delete(name);
      console.log(`[Scheduler] Stopped task: ${name}`);
      return true;
    }
    return false;
  }

  /**
   * Parse interval string to milliseconds
   */
  parseInterval(interval) {
    if (typeof interval === 'number') return interval;
    if (typeof interval !== 'string') throw new Error('Invalid interval format');

    const unit = interval.slice(-1);
    const value = parseInt(interval.slice(0, -1), 10);

    if (isNaN(value)) throw new Error('Invalid interval value');

    switch (unit) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      default: return value; // Assume ms if no unit
    }
  }

  /**
   * Get status of all tasks
   */
  getStatus() {
    return Array.from(this.tasks.entries()).map(([name, data]) => ({
      name,
      interval: data.interval,
      lastRun: data.lastRun
    }));
  }

  /**
   * Stop all tasks
   */
  stopAll() {
    for (const name of this.intervals.keys()) {
        this.stop(name);
    }
  }
}

export default new Scheduler();
