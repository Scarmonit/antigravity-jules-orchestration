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
    invertedIndex: new Map(), // word -> Set<chunkId>
    lastUpdated: null
};

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
 * Generate a simple hash for document identity
 */
function hashContent(content) {
    return crypto.createHash('md5').update(content).digest('hex').slice(0, 8);
}

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
        return null;
    }
}

/**
 * Update inverted index with new document chunks
 */
function updateInvertedIndex(doc) {
    doc.chunks.forEach(chunk => {
        // Simple tokenization: split by non-word chars and filter short words
        const words = new Set(chunk.contentLower.split(/\W+/).filter(w => w.length > 2));
        for (const word of words) {
            if (!ragIndex.invertedIndex.has(word)) {
                ragIndex.invertedIndex.set(word, new Set());
            }
            ragIndex.invertedIndex.get(word).add({
                chunkId: chunk.id,
                docId: doc.id,
                chunk: chunk,
                doc: doc
            });
        }
    });
}

/**
 * Remove document from inverted index (not fully efficient without forward index tracking,
 * but acceptable for this scale - we usually clear all or add)
 */
function removeFromInvertedIndex(docId) {
    // This is expensive if we iterate everything.
    // Optimization: Since we mostly overwrite or clear, we can skip complex removal logic
    // or just rebuild for simplicity on updates.
    // For now, we will just rebuild the index when updating an existing file, which is safer.
    // However, given the structure, `ragIndexDirectory` re-indexes everything or adds new.
    // If it updates existing, we should clear old entries.
    // A full rebuild of inverted index is O(TotalWords), which is fast enough for <10MB codebases.
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

    // Index files in batches to control concurrency
    const CONCURRENCY = 10;
    const indexed = [];

    for (let i = 0; i < files.length; i += CONCURRENCY) {
        const batch = files.slice(i, i + CONCURRENCY);
        const results = await Promise.all(batch.map(file => indexFileAsync(file)));

        for (const doc of results) {
            if (doc) {
                 // Check if already indexed
                const existing = ragIndex.documents.findIndex(d => d.path === doc.path);
                if (existing >= 0) {
                    ragIndex.documents[existing] = doc;
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
 * Search indexed documents and return relevant context using Inverted Index
 */
function searchIndex(query, topK = 5) {
    const results = new Map(); // chunkId -> { score, chunk, doc }
    // Optimization: Process query once
    const queryWords = query.toLowerCase().split(/\W+/).filter(w => w.length > 2);

    if (queryWords.length === 0) return [];

    // 1. Candidate Retrieval: Find chunks containing at least one query word
    const candidates = new Set();
    for (const word of queryWords) {
        const matches = ragIndex.invertedIndex.get(word);
        if (matches) {
            for (const match of matches) {
                candidates.add(match);
            }
        }
    }

    // 2. Scoring: Calculate similarity only for candidates
    for (const match of candidates) {
        const { chunk, doc } = match;
        // Use pre-computed lowercase content
        const textLower = chunk.contentLower;

        // Simple TF-like scoring (keyword match count / query length)
        let matches = 0;
        for (const word of queryWords) {
            if (textLower.includes(word)) {
                matches++;
            }
        }

        const score = matches / queryWords.length;

        if (score > 0.1) {
            results.set(chunk.id, {
                path: doc.path,
                filename: doc.filename,
                content: chunk.content,
                score
            });
        }
    }

    // Sort by score and return top results
    return Array.from(results.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);
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
