/**
 * GitHub Integration Module
 * Fetch issues, PRs, and repository information for Jules session context
 */

import { Octokit } from '@octokit/rest';
import logger from '../utils/logger.js';

let octokitInstance = null;

function getOctokit(token) {
  if (!token) {
    throw new Error('GITHUB_TOKEN is required');
  }
  if (!octokitInstance) {
    octokitInstance = new Octokit({
      auth: token,
      userAgent: 'Jules-MCP-Server/2.6.0'
    });
  }
  return octokitInstance;
}

/**
 * Fetch a GitHub issue with full context
 */
export async function getIssue(owner, repo, issueNumber, token = null) {
  const octokit = getOctokit(token);
  
  try {
    const { data: issue } = await octokit.issues.get({
      owner,
      repo,
      issue_number: issueNumber
    });

    // Get issue comments for additional context
    let comments = [];
    try {
      const { data: commentsData } = await octokit.issues.listComments({
        owner,
        repo,
        issue_number: issueNumber,
        per_page: 10 // Limit to last 10 comments
      });
      comments = commentsData;
    } catch (e) {
      logger.warn('[GitHub] Could not fetch comments:', { error: e.message });
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
  } catch (error) {
     logger.error(`[GitHub] Failed to fetch issue ${owner}/${repo}#${issueNumber}:`, { error: error.message });
     throw error;
  }
}

/**
 * Fetch all issues with a specific label
 */
export async function getIssuesByLabel(owner, repo, label, token = null) {
  const octokit = getOctokit(token);

  try {
    const { data: issues } = await octokit.issues.listForRepo({
      owner,
      repo,
      labels: label,
      state: 'open'
    });

    return issues.map(issue => ({
      number: issue.number,
      title: issue.title,
      body: issue.body || '',
      labels: issue.labels?.map(l => l.name) || [],
      author: issue.user?.login,
      url: issue.html_url
    }));
  } catch (error) {
    logger.error(`[GitHub] Failed to fetch issues for ${owner}/${repo} label ${label}:`, { error: error.message });
    throw error;
  }
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
    const octokit = getOctokit(token);
    try {
        const { data } = await octokit.repos.get({ owner, repo });
        return data;
    } catch (error) {
        logger.error(`[GitHub] Failed to fetch repo info ${owner}/${repo}:`, { error: error.message });
        throw error;
    }
}

/**
 * Merge a PR
 */
export async function mergePr(owner, repo, prNumber, mergeMethod = 'squash', token = null) {
    const octokit = getOctokit(token);
    try {
        const { data } = await octokit.pulls.merge({
            owner,
            repo,
            pull_number: prNumber,
            merge_method: mergeMethod
        });
        return { success: true, merged: data.merged, prNumber };
    } catch (error) {
        logger.error(`[GitHub] Failed to merge PR ${owner}/${repo}#${prNumber}:`, { error: error.message });
        throw error;
    }
}

/**
 * Add a comment to a PR/Issue
 */
export async function addPrComment(owner, repo, prNumber, comment, token = null) {
    const octokit = getOctokit(token);
    try {
        const { data } = await octokit.issues.createComment({
            owner,
            repo,
            issue_number: prNumber,
            body: comment
        });
        return { success: true, commentId: data.id, prNumber };
    } catch (error) {
         logger.error(`[GitHub] Failed to add comment to ${owner}/${repo}#${prNumber}:`, { error: error.message });
         throw error;
    }
}

export default {
  getIssue,
  getIssuesByLabel,
  formatIssueForPrompt,
  getRepoInfo,
  mergePr,
  addPrComment
};
