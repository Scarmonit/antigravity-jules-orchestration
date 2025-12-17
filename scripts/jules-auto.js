#!/usr/bin/env node

// Auto-diagnostics guard
import { execSync } from 'child_process';
import https from 'https';
import { fileURLToPath } from 'url';

if (!process.env.AUTO_DIAG) {
  process.env.AUTO_DIAG = '1';
  try {
    execSync('powershell -File scripts/quick-check.ps1', { stdio: 'inherit' });
  } catch {
    process.exit(1);
  }
}

/**
 * Jules API Automation Wrapper
 * Autonomous session manager for hands-free development workflows
 */

// Base URL for Jules API (for reference)
const _JULES_API_BASE = 'https://jules.googleapis.com/v1alpha';
const API_KEY = process.env.JULES_API_KEY;

if (!API_KEY) {
  console.error('❌ JULES_API_KEY environment variable is required');
  process.exit(1);
}

/**
 * Create a new Jules coding session
 */
async function createSession(config = {}) {
  const sessionData = {
    repository: config.repository || process.env.GITHUB_REPOSITORY,
    task: config.task || 'Autonomous development workflow',
    autoApprove: config.autoApprove || false,
    branch: config.branch || 'main'
  };

  console.log('🚀 Creating Jules session...');
  console.log(`📦 Repository: ${sessionData.repository}`);
  console.log(`🎯 Task: ${sessionData.task}`);

  return new Promise((resolve, reject) => {
    const data = JSON.stringify(sessionData);

    const options = {
      hostname: 'jules.googleapis.com',
      port: 443,
      path: '/v1alpha/sessions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
        'Authorization': `Bearer ${API_KEY}`
      }
    };

    const req = https.request(options, (res) => {
      let body = '';

      res.on('data', (chunk) => {
        body += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 201) {
          try {
            const result = JSON.parse(body);
            console.log('✅ Session created successfully');
            console.log(`📋 Session ID: ${result.sessionId || result.id}`);
            resolve(result);
          } catch (e) {
            reject(new Error(`Failed to parse response: ${e.message}`));
          }
        } else {
          reject(new Error(`API request failed: ${res.statusCode} - ${body}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Request error: ${error.message}`));
    });

    req.write(data);
    req.end();
  });
}

/**
 * List active sessions
 */
async function listSessions() {
  console.log('📋 Fetching active sessions...');

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'jules.googleapis.com',
      port: 443,
      path: '/v1alpha/sessions',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${API_KEY}`
      }
    };

    const req = https.request(options, (res) => {
      let body = '';

      res.on('data', (chunk) => {
        body += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const result = JSON.parse(body);
            console.log(`✅ Found ${result.sessions?.length || 0} active sessions`);
            resolve(result);
          } catch (e) {
            reject(new Error(`Failed to parse response: ${e.message}`));
          }
        } else {
          reject(new Error(`API request failed: ${res.statusCode} - ${body}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Request error: ${error.message}`));
    });

    req.end();
  });
}

// CLI Interface
const command = process.argv[2];
const args = process.argv.slice(3);

async function main() {
  try {
    switch (command) {
      case 'create':
        const config = {
          repository: args[0] || process.env.GITHUB_REPOSITORY,
          task: args[1] || 'Autonomous workflow',
          autoApprove: args.includes('--auto-approve')
        };
        const session = await createSession(config);
        console.log(JSON.stringify(session, null, 2));
        break;

      case 'list':
        const sessions = await listSessions();
        console.log(JSON.stringify(sessions, null, 2));
        break;

      default:
        console.log(`
Jules API Automation Wrapper

Usage:
  node scripts/jules-auto.js create [repository] [task] [--auto-approve]
  node scripts/jules-auto.js list

Examples:
  node scripts/jules-auto.js create Scarmonit/repo "Fix bug in API"
  node scripts/jules-auto.js list
        `);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Check if file is being run directly (ES module equivalent of require.main === module)
const isMainModule = import.meta.url === `file://${process.argv[1]}` ||
                     fileURLToPath(import.meta.url) === process.argv[1];

if (isMainModule) {
  main();
}

export { createSession, listSessions };
