/**
 * GitHub Integration Module
 * Fetch issues, PRs, and repository information for Jules session context
 */

import https from 'https';

const GITHUB_API = 'api.github.com';

/**
 * Make authenticated GitHub API request
 * @param {string} path - API path (e.g., '/repos/owner/repo/issues/123')
 * @param {string|null} [token=null] - GitHub personal access token
 * @returns {Promise<Object|string>} Parsed JSON response or raw string
 * @throws {Error} If request fails or returns error status
 */
function githubRequest(path, token = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: GITHUB_API,
      port: 443,
      path: path,
      method: 'GET',
      headers: {
        'User-Agent': 'Jules-MCP-Server/1.5.0',
        'Accept': 'application/vnd.github.v3+json'
      }
    };

    if (token) {
      options.headers['Authorization'] = `token ${token}`;
    }

    const req = https.request(options, (response) => {
      let data = '';
      response.on('data', (chunk) => data += chunk);
      response.on('end', () => {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve(data);
          }
        } else {
          reject(new Error(`GitHub API error: ${response.statusCode} - ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

/**
 * Fetch a GitHub issue with full context including comments
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {number} issueNumber - Issue number
 * @param {string|null} [token=null] - GitHub token for authentication
 * @returns {Promise<Object>} Issue object with number, title, body, state, labels, author, url, comments
 * @throws {Error} If issue fetch fails
 */
export async function getIssue(owner, repo, issueNumber, token = null) {
  const issue = await githubRequest(`/repos/${owner}/${repo}/issues/${issueNumber}`, token);

  // Get issue comments for additional context
  let comments = [];
  try {
    comments = await githubRequest(`/repos/${owner}/${repo}/issues/${issueNumber}/comments`, token);
  } catch (e) {
    console.warn('[GitHub] Could not fetch comments:', e.message);
  }

  return {
    number: issue.number,
    title: issue.title,
    body: issue.body || '',
    state: issue.state,
    labels: issue.labels?.map((l) => l.name) || [],
    author: issue.user?.login,
    createdAt: issue.created_at,
    url: issue.html_url,
    comments: comments.map((c) => ({
      author: c.user?.login,
      body: c.body,
      createdAt: c.created_at
    }))
  };
}

/**
 * Fetch all open issues with a specific label
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} label - Label to filter by
 * @param {string|null} [token=null] - GitHub token for authentication
 * @returns {Promise<Array<Object>>} Array of issue objects
 * @throws {Error} If issue fetch fails
 */
export async function getIssuesByLabel(owner, repo, label, token = null) {
  const issues = await githubRequest(
    `/repos/${owner}/${repo}/issues?labels=${encodeURIComponent(label)}&state=open`,
    token
  );

  return issues.map((issue) => ({
    number: issue.number,
    title: issue.title,
    body: issue.body || '',
    labels: issue.labels?.map((l) => l.name) || [],
    author: issue.user?.login,
    url: issue.html_url
  }));
}

/**
 * Format issue context into a structured prompt for Jules
 * @param {Object} issue - Issue object from getIssue()
 * @param {number} issue.number - Issue number
 * @param {string} issue.title - Issue title
 * @param {string} issue.body - Issue description
 * @param {Array<string>} [issue.labels] - Issue labels
 * @param {Array<Object>} [issue.comments] - Issue comments
 * @returns {string} Formatted prompt string with issue context and instructions
 */
export function formatIssueForPrompt(issue) {
  let prompt = `Fix GitHub Issue #${issue.number}: ${issue.title}\n\n`;
  prompt += `## Issue Description\n${issue.body}\n\n`;

  if (issue.labels?.length > 0) {
    prompt += `## Labels\n${issue.labels.join(', ')}\n\n`;
  }

  if (issue.comments?.length > 0) {
    prompt += '## Discussion Context\n';
    issue.comments.slice(-3).forEach((c) => {
      prompt += `- @${c.author}: ${c.body.substring(0, 200)}${c.body.length > 200 ? '...' : ''}\n`;
    });
  }

  prompt += '\n## Instructions\n';
  prompt += '1. Analyze the issue and identify the root cause\n';
  prompt += '2. Implement a fix that addresses the problem\n';
  prompt += '3. Add appropriate tests to prevent regression\n';
  prompt += '4. Update any relevant documentation\n';

  return prompt;
}

/**
 * Get repository information from GitHub API
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string|null} [token=null] - GitHub token for authentication
 * @returns {Promise<Object>} Repository information object
 * @throws {Error} If repository fetch fails
 */
export async function getRepoInfo(owner, repo, token = null) {
  return await githubRequest(`/repos/${owner}/${repo}`, token);
}

export default {
  getIssue,
  getIssuesByLabel,
  formatIssueForPrompt,
  getRepoInfo
};
