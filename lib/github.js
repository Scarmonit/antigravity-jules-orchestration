/**
 * GitHub Integration Module
 * Fetch issues, PRs, and repository information for Jules session context
 */

import https from 'https';

const GITHUB_API = 'api.github.com';

const GITHUB_OWNER_PATTERN = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/;
const GITHUB_REPO_PATTERN = /^[a-zA-Z0-9._-]{1,100}$/;

/**
 * Make authenticated GitHub API request
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
      response.on('data', chunk => data += chunk);
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
 * Validate GitHub parameters
 */
export function validateGitHubParams(owner, repo, prNumber) {
  if (!owner || typeof owner !== 'string' || !GITHUB_OWNER_PATTERN.test(owner)) {
    throw new Error('Invalid GitHub owner: must be alphanumeric with hyphens, 1-39 chars');
  }
  if (!repo || typeof repo !== 'string' || !GITHUB_REPO_PATTERN.test(repo)) {
    throw new Error('Invalid GitHub repository: must be alphanumeric with dots/hyphens/underscores, 1-100 chars');
  }
  if (owner.includes('..') || repo.includes('..') || owner.includes('/') || repo.includes('/')) {
    throw new Error('Invalid parameters: path traversal not allowed');
  }
  if (prNumber !== undefined && (!Number.isInteger(prNumber) || prNumber < 1 || prNumber > 999999)) {
    throw new Error('Invalid PR number: must be integer between 1-999999');
  }
}

/**
 * Fetch a GitHub issue with full context
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
    labels: issue.labels?.map(l => l.name) || [],
    author: issue.user?.login,
    createdAt: issue.created_at,
    url: issue.html_url,
    comments: comments.map(c => ({
      author: c.user?.login,
      body: c.body,
      createdAt: c.created_at
    }))
  };
}

/**
 * Fetch all issues with a specific label
 */
export async function getIssuesByLabel(owner, repo, label, token = null) {
  const issues = await githubRequest(
    `/repos/${owner}/${repo}/issues?labels=${encodeURIComponent(label)}&state=open`,
    token
  );

  return issues.map(issue => ({
    number: issue.number,
    title: issue.title,
    body: issue.body || '',
    labels: issue.labels?.map(l => l.name) || [],
    author: issue.user?.login,
    url: issue.html_url
  }));
}

/**
 * Format issue context for Jules prompt
 */
export function formatIssueForPrompt(issue) {
  let prompt = `Fix GitHub Issue #${issue.number}: ${issue.title}\n\n`;
  prompt += `## Issue Description\n${issue.body}\n\n`;
  
  if (issue.labels?.length > 0) {
    prompt += `## Labels\n${issue.labels.join(', ')}\n\n`;
  }

  if (issue.comments?.length > 0) {
    prompt += `## Discussion Context\n`;
    issue.comments.slice(-3).forEach(c => {
      prompt += `- @${c.author}: ${c.body.substring(0, 200)}${c.body.length > 200 ? '...' : ''}\n`;
    });
  }

  prompt += `\n## Instructions\n`;
  prompt += `1. Analyze the issue and identify the root cause\n`;
  prompt += `2. Implement a fix that addresses the problem\n`;
  prompt += `3. Add appropriate tests to prevent regression\n`;
  prompt += `4. Update any relevant documentation\n`;

  return prompt;
}

/**
 * Get repository information
 */
export async function getRepoInfo(owner, repo, token = null) {
  return await githubRequest(`/repos/${owner}/${repo}`, token);
}

export default {
  getIssue,
  getIssuesByLabel,
  formatIssueForPrompt,
  getRepoInfo,
  validateGitHubParams
};
