/**
 * RAG (Retrieval-Augmented Generation) Module
 * Enables codebase-aware LLM responses by indexing and searching local files
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { ollamaCompletion } from './ollama.js';

const RAG_DIR = '.jules';
const RAG_INDEX_FILE = path.join(RAG_DIR, 'rag-index.json');

// In-memory index
const ragIndex = {
    documents: [],        // { id, path, content, chunks }
    invertedIndex: new Map(), // word -> Set<docIndex> (maps word to index in documents array)
    lastUpdated: null
};

// Initialize by loading index if available
loadIndex();

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
 * Save the index to disk
 */
async function saveIndex() {
    try {
        if (!fs.existsSync(RAG_DIR)) {
            await fs.promises.mkdir(RAG_DIR, { recursive: true });
        }

        const data = {
            version: '1.0',
            lastUpdated: ragIndex.lastUpdated,
            documents: ragIndex.documents,
            // Convert Map<word, Set<docIndex>> to Object<word, Array<docIndex>>
            invertedIndex: Object.fromEntries(
                Array.from(ragIndex.invertedIndex.entries()).map(([k, v]) => [k, Array.from(v)])
            )
        };

        await fs.promises.writeFile(RAG_INDEX_FILE, JSON.stringify(data), 'utf-8');
        return true;
    } catch (error) {
        console.error('Failed to save RAG index:', error);
        return false;
    }
}

/**
 * Load the index from disk
 */
function loadIndex() {
    try {
        if (!fs.existsSync(RAG_INDEX_FILE)) return false;

        const content = fs.readFileSync(RAG_INDEX_FILE, 'utf-8');
        const data = JSON.parse(content);

        ragIndex.documents = data.documents || [];
        ragIndex.lastUpdated = data.lastUpdated;

        // Convert Object<word, Array<docIndex>> back to Map<word, Set<docIndex>>
        if (data.invertedIndex) {
            ragIndex.invertedIndex = new Map(
                Object.entries(data.invertedIndex).map(([k, v]) => [k, new Set(v)])
            );
        } else {
            // Rebuild inverted index if missing
            rebuildInvertedIndex();
        }

        console.log(`[RAG] Loaded index with ${ragIndex.documents.length} documents`);
        return true;
    } catch (error) {
        console.error('Failed to load RAG index:', error);
        return false;
    }
}

/**
 * Rebuild the inverted index from documents
 */
function rebuildInvertedIndex() {
    ragIndex.invertedIndex.clear();
    ragIndex.documents.forEach((doc, idx) => {
        addToInvertedIndex(doc, idx);
    });
}

/**
 * Add document words to inverted index
 */
function addToInvertedIndex(doc, docIdx) {
    const words = new Set();
    // Index filename parts
    doc.filename.toLowerCase().split(/\W+/).forEach(w => {
        if (w.length > 2) words.add(w);
    });

    // Index content chunks
    doc.chunks.forEach(chunk => {
        const contentWords = (chunk.contentLower || chunk.content.toLowerCase()).split(/\W+/);
        contentWords.forEach(w => {
            if (w.length > 2) words.add(w);
        });
    });

    for (const word of words) {
        if (!ragIndex.invertedIndex.has(word)) {
            ragIndex.invertedIndex.set(word, new Set());
        }
        ragIndex.invertedIndex.get(word).add(docIdx);
    }
}

/**
 * Calculate simple similarity score using keyword matching
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
        // console.warn(`Failed to index file ${filePath}: ${error.message}`);
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
                const existingIdx = ragIndex.documents.findIndex(d => d.path === doc.path);

                if (existingIdx >= 0) {
                    // Update existing
                    ragIndex.documents[existingIdx] = doc;
                    // Re-indexing inverted index for this doc is hard without removing old words
                    // Simpler to just rebuild inverted index at the end or accept some staleness until full rebuild
                    // For now, we'll just handle it by full rebuild or specific update if we were smarter.
                    // Let's rely on rebuildInvertedIndex() at the end of bulk operation for consistency
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

    // Update timestamp and rebuild inverted index to ensure consistency
    ragIndex.lastUpdated = new Date().toISOString();
    rebuildInvertedIndex();

    // Save to disk
    await saveIndex();

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
    // Optimization: Process query once
    const queryWords = query.toLowerCase().split(/\W+/).filter(w => w.length > 2);

    if (queryWords.length === 0) return [];

    // Use inverted index to find candidate documents
    // We only check documents that contain at least one query word
    const candidateDocIndices = new Set();

    for (const word of queryWords) {
        if (ragIndex.invertedIndex.has(word)) {
            ragIndex.invertedIndex.get(word).forEach(idx => candidateDocIndices.add(idx));
        }
    }

    if (candidateDocIndices.size === 0) return [];

    // Score candidates
    for (const idx of candidateDocIndices) {
        const doc = ragIndex.documents[idx];
        if (!doc) continue;

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
export async function ragClear() {
    ragIndex.documents = [];
    ragIndex.invertedIndex.clear();
    ragIndex.lastUpdated = null;

    // Clear persistence file
    try {
        if (fs.existsSync(RAG_INDEX_FILE)) {
            await fs.promises.unlink(RAG_INDEX_FILE);
        }
    } catch (e) {
        console.warn('Failed to delete RAG index file:', e);
    }

    return { success: true, message: 'RAG index cleared' };
}
