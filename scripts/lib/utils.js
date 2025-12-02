/**
 * utils.js - Shared utilities for repository audit scripts
 */

/**
 * Remove UTF-8 BOM from string content
 * @param {string} content - String content that may contain BOM
 * @returns {string} Content with BOM removed
 */
export function removeBOM(content) {
  if (typeof content !== 'string') return content;
  return content.replace(/^\uFEFF/, '');
}

/**
 * Safely parse JSON with BOM handling
 * @param {string} content - JSON string content
 * @returns {object|null} Parsed JSON or null on error
 */
export function safeParseJSON(content) {
  try {
    return JSON.parse(removeBOM(content));
  } catch {
    return null;
  }
}

/**
 * Check if a string contains tabs (invalid for YAML)
 * @param {string} content - YAML content
 * @returns {boolean} True if contains tabs
 */
export function containsTabs(content) {
  return content.includes('\t');
}

export default { removeBOM, safeParseJSON, containsTabs };
