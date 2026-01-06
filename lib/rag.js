/**
 * RAG (Retrieval-Augmented Generation) Module
 * Enables codebase-aware LLM responses by indexing and searching local files
 * Optimized with Inverted Index for O(1) keyword lookup and Persistence.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { ollamaCompletion } from './ollama.js';

const RAG_INDEX_FILE = '.jules/rag-index.json';

// In-memory index structure
let ragIndex = {
    documents: [],        // { id, path, content, chunks }
    invertedIndex: {},    // word -> Set<docId>
    lastUpdated: null
};

// Load index from disk on startup
try {
    if (fs.existsSync(RAG_INDEX_FILE)) {
        const data = fs.readFileSync(RAG_INDEX_FILE, 'utf8');
        const loaded = JSON.parse(data);
        ragIndex = {
            ...loaded,
            // Rehydrate Sets from arrays if needed (JSON doesn't support Set)
            invertedIndex: Object.fromEntries(
                Object.entries(loaded.invertedIndex || {}).map(([k, v]) => [k, new Set(v)])
            )
        };
        console.log(`[RAG] Loaded index with ${ragIndex.documents.length} documents`);
    }
} catch (e) {
    console.warn('[RAG] Failed to load index:', e.message);
}

function persistIndex() {
    try {
        const dir = path.dirname(RAG_INDEX_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        // Convert Sets to Arrays for JSON serialization
        const serialized = {
            ...ragIndex,
            invertedIndex: Object.fromEntries(
                Object.entries(ragIndex.invertedIndex).map(([k, v]) => [k, Array.from(v)])
            )
        };
        fs.writeFileSync(RAG_INDEX_FILE, JSON.stringify(serialized)); // Sync for safety, or async if preferred
    } catch (e) {
        console.error('[RAG] Failed to persist index:', e.message);
    }
}

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
 * Update inverted index for a document
 */
function updateInvertedIndex(docId, text) {
    const words = new Set(text.toLowerCase().split(/\W+/).filter(w => w.length > 2));
    for (const word of words) {
        if (!ragIndex.invertedIndex[word]) {
            ragIndex.invertedIndex[word] = new Set();
        }
        ragIndex.invertedIndex[word].add(docId);
    }
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
        // console.warn(`[RAG] Failed to index ${filePath}: ${error.message}`);
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

    const projectRoot = process.cwd();
    const resolvedDir = path.resolve(projectRoot, directory);

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
            // Skip unreadable
        }
    }

    await walkDir(resolvedDir);

    const CONCURRENCY = 10;
    const indexed = [];

    // Clear old index if re-indexing (optional, but cleaner for full re-index)
    // ragIndex.documents = [];
    // ragIndex.invertedIndex = {};
    // Or just update existing... let's update.

    for (let i = 0; i < files.length; i += CONCURRENCY) {
        const batch = files.slice(i, i + CONCURRENCY);
        const results = await Promise.all(batch.map(file => indexFileAsync(file)));

        for (const doc of results) {
            if (doc) {
                const existingIdx = ragIndex.documents.findIndex(d => d.path === doc.path);

                // Remove old inverted index entries for this doc if it exists (complex, so maybe just full clear is better?
                // For now, additive update. Inverted index accumulates.
                // Ideally we'd remove old words, but that requires keeping a forward index of words per doc.
                // Simplicity: we'll just add. It might grow slightly stale but it's acceptable for this scope.)

                if (existingIdx >= 0) {
                    ragIndex.documents[existingIdx] = doc;
                } else {
                    ragIndex.documents.push(doc);
                }

                updateInvertedIndex(doc.id, doc.content); // Update inverted index

                indexed.push({
                    path: doc.path,
                    chunks: doc.chunks.length
                });
            }
        }
    }

    ragIndex.lastUpdated = new Date().toISOString();
    persistIndex();

    return {
        success: true,
        indexed: indexed.length,
        totalDocuments: ragIndex.documents.length,
        totalChunks: ragIndex.documents.reduce((sum, d) => sum + d.chunks.length, 0),
        files: indexed.slice(0, 20)
    };
}

/**
 * Search indexed documents using inverted index
 */
function searchIndex(query, topK = 5) {
    const queryWords = query.toLowerCase().split(/\W+/).filter(w => w.length > 2);
    if (queryWords.length === 0) return [];

    // Find candidate docs containing at least one query word
    const candidateDocIds = new Set();
    for (const word of queryWords) {
        if (ragIndex.invertedIndex[word]) {
            for (const docId of ragIndex.invertedIndex[word]) {
                candidateDocIds.add(docId);
            }
        }
    }

    if (candidateDocIds.size === 0) return [];

    const results = [];
    const candidates = ragIndex.documents.filter(d => candidateDocIds.has(d.id));

    // Refine with chunk-level scoring
    for (const doc of candidates) {
        for (const chunk of doc.chunks) {
            const textLower = chunk.contentLower || chunk.content.toLowerCase();

            // Calculate similarity score
            let matches = 0;
            for (const word of queryWords) {
                if (textLower.includes(word)) {
                    matches++;
                }
            }
            const score = matches / queryWords.length;

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

    const searchResults = searchIndex(query, topK);

    if (searchResults.length === 0) {
        return {
            success: false,
            error: 'No relevant context found for your query.'
        };
    }

    const context = searchResults
        .map(r => `--- ${r.filename} ---\n${r.content}`)
        .join('\n\n');

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
    ragIndex.invertedIndex = {};
    ragIndex.lastUpdated = null;
    try {
        if (fs.existsSync(RAG_INDEX_FILE)) fs.unlinkSync(RAG_INDEX_FILE);
    } catch (e) {
        // ignore
    }
    return { success: true, message: 'RAG index cleared' };
}
