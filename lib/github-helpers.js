/**
 * GitHub Integration Helper
 *
 * Provides helper functions for GitHub API interactions
 */

import { getIssue, getIssuesByLabel, formatIssueForPrompt } from './github.js';

const VALID_MERGE_METHODS = ['merge', 'squash', 'rebase'];
const GITHUB_OWNER_PATTERN = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/;
const GITHUB_REPO_PATTERN = /^[a-zA-Z0-9._-]{1,100}$/;
const MAX_COMMENT_LENGTH = 10000;

function validateGitHubParams(owner, repo, prNumber) {
    if (!owner || typeof owner !== 'string' || !GITHUB_OWNER_PATTERN.test(owner)) {
        throw new Error('Invalid GitHub owner: must be alphanumeric with hyphens, 1-39 chars');
    }
    if (!repo || typeof repo !== 'string' || !GITHUB_REPO_PATTERN.test(repo)) {
        throw new Error('Invalid GitHub repository: must be alphanumeric with dots/hyphens/underscores, 1-100 chars');
    }
    if (owner.includes('..') || repo.includes('..') || owner.includes('/') || repo.includes('/')) {
        throw new Error('Invalid parameters: path traversal not allowed');
    }
    if (!Number.isInteger(prNumber) || prNumber < 1 || prNumber > 999999) {
        throw new Error('Invalid PR number: must be integer between 1-999999');
    }
}

export async function mergePr(owner, repo, prNumber, mergeMethod = 'squash', githubToken, storeSessionOutcome) {
    if (!githubToken) throw new Error('GITHUB_TOKEN not configured');
    validateGitHubParams(owner, repo, prNumber);

    if (!VALID_MERGE_METHODS.includes(mergeMethod)) {
        throw new Error(`Invalid merge method: must be one of ${VALID_MERGE_METHODS.join(', ')}`);
    }

    const https = (await import('https')).default;

    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname: 'api.github.com',
            path: `/repos/${owner}/${repo}/pulls/${prNumber}/merge`,
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${githubToken}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'Jules-MCP-Server',
                'Content-Type': 'application/json'
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', async () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    // Store successful merge in semantic memory
                    if (process.env.SEMANTIC_MEMORY_URL && storeSessionOutcome) {
                        try {
                            await storeSessionOutcome(
                                { title: `PR #${prNumber} merged`, sourceContext: { source: `sources/github/${owner}/${repo}` } },
                                'completed',
                                { prUrl: `https://github.com/${owner}/${repo}/pull/${prNumber}`, merged: true }
                            );
                            console.log(JSON.stringify({
                                timestamp: new Date().toISOString(),
                                level: 'info',
                                message: 'Stored PR merge in semantic memory',
                                owner, repo, prNumber
                            }));
                        } catch (err) {
                            console.warn('Failed to store PR merge in memory', err.message);
                        }
                    }
                    resolve({ success: true, merged: true, prNumber });
                } else {
                    const errMsg = res.statusCode === 403 ? 'Permission denied' :
                                   res.statusCode === 404 ? 'PR not found' :
                                   res.statusCode === 422 ? 'PR cannot be merged' : 'Merge failed';
                    reject(new Error(errMsg));
                }
            });
        });
        req.on('error', reject);
        req.write(JSON.stringify({ merge_method: mergeMethod }));
        req.end();
    });
}

export async function addPrComment(owner, repo, prNumber, comment, githubToken) {
    if (!githubToken) throw new Error('GITHUB_TOKEN not configured');
    validateGitHubParams(owner, repo, prNumber);

    if (typeof comment !== 'string' || comment.trim().length === 0) {
        throw new Error('Comment cannot be empty');
    }
    if (comment.length > MAX_COMMENT_LENGTH) {
        throw new Error(`Comment exceeds maximum length of ${MAX_COMMENT_LENGTH} characters`);
    }

    const https = (await import('https')).default;

    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname: 'api.github.com',
            path: `/repos/${owner}/${repo}/issues/${prNumber}/comments`,
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${githubToken}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'Jules-MCP-Server',
                'Content-Type': 'application/json'
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve({ success: true, commentId: JSON.parse(data).id, prNumber });
                } else {
                    const errMsg = res.statusCode === 403 ? 'Permission denied' :
                                   res.statusCode === 404 ? 'PR not found' : 'Failed to add comment';
                    reject(new Error(errMsg));
                }
            });
        });
        req.on('error', reject);
        req.write(JSON.stringify({ body: comment }));
        req.end();
    });
}

export { getIssue, getIssuesByLabel, formatIssueForPrompt };
