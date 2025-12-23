/**
 * RAG (Retrieval-Augmented Generation) Module
 * Enables codebase-aware LLM responses by indexing and searching local files
 */

import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { ollamaCompletion } from './ollama.js';

// In-memory index (for simplicity - production would use vector DB)
const ragIndex = {
    documents: [],        // { id, path, content, chunks }
    lastUpdated: null
};

/**
 * Split text into overlapping chunks for better context
 *
 * @param {string} text - Content to split
 * @param {number} chunkSize - Max characters per chunk
 * @param {number} overlap - Overlap between chunks
 * @returns {Array<{content: string, start: number, end: number, lowerContent: string}>}
 */
function chunkText(text, chunkSize = 1000, overlap = 200) {
    const chunks = [];
    let start = 0;

    while (start < text.length) {
        const end = Math.min(start + chunkSize, text.length);
        const content = text.slice(start, end);
        chunks.push({
            content,
            lowerContent: content.toLowerCase(), // Pre-compute lower case
            start,
            end
        });
        start += chunkSize - overlap;
    }

    return chunks;
}

/**
 * Generate a simple hash for document identity
 * @param {string} content - Content to hash
 * @returns {string} MD5 hash prefix
 */
function hashContent(content) {
    return crypto.createHash('md5').update(content).digest('hex').slice(0, 8);
}

/**
 * Calculate simple similarity score using keyword matching
 * (Production would use embeddings for semantic search)
 *
 * @param {string} query - Search query
 * @param {object} chunk - Pre-processed chunk object
 * @returns {number} Similarity score (0-1)
 */
function calculateSimilarity(query, chunk) {
    const queryWords = query.toLowerCase().split(/\W+/).filter(w => w.length > 2);
    // Use pre-computed lowercase content
    const textLower = chunk.lowerContent || chunk.content.toLowerCase();

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
 *
 * @param {string} filePath - Path to file
 * @returns {Promise<object|null>} Indexed document or null on error
 */
async function indexFile(filePath) {
    try {
        const content = await fs.readFile(filePath, 'utf-8');
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
        console.warn(`Failed to index file ${filePath}: ${error.message}`);
        return null;
    }
}

/**
 * Get supported file extensions for indexing
 * @returns {string[]} List of supported extensions
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
 *
 * @param {object} params - Indexing parameters
 * @param {string} params.directory - Directory to index
 * @param {string[]} [params.extensions] - Extensions to include
 * @param {number} [params.maxFiles] - Maximum files to index
 * @param {string[]} [params.excludePatterns] - Patterns to exclude
 * @returns {Promise<object>} Result summary
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

    if (!existsSync(resolvedDir)) {
        return { success: false, error: `Directory not found: ${resolvedDir}` };
    }

    const files = [];

    // Async recursive walk
    async function walkDir(dir, depth = 0) {
        if (depth > 10 || files.length >= maxFiles) return;

        try {
            const entries = await fs.readdir(dir, { withFileTypes: true });

            for (const entry of entries) {
                if (files.length >= maxFiles) break;

                const fullPath = path.join(dir, entry.name);

                // Skip excluded patterns
                if (excludePatterns.some(p => entry.name.includes(p))) continue;

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
            console.warn(`Failed to read directory ${dir}: ${e.message}`);
        }
    }

    await walkDir(resolvedDir);

    // Index files in parallel with concurrency limit
    const indexed = [];
    const concurrencyLimit = 5;

    for (let i = 0; i < files.length; i += concurrencyLimit) {
        const batch = files.slice(i, i + concurrencyLimit);
        const results = await Promise.all(batch.map(filePath => indexFile(filePath)));

        for (const doc of results) {
            if (doc) {
                // Check if already indexed
                const existing = ragIndex.documents.findIndex(d => d.path === doc.path);
                if (existing >= 0) {
                    ragIndex.documents[existing] = doc;
                } else {
                    ragIndex.documents.push(doc);
                }
                indexed.push({
                    path: doc.path,
                    chunks: doc.chunks.length
                });
            }
        }
    }

    ragIndex.lastUpdated = new Date().toISOString();

    return {
        success: true,
        indexed: indexed.length,
        totalDocuments: ragIndex.documents.length,
        totalChunks: ragIndex.documents.reduce((sum, d) => sum + d.chunks.length, 0),
        files: indexed.slice(0, 20) // Show first 20
    };
}

/**
 * Search indexed documents and return relevant context
 *
 * @param {string} query - Search query
 * @param {number} topK - Number of results to return
 * @returns {Array} Sorted search results
 */
function searchIndex(query, topK = 5) {
    const results = [];

    for (const doc of ragIndex.documents) {
        for (const chunk of doc.chunks) {
            const score = calculateSimilarity(query, chunk);
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
 *
 * @param {object} params - Query parameters
 * @param {string} params.query - The question
 * @param {string} [params.model] - LLM model to use
 * @param {number} [params.topK] - Context window size
 * @returns {Promise<object>} LLM response
 */
export async function ragQuery(params) {
    const {
        query,
        model = 'qwen2.5-coder:7b',
        topK = 5
    } = params;

    if (ragIndex.documents.length === 0) {
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
        totalIndexed: ragIndex.documents.length
    };
}

/**
 * Get RAG index status
 * @returns {object} Status object
 */
export function ragStatus() {
    return {
        indexed: ragIndex.documents.length > 0,
        documents: ragIndex.documents.length,
        totalChunks: ragIndex.documents.reduce((sum, d) => sum + d.chunks.length, 0),
        lastUpdated: ragIndex.lastUpdated,
        files: ragIndex.documents.map(d => ({
            path: d.path,
            chunks: d.chunks.length
        }))
    };
}

/**
 * Clear the RAG index
 * @returns {object} Success message
 */
export function ragClear() {
    ragIndex.documents = [];
    ragIndex.lastUpdated = null;
    return { success: true, message: 'RAG index cleared' };
}
