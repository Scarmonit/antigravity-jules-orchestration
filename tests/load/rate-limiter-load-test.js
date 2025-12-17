#!/usr/bin/env node

/**
 * Rate Limiter Load Test Script
 *
 * Tests the rate limiter under various load conditions using native Node.js fetch.
 *
 * Usage: node tests/load/rate-limiter-load-test.js <target-url>
 * Example: node tests/load/rate-limiter-load-test.js http://localhost:3323
 *
 * @module rate-limiter-load-test
 */

// ANSI color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m'
};

/**
 * Colorize text with ANSI codes
 * @param {string} text - Text to colorize
 * @param {string} color - Color name from colors object
 * @returns {string} Colorized text
 */
const colorize = (text, color) => `${colors[color]}${text}${colors.reset}`;

/**
 * Print a styled header
 * @param {string} title - Header title
 */
const printHeader = (title) => {
  const line = '='.repeat(60);
  console.log('\n' + colorize(line, 'cyan'));
  console.log(colorize(`  ${title}`, 'bright'));
  console.log(colorize(line, 'cyan'));
};

/**
 * Print a sub-header
 * @param {string} title - Sub-header title
 */
const printSubHeader = (title) => {
  console.log('\n' + colorize(`--- ${title} ---`, 'yellow'));
};

/**
 * Statistics object for tracking test results
 * @typedef {Object} TestStats
 * @property {number} totalRequests - Total number of requests made
 * @property {number} successCount - Number of successful (200) responses
 * @property {number} rateLimitedCount - Number of rate limited (429) responses
 * @property {number} errorCount - Number of error responses
 * @property {number[]} responseTimes - Array of response times in ms
 * @property {Object[]} rateLimitHeaders - Array of rate limit header data
 */

/**
 * Create a fresh statistics object
 * @returns {TestStats} Empty statistics object
 */
const createStats = () => ({
  totalRequests: 0,
  successCount: 0,
  rateLimitedCount: 0,
  errorCount: 0,
  responseTimes: [],
  rateLimitHeaders: []
});

/**
 * Parse rate limit headers from a response
 * @param {Response} response - Fetch response object
 * @returns {Object} Parsed rate limit headers
 */
const parseRateLimitHeaders = (response) => {
  return {
    limit: response.headers.get('RateLimit-Limit') || response.headers.get('X-RateLimit-Limit'),
    remaining: response.headers.get('RateLimit-Remaining') || response.headers.get('X-RateLimit-Remaining'),
    reset: response.headers.get('RateLimit-Reset') || response.headers.get('X-RateLimit-Reset'),
    retryAfter: response.headers.get('Retry-After')
  };
};

/**
 * Make a single request to the target endpoint
 * @param {string} url - Target URL
 * @param {TestStats} stats - Statistics object to update
 * @returns {Promise<void>}
 */
const makeRequest = async (url, stats) => {
  const startTime = Date.now();

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    const responseTime = Date.now() - startTime;
    stats.responseTimes.push(responseTime);
    stats.totalRequests++;

    const rateLimitInfo = parseRateLimitHeaders(response);
    if (rateLimitInfo.limit || rateLimitInfo.remaining) {
      stats.rateLimitHeaders.push({
        status: response.status,
        ...rateLimitInfo,
        timestamp: new Date().toISOString()
      });
    }

    if (response.status === 200) {
      stats.successCount++;
    } else if (response.status === 429) {
      stats.rateLimitedCount++;
    } else {
      stats.errorCount++;
    }
  } catch (error) {
    const responseTime = Date.now() - startTime;
    stats.responseTimes.push(responseTime);
    stats.totalRequests++;
    stats.errorCount++;
  }
};

/**
 * Run requests with controlled concurrency
 * @param {string} url - Target URL
 * @param {number} totalRequests - Total number of requests to make
 * @param {number} durationMs - Duration to spread requests over (0 for instant)
 * @returns {Promise<TestStats>} Test statistics
 */
const runLoadTest = async (url, totalRequests, durationMs) => {
  const stats = createStats();
  const promises = [];

  if (durationMs === 0) {
    // Burst mode: all requests at once
    for (let i = 0; i < totalRequests; i++) {
      promises.push(makeRequest(url, stats));
    }
  } else {
    // Spread requests over duration
    const interval = durationMs / totalRequests;

    for (let i = 0; i < totalRequests; i++) {
      promises.push(
        new Promise((resolve) => {
          setTimeout(async () => {
            await makeRequest(url, stats);
            resolve();
          }, i * interval);
        })
      );
    }
  }

  await Promise.all(promises);
  return stats;
};

/**
 * Calculate and display statistics
 * @param {TestStats} stats - Test statistics
 * @param {string} testName - Name of the test
 */
const displayStats = (stats, testName) => {
  const avgResponseTime = stats.responseTimes.length > 0
    ? (stats.responseTimes.reduce((a, b) => a + b, 0) / stats.responseTimes.length).toFixed(2)
    : 0;

  const minResponseTime = stats.responseTimes.length > 0
    ? Math.min(...stats.responseTimes)
    : 0;

  const maxResponseTime = stats.responseTimes.length > 0
    ? Math.max(...stats.responseTimes)
    : 0;

  const rateLimitPercentage = stats.totalRequests > 0
    ? ((stats.rateLimitedCount / stats.totalRequests) * 100).toFixed(1)
    : 0;

  printSubHeader(`Results: ${testName}`);

  console.log(colorize('  Request Summary:', 'bright'));
  console.log(`    Total Requests:    ${colorize(stats.totalRequests.toString(), 'white')}`);
  console.log(`    Successful (200):  ${colorize(stats.successCount.toString(), 'green')}`);
  console.log(`    Rate Limited (429): ${colorize(stats.rateLimitedCount.toString(), 'yellow')}`);
  console.log(`    Errors:            ${colorize(stats.errorCount.toString(), 'red')}`);

  console.log(colorize('\n  Response Times:', 'bright'));
  console.log(`    Average:           ${colorize(avgResponseTime + ' ms', 'cyan')}`);
  console.log(`    Min:               ${colorize(minResponseTime + ' ms', 'cyan')}`);
  console.log(`    Max:               ${colorize(maxResponseTime + ' ms', 'cyan')}`);

  console.log(colorize('\n  Rate Limiting:', 'bright'));
  console.log(`    429 Percentage:    ${colorize(rateLimitPercentage + '%', rateLimitPercentage > 0 ? 'yellow' : 'green')}`);

  // Display sample of rate limit headers
  if (stats.rateLimitHeaders.length > 0) {
    console.log(colorize('\n  Sample RateLimit Headers:', 'bright'));
    const sampleHeaders = stats.rateLimitHeaders.slice(0, 3);
    sampleHeaders.forEach((header, index) => {
      console.log(colorize(`    [${index + 1}] Status: ${header.status}`, 'dim'));
      if (header.limit) console.log(`        RateLimit-Limit:     ${header.limit}`);
      if (header.remaining) console.log(`        RateLimit-Remaining: ${header.remaining}`);
      if (header.reset) console.log(`        RateLimit-Reset:     ${header.reset}`);
      if (header.retryAfter) console.log(`        Retry-After:         ${header.retryAfter}`);
    });
  }

  return {
    avgResponseTime: parseFloat(avgResponseTime),
    rateLimitPercentage: parseFloat(rateLimitPercentage)
  };
};

/**
 * Sleep for a specified duration
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Main test runner
 * @param {string} baseUrl - Base URL of the server
 * @returns {Promise<boolean>} True if all tests pass
 */
const runAllTests = async (baseUrl) => {
  const targetUrl = `${baseUrl}/mcp/tools`;
  let allTestsPassed = true;
  const testResults = [];

  printHeader('Rate Limiter Load Test');
  console.log(`\n  Target URL: ${colorize(targetUrl, 'cyan')}`);
  console.log(`  Started:    ${colorize(new Date().toISOString(), 'dim')}`);

  // Test 1: Under limit (50 requests in 10 seconds)
  printHeader('Test 1: Under Limit (50 requests / 10 seconds)');
  console.log(colorize('  Expected: All requests should succeed (200)', 'dim'));

  const test1Stats = await runLoadTest(targetUrl, 50, 10000);
  const test1Results = displayStats(test1Stats, 'Under Limit Test');

  const test1Pass = test1Stats.rateLimitedCount === 0;
  testResults.push({
    name: 'Under Limit Test',
    passed: test1Pass,
    message: test1Pass
      ? 'All requests succeeded as expected'
      : `Expected 0 rate limited responses, got ${test1Stats.rateLimitedCount}`
  });

  if (!test1Pass) allTestsPassed = false;

  console.log('\n  ' + (test1Pass
    ? colorize('PASS', 'bgGreen') + colorize(' All requests succeeded', 'green')
    : colorize('FAIL', 'bgRed') + colorize(` ${test1Stats.rateLimitedCount} requests were rate limited`, 'red')
  ));

  // Wait for rate limiter to reset
  console.log(colorize('\n  Waiting 15 seconds for rate limiter to reset...', 'dim'));
  await sleep(15000);

  // Test 2: Over limit (150 requests in 10 seconds)
  printHeader('Test 2: Over Limit (150 requests / 10 seconds)');
  console.log(colorize('  Expected: Some requests should be rate limited (429)', 'dim'));

  const test2Stats = await runLoadTest(targetUrl, 150, 10000);
  const test2Results = displayStats(test2Stats, 'Over Limit Test');

  const test2Pass = test2Stats.rateLimitedCount > 0;
  testResults.push({
    name: 'Over Limit Test',
    passed: test2Pass,
    message: test2Pass
      ? `${test2Stats.rateLimitedCount} requests were correctly rate limited`
      : 'Expected some rate limited responses, got none'
  });

  if (!test2Pass) allTestsPassed = false;

  console.log('\n  ' + (test2Pass
    ? colorize('PASS', 'bgGreen') + colorize(` ${test2Stats.rateLimitedCount} requests correctly rate limited`, 'green')
    : colorize('FAIL', 'bgRed') + colorize(' No requests were rate limited', 'red')
  ));

  // Wait for rate limiter to reset
  console.log(colorize('\n  Waiting 15 seconds for rate limiter to reset...', 'dim'));
  await sleep(15000);

  // Test 3: Burst test (20 requests instantly)
  printHeader('Test 3: Burst Test (20 requests instantly)');
  console.log(colorize('  Expected: Burst capacity should handle initial requests', 'dim'));

  const test3Stats = await runLoadTest(targetUrl, 20, 0);
  const test3Results = displayStats(test3Stats, 'Burst Test');

  // Burst test: we expect at least some requests to succeed (burst capacity)
  const test3Pass = test3Stats.successCount > 0;
  testResults.push({
    name: 'Burst Test',
    passed: test3Pass,
    message: test3Pass
      ? `${test3Stats.successCount} requests handled by burst capacity`
      : 'Burst capacity did not handle any requests'
  });

  if (!test3Pass) allTestsPassed = false;

  console.log('\n  ' + (test3Pass
    ? colorize('PASS', 'bgGreen') + colorize(` ${test3Stats.successCount} requests handled by burst capacity`, 'green')
    : colorize('FAIL', 'bgRed') + colorize(' Burst capacity failed', 'red')
  ));

  // Final Summary
  printHeader('Test Summary');

  testResults.forEach((result, index) => {
    const statusIcon = result.passed ? colorize('[PASS]', 'green') : colorize('[FAIL]', 'red');
    console.log(`  ${statusIcon} Test ${index + 1}: ${result.name}`);
    console.log(colorize(`         ${result.message}`, 'dim'));
  });

  const passedCount = testResults.filter(r => r.passed).length;
  const totalTests = testResults.length;

  console.log('\n' + colorize('='.repeat(60), 'cyan'));

  if (allTestsPassed) {
    console.log(colorize(`  ALL TESTS PASSED (${passedCount}/${totalTests})`, 'green'));
  } else {
    console.log(colorize(`  SOME TESTS FAILED (${passedCount}/${totalTests} passed)`, 'red'));
  }

  console.log(colorize('='.repeat(60), 'cyan'));
  console.log(`\n  Completed: ${colorize(new Date().toISOString(), 'dim')}\n`);

  return allTestsPassed;
};

/**
 * Parse command line arguments and run tests
 */
const main = async () => {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
${colorize('Rate Limiter Load Test', 'bright')}

${colorize('Usage:', 'yellow')}
  node rate-limiter-load-test.js <target-url>

${colorize('Arguments:', 'yellow')}
  target-url    Base URL of the server (e.g., http://localhost:3323)

${colorize('Examples:', 'yellow')}
  node tests/load/rate-limiter-load-test.js http://localhost:3323
  node tests/load/rate-limiter-load-test.js https://scarmonit.com

${colorize('Tests:', 'yellow')}
  1. Under Limit:  50 requests in 10 seconds  - expects all 200s
  2. Over Limit:   150 requests in 10 seconds - expects some 429s
  3. Burst Test:   20 requests instantly      - verifies burst capacity

${colorize('Exit Codes:', 'yellow')}
  0 - All tests passed
  1 - Some tests failed
  2 - Invalid arguments or connection error
`);
    process.exit(0);
  }

  const baseUrl = args[0].replace(/\/$/, ''); // Remove trailing slash

  // Validate URL
  try {
    new URL(baseUrl);
  } catch {
    console.error(colorize('Error: Invalid URL provided', 'red'));
    console.error(`  Received: ${baseUrl}`);
    process.exit(2);
  }

  // Check server connectivity
  console.log(colorize('\nChecking server connectivity...', 'dim'));

  try {
    const healthCheck = await fetch(`${baseUrl}/health`, {
      signal: AbortSignal.timeout(10000)
    });

    if (!healthCheck.ok) {
      console.error(colorize(`Warning: Health check returned ${healthCheck.status}`, 'yellow'));
    } else {
      console.log(colorize('Server is reachable', 'green'));
    }
  } catch (error) {
    console.error(colorize('Error: Cannot connect to server', 'red'));
    console.error(`  URL: ${baseUrl}`);
    console.error(`  Error: ${error.message}`);
    process.exit(2);
  }

  // Run all tests
  try {
    const allPassed = await runAllTests(baseUrl);
    process.exit(allPassed ? 0 : 1);
  } catch (error) {
    console.error(colorize('\nFatal error during tests:', 'red'));
    console.error(`  ${error.message}`);
    process.exit(2);
  }
};

// Run main function
main();
