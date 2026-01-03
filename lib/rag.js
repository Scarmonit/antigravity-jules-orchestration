/**
 * RAG (Retrieval-Augmented Generation) Module
 * Enables codebase-aware LLM responses by indexing and searching local files
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { ollamaCompletion } from './ollama.js';

// In-memory index with inverted index for O(1) keyword lookup
const ragIndex = {
    documents: [],        // { id, path, content, chunks }
    invertedIndex: new Map(), // word -> Set of document IDs (or chunk IDs)
    lastUpdated: null
};

/**
 * Split text into overlapping chunks for better context
 */
export function chunkText(text, chunkSize = 1000, overlap = 200) {
    const chunks = [];
    let start = 0;

    if (!text || text.length === 0) return chunks;

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
 * Generate a simple hash for document identity
 */
function hashContent(content) {
    return crypto.createHash('md5').update(content).digest('hex').slice(0, 8);
}

/**
 * Tokenize text into words for indexing
 */
function tokenize(text) {
    return text.toLowerCase().split(/\W+/).filter(w => w.length > 2);
}

/**
 * Update inverted index for a document
 */
function updateInvertedIndex(doc) {
    doc.chunks.forEach((chunk, chunkIndex) => {
        const words = tokenize(chunk.content);
        const uniqueWords = new Set(words);
        for (const word of uniqueWords) {
            if (!ragIndex.invertedIndex.has(word)) {
                ragIndex.invertedIndex.set(word, new Set());
            }
            // Store reference to document and chunk index
            ragIndex.invertedIndex.get(word).add(`${doc.id}:${chunkIndex}`);
        }
    });
}

/**
 * Remove document from inverted index (expensive, so maybe just accept staleness or rebuild)
 * For now, we just leave it. If doc is gone from `ragIndex.documents`, search will filter it out.
 */

/**
 * Index a single file asynchronously
 */
async function indexFileAsync(filePath) {
    try {
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
        console.warn(`Failed to index file ${filePath}: ${error.message}`);
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
        excludePatterns = ['node_modules', '.git', 'dist', 'build', '__pycache__'],
        clearIndex = true // Default to true for backward compatibility, but allow false for cumulative
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

    async function walkDir(dir, depth = 0) {
        if (depth > 10 || files.length >= maxFiles) return;

        try {
            const entries = await fs.promises.readdir(dir, { withFileTypes: true });

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
        }
    }

    await walkDir(resolvedDir);

    // Clear existing index if requested
    if (clearIndex) {
        ragIndex.documents = [];
        ragIndex.invertedIndex.clear();
    }

    // Index files in batches to control concurrency
    const CONCURRENCY = 10;
    const indexed = [];

    for (let i = 0; i < files.length; i += CONCURRENCY) {
        const batch = files.slice(i, i + CONCURRENCY);
        const results = await Promise.all(batch.map(file => indexFileAsync(file)));

        for (const doc of results) {
            if (doc) {
                 // Check if already indexed
                const existingIdx = ragIndex.documents.findIndex(d => d.path === doc.path);

                if (existingIdx >= 0) {
                    // Replace existing
                    ragIndex.documents[existingIdx] = doc;
                    // Note: Inverted index might have stale refs, but search filters them out if doc ID changed.
                    // If doc ID is hash based on content, it will be new if content changed.
                } else {
                    ragIndex.documents.push(doc);
                }

                updateInvertedIndex(doc);
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
 * Search indexed documents using inverted index
 */
function searchIndex(query, topK = 5) {
    if (ragIndex.documents.length === 0) return [];

    const queryWords = tokenize(query);
    if (queryWords.length === 0) return [];

    // Map chunkId -> score
    const chunkScores = new Map();

    for (const word of queryWords) {
        const matches = ragIndex.invertedIndex.get(word);
        if (matches) {
            for (const match of matches) {
                // match is "docId:chunkIndex"
                const currentScore = chunkScores.get(match) || 0;
                chunkScores.set(match, currentScore + 1);
            }
        }
    }

    const results = [];
    for (const [key, rawScore] of chunkScores.entries()) {
        const [docId, chunkIdxStr] = key.split(':');
        const chunkIndex = parseInt(chunkIdxStr, 10);
        const doc = ragIndex.documents.find(d => d.id === docId);

        // If doc exists (wasn't deleted/replaced) and chunk exists
        if (doc && doc.chunks[chunkIndex]) {
            const chunk = doc.chunks[chunkIndex];
            // Normalize score by query length
            const score = rawScore / queryWords.length;
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
 */
export function ragClear() {
    ragIndex.documents = [];
    ragIndex.invertedIndex.clear();
    ragIndex.lastUpdated = null;
    return { success: true, message: 'RAG index cleared' };
}
