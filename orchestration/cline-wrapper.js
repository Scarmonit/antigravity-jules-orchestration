/**
 * @fileoverview Cline CLI Wrapper Module for Jules Orchestration
 * @description Multi-instance Cline CLI management with HTTP/STDIO transport
 * @version 1.0.0
 */

import { spawn } from 'child_process';
import EventEmitter from 'events';

/**
 * Configuration for Cline CLI instances
 * @typedef {Object} ClineConfig
 * @property {string} cliPath - Path to Cline CLI executable
 * @property {number} maxInstances - Maximum concurrent instances
 * @property {string} transport - Transport type ('http' | 'stdio')
 * @property {number} httpPort - HTTP port for transport
 * @property {number} healthCheckInterval - Health check interval in ms
 * @property {boolean} autoRecovery - Enable automatic recovery
 */

class ClineWrapper extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = {
      cliPath: process.env.CLINE_CLI_PATH || '/usr/local/bin/cline',
      maxInstances: parseInt(process.env.CLINE_MAX_INSTANCES) || 5,
      transport: process.env.CLINE_TRANSPORT || 'http',
      httpPort: parseInt(process.env.CLINE_HTTP_PORT) || 3324,
      healthCheckInterval: parseInt(process.env.CLINE_HEALTH_CHECK_INTERVAL) || 30000,
      autoRecovery: process.env.CLINE_AUTO_RECOVERY === 'true',
      ...config
    };

    this.instances = new Map();
    this.taskQueue = [];
    this.healthCheckTimer = null;
    this.startHealthMonitoring();
  }

  /**
   * Create a new Cline task instance
   * @param {Object} taskConfig - Task configuration
   * @returns {Promise<Object>} Task result with instance ID
   */
  async createTask(taskConfig) {
    try {
      const instanceId = this.generateInstanceId();

      if (this.instances.size >= this.config.maxInstances) {
        this.emit('queue', { instanceId, reason: 'max_instances_reached' });
        return { status: 'queued', instanceId, message: 'Task queued: max instances reached' };
      }

      const instance = await this.spawnInstance(instanceId, taskConfig);
      this.instances.set(instanceId, instance);

      this.emit('task_created', { instanceId, taskConfig });
      return { status: 'running', instanceId, instance };
    } catch (error) {
      this.emit('error', { error, context: 'createTask' });
      throw error;
    }
  }

  /**
   * Spawn a new Cline CLI instance
   * @private
   */
  async spawnInstance(instanceId, taskConfig) {
    const instance = {
      id: instanceId,
      process: null,
      status: 'initializing',
      startTime: Date.now(),
      lastHeartbeat: Date.now(),
      errorCount: 0,
      output: [],
      config: taskConfig
    };

    if (this.config.transport === 'http') {
      instance.process = spawn(this.config.cliPath, [
        '--port', this.config.httpPort + this.instances.size,
        '--mode', 'http'
      ]);
    } else {
      instance.process = spawn(this.config.cliPath, [
        '--mode', 'stdio',
        '--task', JSON.stringify(taskConfig)
      ]);
    }

    instance.process.stdout.on('data', (data) => {
      instance.output.push(data.toString());
      instance.lastHeartbeat = Date.now();
      this.emit('output', { instanceId, data: data.toString() });
    });

    instance.process.stderr.on('data', (data) => {
      instance.errorCount++;
      this.emit('error_output', { instanceId, data: data.toString() });
    });

    instance.process.on('exit', (code) => {
      instance.status = code === 0 ? 'completed' : 'failed';
      this.emit('instance_exit', { instanceId, code });
      this.instances.delete(instanceId);
    });

    instance.status = 'running';
    return instance;
  }

  /**
   * Monitor task execution status
   * @param {string} taskId - Task instance ID
   * @returns {Promise<Object>} Task status
   */
  async monitorTask(taskId) {
    const instance = this.instances.get(taskId);

    if (!instance) {
      return { status: 'not_found', taskId };
    }

    return {
      status: instance.status,
      taskId,
      startTime: instance.startTime,
      runtime: Date.now() - instance.startTime,
      errorCount: instance.errorCount,
      lastHeartbeat: instance.lastHeartbeat,
      output: instance.output.slice(-10) // Last 10 lines
    };
  }

  /**
   * List all active instances
   * @returns {Array<Object>} List of instance summaries
   */
  listInstances() {
    return Array.from(this.instances.values()).map((instance) => ({
      id: instance.id,
      status: instance.status,
      startTime: instance.startTime,
      runtime: Date.now() - instance.startTime,
      errorCount: instance.errorCount,
      healthy: this.isInstanceHealthy(instance)
    }));
  }

  /**
   * Kill a specific instance
   * @param {string} instanceId - Instance ID to terminate
   * @returns {Promise<boolean>} Success status
   */
  async killInstance(instanceId) {
    const instance = this.instances.get(instanceId);

    if (!instance) {
      return false;
    }

    try {
      instance.process.kill('SIGTERM');

      // Force kill after 5 seconds
      setTimeout(() => {
        if (this.instances.has(instanceId)) {
          instance.process.kill('SIGKILL');
        }
      }, 5000);

      this.emit('instance_killed', { instanceId });
      return true;
    } catch (error) {
      this.emit('error', { error, context: 'killInstance', instanceId });
      return false;
    }
  }

  /**
   * Check if instance is healthy
   * @private
   */
  isInstanceHealthy(instance) {
    const now = Date.now();
    const heartbeatTimeout = 60000; // 60 seconds
    const maxErrors = 5;

    return (
      instance.status === 'running' &&
      (now - instance.lastHeartbeat) < heartbeatTimeout &&
      instance.errorCount < maxErrors
    );
  }

  /**
   * Start health monitoring for all instances
   * @private
   */
  startHealthMonitoring() {
    this.healthCheckTimer = setInterval(() => {
      for (const [instanceId, instance] of this.instances) {
        if (!this.isInstanceHealthy(instance)) {
          this.emit('health_check_failed', { instanceId, instance });

          if (this.config.autoRecovery) {
            this.recoverInstance(instanceId, instance);
          }
        }
      }
    }, this.config.healthCheckInterval);
  }

  /**
   * Recover unhealthy instance
   * @private
   */
  async recoverInstance(instanceId, instance) {
    try {
      await this.killInstance(instanceId);

      // Recreate with original config
      if (instance.config) {
        await this.createTask(instance.config);
        this.emit('instance_recovered', { instanceId });
      }
    } catch (error) {
      this.emit('recovery_failed', { instanceId, error });
    }
  }

  /**
   * Generate unique instance ID
   * @private
   */
  generateInstanceId() {
    return `cline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Shutdown all instances
   */
  async shutdown() {
    clearInterval(this.healthCheckTimer);

    const killPromises = [];
    for (const instanceId of this.instances.keys()) {
      killPromises.push(this.killInstance(instanceId));
    }

    await Promise.all(killPromises);
    this.emit('shutdown_complete');
  }
}

export default ClineWrapper;
