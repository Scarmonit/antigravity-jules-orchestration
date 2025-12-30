/**
 * RAG (Retrieval-Augmented Generation) Module
 * Enables codebase-aware LLM responses by indexing and searching local files
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { ollamaCompletion } from './ollama.js';

class RagEngine {
    constructor() {
        this.index = {
            documents: [],        // { id, path, content, chunks }
            lastUpdated: null
        };
        this.persistencePath = path.join(process.cwd(), '.jules', 'rag-index.json');
    }

    /**
     * Split text into overlapping chunks for better context
     */
    chunkText(text, chunkSize = 1000, overlap = 200) {
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
    hashContent(content) {
        return crypto.createHash('md5').update(content).digest('hex').slice(0, 8);
    }

    /**
     * Calculate simple similarity score using keyword matching
     * Optimized with Set for O(1) query word lookup if we were iterating text words,
     * but here we iterate query words against text.
     */
    calculateSimilarity(queryWords, textLower) {
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
    async indexFileAsync(filePath) {
        try {
            const content = await fs.promises.readFile(filePath, 'utf-8');
            const chunks = this.chunkText(content);
            const id = this.hashContent(filePath + content);

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
            console.warn(`[RAG] Failed to index file ${filePath}: ${error.message}`);
            return null;
        }
    }

    /**
     * Get supported file extensions for indexing
     */
    getSupportedExtensions() {
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
     * Save index to disk
     */
    async saveIndex() {
        try {
            const dir = path.dirname(this.persistencePath);
            await fs.promises.mkdir(dir, { recursive: true });
            await fs.promises.writeFile(this.persistencePath, JSON.stringify(this.index, null, 2));
            console.log(`[RAG] Index saved to ${this.persistencePath}`);
        } catch (error) {
            console.error(`[RAG] Failed to save index: ${error.message}`);
        }
    }

    /**
     * Load index from disk
     */
    async loadIndex() {
        try {
            if (fs.existsSync(this.persistencePath)) {
                const data = await fs.promises.readFile(this.persistencePath, 'utf-8');
                this.index = JSON.parse(data);
                console.log(`[RAG] Index loaded with ${this.index.documents.length} documents`);
                return true;
            }
        } catch (error) {
            console.error(`[RAG] Failed to load index: ${error.message}`);
        }
        return false;
    }

    /**
     * Index a directory recursively
     */
    async indexDirectory(params) {
        const {
            directory,
            extensions = this.getSupportedExtensions(),
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

        const walkDir = async (dir, depth = 0) => {
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
                console.warn(`[RAG] Skipping directory ${dir}: ${e.message}`);
            }
        };

        await walkDir(resolvedDir);

        // Index files in batches to control concurrency
        const CONCURRENCY = 10;
        const indexed = [];

        for (let i = 0; i < files.length; i += CONCURRENCY) {
            const batch = files.slice(i, i + CONCURRENCY);
            const results = await Promise.all(batch.map(file => this.indexFileAsync(file)));

            for (const doc of results) {
                if (doc) {
                    // Check if already indexed
                    const existing = this.index.documents.findIndex(d => d.path === doc.path);
                    if (existing >= 0) {
                        this.index.documents[existing] = doc;
                    } else {
                        this.index.documents.push(doc);
                    }
                    indexed.push({
                        path: doc.path,
                        chunks: doc.chunks.length
                    });
                }
            }
        }

        this.index.lastUpdated = new Date().toISOString();
        await this.saveIndex();

        return {
            success: true,
            indexed: indexed.length,
            totalDocuments: this.index.documents.length,
            totalChunks: this.index.documents.reduce((sum, d) => sum + d.chunks.length, 0),
            files: indexed.slice(0, 20) // Show first 20
        };
    }

    /**
     * Search indexed documents and return relevant context
     */
    search(query, topK = 5) {
        const results = [];
        // Optimization: Process query once
        const queryWords = query.toLowerCase().split(/\W+/).filter(w => w.length > 2);

        for (const doc of this.index.documents) {
            for (const chunk of doc.chunks) {
                // Use pre-computed lowercase content if available
                const textLower = chunk.contentLower || chunk.content.toLowerCase();
                const score = this.calculateSimilarity(queryWords, textLower);
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
    async query(params) {
        const {
            query,
            model = 'qwen2.5-coder:7b',
            topK = 5
        } = params;

        if (this.index.documents.length === 0) {
            // Try to load if empty
            await this.loadIndex();
            if (this.index.documents.length === 0) {
                return {
                    success: false,
                    error: 'No documents indexed. Use ollama_rag_index first.'
                };
            }
        }

        // Search for relevant context
        const searchResults = this.search(query, topK);

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
            totalIndexed: this.index.documents.length
        };
    }

    /**
     * Get RAG index status
     */
    getStatus() {
        return {
            indexed: this.index.documents.length > 0,
            documents: this.index.documents.length,
            totalChunks: this.index.documents.reduce((sum, d) => sum + d.chunks.length, 0),
            lastUpdated: this.index.lastUpdated,
            files: this.index.documents.map(d => ({
                path: d.path,
                chunks: d.chunks.length
            }))
        };
    }

    /**
     * Clear the RAG index
     */
    async clear() {
        this.index.documents = [];
        this.index.lastUpdated = null;
        try {
            if (fs.existsSync(this.persistencePath)) {
                await fs.promises.unlink(this.persistencePath);
            }
        } catch (e) {
            console.warn(`[RAG] Failed to delete index file: ${e.message}`);
        }
        return { success: true, message: 'RAG index cleared' };
    }
}

// Singleton instance
const ragEngine = new RagEngine();

// Export legacy functions that use the singleton
export async function ragIndexDirectory(params) {
    return ragEngine.indexDirectory(params);
}

export async function ragQuery(params) {
    return ragEngine.query(params);
}

export function ragStatus() {
    return ragEngine.getStatus();
}

export function ragClear() {
    return ragEngine.clear();
}

// Export class for advanced usage
export { RagEngine };
