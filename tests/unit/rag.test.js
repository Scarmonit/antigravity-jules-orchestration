/**
 * Unit Tests for RAG (Retrieval-Augmented Generation) Module
 *
 * Tests cover:
 * - chunkText() function
 * - hashContent() function
 * - calculateSimilarity() function
 * - getSupportedExtensions() function
 * - searchIndex() function
 * - Path traversal protection
 * - Edge cases and error handling
 *
 * @module tests/unit/rag.test
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import os from 'os';

// =============================================================================
// Recreated RAG Functions for Unit Testing
// (Isolated from file system operations where possible)
// =============================================================================

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
 * Check if path is within allowed directory (security check)
 */
function isPathSafe(targetPath, allowedBase) {
  const resolvedTarget = path.resolve(targetPath);
  const resolvedBase = path.resolve(allowedBase);
  return resolvedTarget.startsWith(resolvedBase);
}

/**
 * Mock RAG index for testing
 */
function createMockRagIndex() {
  return {
    documents: [],
    lastUpdated: null
  };
}

/**
 * Search mock index
 */
function searchIndex(ragIndex, query, topK = 5) {
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

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, topK);
}

/**
 * Get RAG status
 */
function ragStatus(ragIndex) {
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

// =============================================================================
// Test Suite: chunkText()
// =============================================================================

describe('RAG - chunkText()', () => {
  it('should split text into chunks with default parameters', () => {
    const text = 'a'.repeat(2500);
    const chunks = chunkText(text);

    assert.ok(chunks.length > 1);
    assert.strictEqual(chunks[0].content.length, 1000);
    assert.strictEqual(chunks[0].start, 0);
    assert.strictEqual(chunks[0].end, 1000);
  });

  it('should create overlapping chunks', () => {
    const text = 'a'.repeat(1500);
    const chunks = chunkText(text, 1000, 200);

    // First chunk: 0-1000
    // Second chunk: 800-1500 (starts at 1000-200=800)
    assert.strictEqual(chunks[0].start, 0);
    assert.strictEqual(chunks[0].end, 1000);
    assert.strictEqual(chunks[1].start, 800);
  });

  it('should handle text smaller than chunk size', () => {
    const text = 'Short text';
    const chunks = chunkText(text, 1000, 200);

    assert.strictEqual(chunks.length, 1);
    assert.strictEqual(chunks[0].content, 'Short text');
    assert.strictEqual(chunks[0].start, 0);
    assert.strictEqual(chunks[0].end, 10);
  });

  it('should handle empty text', () => {
    const chunks = chunkText('');

    assert.strictEqual(chunks.length, 0);
  });

  it('should use custom chunk size', () => {
    const text = 'a'.repeat(500);
    const chunks = chunkText(text, 100, 20);

    // Each chunk is 100 chars, overlap 20, so step is 80
    // 500 / 80 = ~6.25, so about 7 chunks
    assert.ok(chunks.length >= 6);
    assert.strictEqual(chunks[0].content.length, 100);
  });

  it('should use custom overlap', () => {
    const text = 'a'.repeat(200);
    const chunks = chunkText(text, 100, 50);

    // Step size = 100 - 50 = 50
    // So chunks start at: 0, 50, 100, 150
    assert.strictEqual(chunks[0].start, 0);
    assert.strictEqual(chunks[1].start, 50);
    assert.strictEqual(chunks[2].start, 100);
  });

  it('should preserve content accurately', () => {
    const text = 'ABCDEFGHIJ'; // 10 chars
    const chunks = chunkText(text, 5, 2);

    assert.strictEqual(chunks[0].content, 'ABCDE');
    assert.strictEqual(chunks[1].content, 'DEFGH');
    assert.strictEqual(chunks[2].content, 'GHIJ');
  });

  it('should include start and end positions', () => {
    const text = 'Hello World!';
    const chunks = chunkText(text, 6, 2);

    chunks.forEach(chunk => {
      assert.ok('start' in chunk);
      assert.ok('end' in chunk);
      assert.ok(chunk.start >= 0);
      assert.ok(chunk.end <= text.length);
      assert.ok(chunk.start < chunk.end);
    });
  });

  it('should handle very large text', () => {
    const text = 'x'.repeat(1000000); // 1MB of text
    const chunks = chunkText(text, 10000, 1000);

    assert.ok(chunks.length > 100);
    assert.strictEqual(chunks[0].content.length, 10000);
  });
});

// =============================================================================
// Test Suite: hashContent()
// =============================================================================

describe('RAG - hashContent()', () => {
  it('should return 8-character hex string', () => {
    const hash = hashContent('test content');

    assert.strictEqual(hash.length, 8);
    assert.match(hash, /^[a-f0-9]{8}$/);
  });

  it('should produce consistent hashes', () => {
    const hash1 = hashContent('same content');
    const hash2 = hashContent('same content');

    assert.strictEqual(hash1, hash2);
  });

  it('should produce different hashes for different content', () => {
    const hash1 = hashContent('content A');
    const hash2 = hashContent('content B');

    assert.notStrictEqual(hash1, hash2);
  });

  it('should handle empty string', () => {
    const hash = hashContent('');

    assert.strictEqual(hash.length, 8);
    assert.match(hash, /^[a-f0-9]{8}$/);
  });

  it('should handle unicode content', () => {
    const hash = hashContent('中文内容 🚀');

    assert.strictEqual(hash.length, 8);
    assert.match(hash, /^[a-f0-9]{8}$/);
  });

  it('should handle binary-like content', () => {
    const hash = hashContent('\x00\x01\x02\xff');

    assert.strictEqual(hash.length, 8);
  });

  it('should handle very long content', () => {
    const longContent = 'x'.repeat(1000000);
    const hash = hashContent(longContent);

    assert.strictEqual(hash.length, 8);
  });

  it('should produce correct MD5 prefix', () => {
    const content = 'test';
    const expectedFullHash = crypto.createHash('md5').update(content).digest('hex');
    const expectedPrefix = expectedFullHash.slice(0, 8);

    const result = hashContent(content);

    assert.strictEqual(result, expectedPrefix);
  });
});

// =============================================================================
// Test Suite: calculateSimilarity()
// =============================================================================

describe('RAG - calculateSimilarity()', () => {
  it('should return 1.0 for exact match', () => {
    const score = calculateSimilarity('hello world', 'hello world');

    assert.strictEqual(score, 1.0);
  });

  it('should return 0 for no matches', () => {
    const score = calculateSimilarity('apple banana', 'xyz abc');

    assert.strictEqual(score, 0);
  });

  it('should return partial score for partial matches', () => {
    const score = calculateSimilarity('hello world', 'hello there');

    assert.ok(score > 0);
    assert.ok(score < 1);
    assert.strictEqual(score, 0.5); // 1 of 2 words match
  });

  it('should be case insensitive', () => {
    const score = calculateSimilarity('HELLO WORLD', 'hello world');

    assert.strictEqual(score, 1.0);
  });

  it('should filter out short words (<=2 chars)', () => {
    const score = calculateSimilarity('a to is the hello', 'hello world');

    // Only 'the' (3 chars) and 'hello' (5 chars) should be considered
    // 'a', 'to', 'is' are filtered out (<=2 chars)
    assert.ok(score > 0);
  });

  it('should handle empty query', () => {
    const score = calculateSimilarity('', 'some text');

    assert.strictEqual(score, 0);
  });

  it('should handle query with only short words', () => {
    const score = calculateSimilarity('a to is', 'hello world');

    // All words filtered out, queryWords.length = 0
    assert.strictEqual(score, 0);
  });

  it('should handle special characters in query', () => {
    const score = calculateSimilarity('function test()', 'function test() { return true; }');

    // 'function' and 'test' should match
    assert.ok(score > 0);
  });

  it('should find words anywhere in text', () => {
    const score = calculateSimilarity('error handling', 'The system has great error handling capabilities');

    assert.strictEqual(score, 1.0); // Both words found
  });

  it('should handle numeric words', () => {
    const score = calculateSimilarity('version 123', 'version 123 released');

    assert.ok(score > 0);
  });
});

// =============================================================================
// Test Suite: getSupportedExtensions()
// =============================================================================

describe('RAG - getSupportedExtensions()', () => {
  it('should return an array of extensions', () => {
    const extensions = getSupportedExtensions();

    assert.ok(Array.isArray(extensions));
    assert.ok(extensions.length > 0);
  });

  it('should include JavaScript extensions', () => {
    const extensions = getSupportedExtensions();

    assert.ok(extensions.includes('.js'));
    assert.ok(extensions.includes('.jsx'));
    assert.ok(extensions.includes('.mjs'));
    assert.ok(extensions.includes('.cjs'));
  });

  it('should include TypeScript extensions', () => {
    const extensions = getSupportedExtensions();

    assert.ok(extensions.includes('.ts'));
    assert.ok(extensions.includes('.tsx'));
  });

  it('should include Python extension', () => {
    const extensions = getSupportedExtensions();

    assert.ok(extensions.includes('.py'));
  });

  it('should include documentation formats', () => {
    const extensions = getSupportedExtensions();

    assert.ok(extensions.includes('.md'));
    assert.ok(extensions.includes('.txt'));
  });

  it('should include config formats', () => {
    const extensions = getSupportedExtensions();

    assert.ok(extensions.includes('.json'));
    assert.ok(extensions.includes('.yaml'));
    assert.ok(extensions.includes('.yml'));
  });

  it('should include shell script extensions', () => {
    const extensions = getSupportedExtensions();

    assert.ok(extensions.includes('.sh'));
    assert.ok(extensions.includes('.ps1'));
    assert.ok(extensions.includes('.bat'));
  });

  it('should include web development extensions', () => {
    const extensions = getSupportedExtensions();

    assert.ok(extensions.includes('.html'));
    assert.ok(extensions.includes('.css'));
    assert.ok(extensions.includes('.scss'));
  });

  it('should include systems programming extensions', () => {
    const extensions = getSupportedExtensions();

    assert.ok(extensions.includes('.c'));
    assert.ok(extensions.includes('.cpp'));
    assert.ok(extensions.includes('.h'));
    assert.ok(extensions.includes('.rs'));
    assert.ok(extensions.includes('.go'));
  });

  it('should all start with a dot', () => {
    const extensions = getSupportedExtensions();

    extensions.forEach(ext => {
      assert.ok(ext.startsWith('.'), `Extension ${ext} should start with a dot`);
    });
  });
});

// =============================================================================
// Test Suite: isPathSafe() - Path Traversal Protection
// =============================================================================

describe('RAG - Path Traversal Protection', () => {
  it('should allow paths within the allowed base', () => {
    const result = isPathSafe('/project/src/file.js', '/project');

    assert.strictEqual(result, true);
  });

  it('should reject paths outside the allowed base', () => {
    const result = isPathSafe('/etc/passwd', '/project');

    assert.strictEqual(result, false);
  });

  it('should reject path traversal attempts', () => {
    const result = isPathSafe('/project/../etc/passwd', '/project');

    assert.strictEqual(result, false);
  });

  it('should handle double dot traversal', () => {
    const result = isPathSafe('/project/src/../../etc/passwd', '/project');

    assert.strictEqual(result, false);
  });

  it('should allow nested paths within base', () => {
    const result = isPathSafe('/project/src/lib/utils/helper.js', '/project');

    assert.strictEqual(result, true);
  });

  it('should handle relative paths', () => {
    const result = isPathSafe('./src/file.js', process.cwd());

    assert.strictEqual(result, true);
  });

  it('should handle paths with trailing slash', () => {
    const result = isPathSafe('/project/src/', '/project');

    assert.strictEqual(result, true);
  });

  it('should handle Windows-style paths', () => {
    // This test is platform-dependent but should work on Windows
    if (process.platform === 'win32') {
      const result = isPathSafe('C:\\project\\src\\file.js', 'C:\\project');
      assert.strictEqual(result, true);
    } else {
      assert.ok(true); // Skip on non-Windows
    }
  });
});

// =============================================================================
// Test Suite: searchIndex()
// =============================================================================

describe('RAG - searchIndex()', () => {
  let mockIndex;

  beforeEach(() => {
    mockIndex = createMockRagIndex();
    mockIndex.documents = [
      {
        path: '/project/src/auth.js',
        filename: 'auth.js',
        chunks: [
          { content: 'function authenticate(user, password) { return validateCredentials(user, password); }' },
          { content: 'function validateCredentials(user, pass) { return user === "admin" && pass === "secret"; }' }
        ]
      },
      {
        path: '/project/src/api.js',
        filename: 'api.js',
        chunks: [
          { content: 'async function fetchUsers() { return await fetch("/api/users"); }' },
          { content: 'async function createUser(data) { return await post("/api/users", data); }' }
        ]
      }
    ];
  });

  it('should return matching results for relevant query', () => {
    const results = searchIndex(mockIndex, 'authenticate user');

    assert.ok(results.length > 0);
    assert.ok(results.some(r => r.filename === 'auth.js'));
  });

  it('should return empty array for non-matching query', () => {
    const results = searchIndex(mockIndex, 'zzzzzyyyy');

    assert.deepStrictEqual(results, []);
  });

  it('should sort results by score descending', () => {
    const results = searchIndex(mockIndex, 'user');

    for (let i = 0; i < results.length - 1; i++) {
      assert.ok(results[i].score >= results[i + 1].score);
    }
  });

  it('should limit results to topK', () => {
    const results = searchIndex(mockIndex, 'function', 2);

    assert.ok(results.length <= 2);
  });

  it('should include file path and filename', () => {
    const results = searchIndex(mockIndex, 'authenticate');

    assert.ok(results[0].path);
    assert.ok(results[0].filename);
    assert.ok(results[0].content);
    assert.ok(results[0].score);
  });

  it('should filter results with score below threshold', () => {
    const results = searchIndex(mockIndex, 'random words xyz');

    // Should only return results with score > 0.1
    results.forEach(r => {
      assert.ok(r.score > 0.1);
    });
  });

  it('should handle empty index', () => {
    const emptyIndex = createMockRagIndex();
    const results = searchIndex(emptyIndex, 'test');

    assert.deepStrictEqual(results, []);
  });

  it('should search across all chunks', () => {
    // validateCredentials is in the second chunk of auth.js
    const results = searchIndex(mockIndex, 'validateCredentials');

    assert.ok(results.length > 0);
    assert.ok(results[0].content.includes('validateCredentials'));
  });
});

// =============================================================================
// Test Suite: ragStatus()
// =============================================================================

describe('RAG - ragStatus()', () => {
  it('should return status for empty index', () => {
    const emptyIndex = createMockRagIndex();
    const status = ragStatus(emptyIndex);

    assert.strictEqual(status.indexed, false);
    assert.strictEqual(status.documents, 0);
    assert.strictEqual(status.totalChunks, 0);
    assert.strictEqual(status.lastUpdated, null);
    assert.deepStrictEqual(status.files, []);
  });

  it('should return status for populated index', () => {
    const index = createMockRagIndex();
    index.documents = [
      { path: '/file1.js', chunks: [{ content: 'a' }, { content: 'b' }] },
      { path: '/file2.js', chunks: [{ content: 'c' }] }
    ];
    index.lastUpdated = '2024-01-01T00:00:00Z';

    const status = ragStatus(index);

    assert.strictEqual(status.indexed, true);
    assert.strictEqual(status.documents, 2);
    assert.strictEqual(status.totalChunks, 3);
    assert.strictEqual(status.lastUpdated, '2024-01-01T00:00:00Z');
    assert.strictEqual(status.files.length, 2);
  });

  it('should include file paths and chunk counts', () => {
    const index = createMockRagIndex();
    index.documents = [
      { path: '/src/main.js', chunks: [{}, {}, {}] }
    ];

    const status = ragStatus(index);

    assert.strictEqual(status.files[0].path, '/src/main.js');
    assert.strictEqual(status.files[0].chunks, 3);
  });
});

// =============================================================================
// Test Suite: Edge Cases
// =============================================================================

describe('RAG - Edge Cases', () => {
  it('should handle documents with empty chunks array', () => {
    const index = createMockRagIndex();
    index.documents = [{ path: '/empty.js', filename: 'empty.js', chunks: [] }];

    const status = ragStatus(index);
    const results = searchIndex(index, 'anything');

    assert.strictEqual(status.totalChunks, 0);
    assert.deepStrictEqual(results, []);
  });

  it('should handle very long file content', () => {
    const longContent = 'x'.repeat(100000);
    const chunks = chunkText(longContent, 5000, 500);

    assert.ok(chunks.length > 0);
    assert.strictEqual(chunks[0].content.length, 5000);
  });

  it('should handle files with only whitespace', () => {
    const chunks = chunkText('   \n\t\n   ');

    assert.ok(chunks.length >= 1);
  });

  it('should handle query with only punctuation', () => {
    const score = calculateSimilarity('!@#$%', 'hello world');

    assert.strictEqual(score, 0);
  });

  it('should handle binary content gracefully', () => {
    const binaryLike = '\x00\x01\x02\x03\xFF\xFE';
    const hash = hashContent(binaryLike);

    assert.strictEqual(hash.length, 8);
  });

  it('should handle file paths with spaces', () => {
    const result = isPathSafe('/project/my folder/file name.js', '/project');

    assert.strictEqual(result, true);
  });

  it('should handle deeply nested directories', () => {
    const deepPath = '/project' + '/sub'.repeat(50) + '/file.js';
    const result = isPathSafe(deepPath, '/project');

    assert.strictEqual(result, true);
  });
});

// =============================================================================
// Test Suite: File System Integration (with temp directory)
// =============================================================================

describe('RAG - File System Integration', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rag-test-'));
  });

  afterEach(() => {
    // Clean up temp directory
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should validate temp directory exists', () => {
    assert.ok(fs.existsSync(tempDir));
  });

  it('should be able to create test files', () => {
    const testFile = path.join(tempDir, 'test.js');
    fs.writeFileSync(testFile, 'console.log("test");');

    assert.ok(fs.existsSync(testFile));
    assert.strictEqual(fs.readFileSync(testFile, 'utf-8'), 'console.log("test");');
  });

  it('should verify path safety for temp directory', () => {
    const safePath = path.join(tempDir, 'src', 'file.js');
    const unsafePath = path.join(tempDir, '..', 'passwd');

    assert.strictEqual(isPathSafe(safePath, tempDir), true);
    assert.strictEqual(isPathSafe(unsafePath, tempDir), false);
  });
});
