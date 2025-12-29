/**
 * RAG (Retrieval-Augmented Generation) Module
 * Enables codebase-aware LLM responses by indexing and searching local files
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { ollamaCompletion } from './ollama.js';

// RAG Engine Class
class RagEngine {
    constructor() {
        this.index = {
            documents: [],        // { id, path, content, chunks }
            lastUpdated: null
        };
    }

    reset() {
        this.index.documents = [];
        this.index.lastUpdated = null;
    }
}

// Singleton instance
const ragEngine = new RagEngine();

/**
 * Split text into overlapping chunks for better context
 */
function chunkText(text, chunkSize = 1000, overlap = 200) {
    const chunks = [];
    let start = 0;

    while (start < text.length) {
        const end = Math.min(start + chunkSize, text.length);
        const content = text.slice(start, end);
        chunks.push({
            content,
            contentLower: content.toLowerCase(),
            start,
            end
        });
        start += chunkSize - overlap;
    }

    return chunks;
}

/**
 * Parse .gitignore file content into regex patterns
 */
function parseGitIgnore(content) {
    if (!content) return [];
    return content.split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'))
        .map(pattern => {
            // Convert glob to regex
            let regex = pattern
                .replace(/\./g, '\\.')
                .replace(/\*/g, '.*')
                .replace(/\?/g, '.');
            if (pattern.endsWith('/')) {
                regex += '.*'; // Directory match
            }
            return new RegExp(regex);
        });
}

/**
 * Generate a simple hash for document identity
 */
function hashContent(content) {
    return crypto.createHash('md5').update(content).digest('hex').slice(0, 8);
}

/**
 * Calculate simple similarity score using keyword matching
 * (Production would use embeddings for semantic search)
 */
function calculateSimilarity(queryWords, textLower) {
    let matches = 0;
    for (const word of queryWords) {
        if (textLower.includes(word)) {
            matches++;
        }
    }

    return queryWords.length > 0 ? matches / queryWords.length : 0;
}

/**
 * Index a single file asynchronously
 */
async function indexFileAsync(filePath) {
    try {
        const stats = await fs.promises.stat(filePath);
        if (stats.size > 1024 * 1024) { // 1MB limit
            console.warn(`[RAG] Skipping large file: ${filePath} (${Math.round(stats.size / 1024)}KB)`);
            return null;
        }

        const content = await fs.promises.readFile(filePath, 'utf-8');
        const chunks = chunkText(content);
        const id = hashContent(filePath + content);

        return {
            id,
            path: filePath,
            filename: path.basename(filePath),
            extension: path.extname(filePath),
            content: content.slice(0, 5000), // Store truncated for reference
            chunks: chunks.map((c, i) => ({
                ...c,
                id: `${id}-${i}`
            })),
            indexed: new Date().toISOString()
        };
    } catch (error) {
        // console.warn(`[RAG] Failed to index ${filePath}:`, error.message);
        return null;
    }
}

/**
 * Get supported file extensions for indexing
 */
function getSupportedExtensions() {
    return [
        '.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs',
        '.py', '.rb', '.go', '.rs', '.java', '.kt',
        '.c', '.cpp', '.h', '.hpp', '.cs',
        '.md', '.txt', '.json', '.yaml', '.yml',
        '.html', '.css', '.scss', '.less',
        '.sql', '.sh', '.ps1', '.bat'
    ];
}

/**
 * Index a directory recursively
 */
export async function ragIndexDirectory(params) {
    const {
        directory,
        extensions = getSupportedExtensions(),
        maxFiles = 100,
        excludePatterns = ['node_modules', '.git', 'dist', 'build', '__pycache__']
    } = params;

    // SECURITY FIX: Validate directory is within project root to prevent path traversal
    const projectRoot = process.cwd();
    const resolvedDir = path.resolve(projectRoot, directory);

    // Ensure the resolved path is within the project root
    if (!resolvedDir.startsWith(projectRoot)) {
        return { success: false, error: 'Path traversal is not allowed. Directory must be within project root.' };
    }

    try {
        await fs.promises.access(resolvedDir);
    } catch {
        return { success: false, error: `Directory not found: ${resolvedDir}` };
    }

    const files = [];

    // Load .gitignore if present in the root of the scanned directory
    let gitIgnorePatterns = [];
    try {
        const gitIgnorePath = path.join(resolvedDir, '.gitignore');
        const gitIgnoreContent = await fs.promises.readFile(gitIgnorePath, 'utf-8');
        gitIgnorePatterns = parseGitIgnore(gitIgnoreContent);
    } catch (e) {
        // No .gitignore or error reading it, ignore
    }

    async function walkDir(dir, depth = 0) {
        if (depth > 10 || files.length >= maxFiles) return;

        try {
            const entries = await fs.promises.readdir(dir, { withFileTypes: true });

            for (const entry of entries) {
                if (files.length >= maxFiles) break;

                const fullPath = path.join(dir, entry.name);
                const relativePath = path.relative(resolvedDir, fullPath);

                // Skip excluded patterns
                if (excludePatterns.some(p => entry.name.includes(p))) continue;

                // Check .gitignore patterns
                if (gitIgnorePatterns.some(regex => regex.test(entry.name) || regex.test(relativePath))) {
                    continue;
                }

                if (entry.isDirectory()) {
                    await walkDir(fullPath, depth + 1);
                } else if (entry.isFile()) {
                    const ext = path.extname(entry.name).toLowerCase();
                    if (extensions.includes(ext)) {
                        files.push(fullPath);
                    }
                }
            }
        } catch (e) {
            // Skip directories we can't read
        }
    }

    await walkDir(resolvedDir);

    // Index files in batches to control concurrency
    const CONCURRENCY = 10;
    const indexed = [];

    for (let i = 0; i < files.length; i += CONCURRENCY) {
        const batch = files.slice(i, i + CONCURRENCY);
        const results = await Promise.all(batch.map(file => indexFileAsync(file)));

        for (const doc of results) {
            if (doc) {
                 // Check if already indexed
                const existing = ragEngine.index.documents.findIndex(d => d.path === doc.path);
                if (existing >= 0) {
                    ragEngine.index.documents[existing] = doc;
                } else {
                    ragEngine.index.documents.push(doc);
                }
                indexed.push({
                    path: doc.path,
                    chunks: doc.chunks.length
                });
            }
        }
    }

    ragEngine.index.lastUpdated = new Date().toISOString();

    return {
        success: true,
        indexed: indexed.length,
        totalDocuments: ragEngine.index.documents.length,
        totalChunks: ragEngine.index.documents.reduce((sum, d) => sum + d.chunks.length, 0),
        files: indexed.slice(0, 20) // Show first 20
    };
}

/**
 * Search indexed documents and return relevant context
 */
function searchIndex(query, topK = 5) {
    const results = [];
    // Optimization: Process query once
    const queryWords = query.toLowerCase().split(/\W+/).filter(w => w.length > 2);

    for (const doc of ragEngine.index.documents) {
        for (const chunk of doc.chunks) {
            // Use pre-computed lowercase content if available
            const textLower = chunk.contentLower || chunk.content.toLowerCase();
            const score = calculateSimilarity(queryWords, textLower);
            if (score > 0.1) {
                results.push({
                    path: doc.path,
                    filename: doc.filename,
                    content: chunk.content,
                    score
                });
            }
        }
    }

    // Sort by score and return top results
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
}

/**
 * Query with RAG - search context and generate response
 */
export async function ragQuery(params) {
    const {
        query,
        model = 'qwen2.5-coder:7b',
        topK = 5
    } = params;

    if (ragEngine.index.documents.length === 0) {
        return {
            success: false,
            error: 'No documents indexed. Use ollama_rag_index first.'
        };
    }

    // Search for relevant context
    const searchResults = searchIndex(query, topK);

    if (searchResults.length === 0) {
        return {
            success: false,
            error: 'No relevant context found for your query.'
        };
    }

    // Build context from search results
    const context = searchResults
        .map(r => `--- ${r.filename} ---\n${r.content}`)
        .join('\n\n');

    // Generate response with context
    const systemPrompt = `You are a helpful coding assistant with access to the user's codebase.
Use the following context from their files to answer questions accurately.
If the answer isn't in the context, say so but try to be helpful.

CODEBASE CONTEXT:
${context}`;

    const response = await ollamaCompletion({
        prompt: query,
        systemPrompt,
        model
    });

    return {
        success: true,
        response: response.content,
        model,
        sourcesUsed: searchResults.map(r => ({
            file: r.filename,
            path: r.path,
            relevance: Math.round(r.score * 100) + '%'
        })),
        totalIndexed: ragEngine.index.documents.length
    };
}

/**
 * Get RAG index status
 */
export function ragStatus() {
    return {
        indexed: ragEngine.index.documents.length > 0,
        documents: ragEngine.index.documents.length,
        totalChunks: ragEngine.index.documents.reduce((sum, d) => sum + d.chunks.length, 0),
        lastUpdated: ragEngine.index.lastUpdated,
        files: ragEngine.index.documents.map(d => ({
            path: d.path,
            chunks: d.chunks.length
        }))
    };
}

/**
 * Clear the RAG index
 */
export function ragClear() {
    ragEngine.reset();
    return { success: true, message: 'RAG index cleared' };
}

// Export singleton for advanced usage if needed
export { ragEngine };
