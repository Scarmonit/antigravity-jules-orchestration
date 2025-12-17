/**
 * RAG (Retrieval-Augmented Generation) Module
 * Enables codebase-aware LLM responses by indexing and searching local files
 */

import fs from 'fs';
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
 */
function chunkText(text, chunkSize = 1000, overlap = 200) {
    const chunks = [];
    let start = 0;

    while (start < text.length) {
        const end = Math.min(start + chunkSize, text.length);
        chunks.push({
            content: text.slice(start, end),
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
 * Calculate simple similarity score using keyword matching
 * (Production would use embeddings for semantic search)
 */
function calculateSimilarity(query, text) {
    const queryWords = query.toLowerCase().split(/\W+/).filter(w => w.length > 2);
    const textLower = text.toLowerCase();

    let matches = 0;
    for (const word of queryWords) {
        if (textLower.includes(word)) {
            matches++;
        }
    }

    return queryWords.length > 0 ? matches / queryWords.length : 0;
}

/**
 * Index a single file
 */
function indexFile(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
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

    if (!fs.existsSync(directory)) {
        return { success: false, error: `Directory not found: ${directory}` };
    }

    const files = [];

    function walkDir(dir, depth = 0) {
        if (depth > 10 || files.length >= maxFiles) return;

        try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });

            for (const entry of entries) {
                if (files.length >= maxFiles) break;

                const fullPath = path.join(dir, entry.name);

                // Skip excluded patterns
                if (excludePatterns.some(p => entry.name.includes(p))) continue;

                if (entry.isDirectory()) {
                    walkDir(fullPath, depth + 1);
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

    walkDir(directory);

    // Index each file
    const indexed = [];
    for (const filePath of files) {
        const doc = indexFile(filePath);
        if (doc) {
            // Check if already indexed
            const existing = ragIndex.documents.findIndex(d => d.path === filePath);
            if (existing >= 0) {
                ragIndex.documents[existing] = doc;
            } else {
                ragIndex.documents.push(doc);
            }
            indexed.push({
                path: filePath,
                chunks: doc.chunks.length
            });
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
 */
function searchIndex(query, topK = 5) {
    const results = [];

    for (const doc of ragIndex.documents) {
        for (const chunk of doc.chunks) {
            const score = calculateSimilarity(query, chunk.content);
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
    ragIndex.lastUpdated = null;
    return { success: true, message: 'RAG index cleared' };
}
