/**
 * Test Setup for Integration Tests
 *
 * This file provides utilities to start/stop the test server
 * for integration testing.
 */

import { spawn } from 'child_process';
import axios from 'axios';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3323';
const SERVER_STARTUP_TIMEOUT = 15000;

let serverProcess = null;

/**
 * Wait for server to be ready by polling the health endpoint
 */
async function waitForServer(timeout = SERVER_STARTUP_TIMEOUT) {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      const response = await axios.get(`${BASE_URL}/health`, {
        timeout: 2000,
        validateStatus: () => true
      });

      if (response.status === 200 || response.status === 503) {
        console.log('✓ Test server is ready');
        return true;
      }
    } catch (error) {
      // Server not ready yet, wait and retry
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  throw new Error(`Server did not start within ${timeout}ms`);
}

/**
 * Start the test server
 */
export async function startTestServer() {
  // Check if server is already running
  try {
    const response = await axios.get(`${BASE_URL}/health`, {
      timeout: 1000,
      validateStatus: () => true
    });

    if (response.status === 200 || response.status === 503) {
      console.log('✓ Test server already running');
      return null;
    }
  } catch (error) {
    // Server not running, we need to start it
  }

  console.log('Starting test server...');

  // Start server in background
  serverProcess = spawn('node', ['index.js'], {
    env: {
      ...process.env,
      PORT: '3323',
      NODE_ENV: 'test'
    },
    stdio: 'ignore', // Suppress server logs during tests
    detached: false
  });

  serverProcess.on('error', (err) => {
    console.error('Failed to start server:', err);
  });

  // Wait for server to be ready
  await waitForServer();

  return serverProcess;
}

/**
 * Stop the test server
 */
export async function stopTestServer() {
  if (serverProcess) {
    console.log('Stopping test server...');
    serverProcess.kill('SIGTERM');

    // Wait for graceful shutdown
    await new Promise((resolve) => setTimeout(resolve, 2000));

    serverProcess = null;
  }
}

/**
 * Global setup function for vitest
 */
export async function setup() {
  await startTestServer();
}

/**
 * Global teardown function for vitest
 */
export async function teardown() {
  await stopTestServer();
}
