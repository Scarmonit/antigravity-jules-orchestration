/**
 * Tool Registry Module
 * Centralized registry for all MCP tools
 */

const toolRegistry = new Map();

/**
 * Register a tool handler
 * @param {string} name - Tool name
 * @param {Function} handler - Tool handler function
 */
export function registerTool(name, handler) {
    if (toolRegistry.has(name)) {
        console.warn(`[ToolRegistry] Overwriting existing tool: ${name}`);
    }
    toolRegistry.set(name, handler);
}

/**
 * Get a tool handler by name
 * @param {string} name - Tool name
 * @returns {Function|undefined} Tool handler function
 */
export function getTool(name) {
    return toolRegistry.get(name);
}

/**
 * Get all registered tools
 * @returns {Map} Tool registry
 */
export function getAllTools() {
    return toolRegistry;
}

/**
 * Get tool count
 * @returns {number} Number of registered tools
 */
export function getToolCount() {
    return toolRegistry.size;
}

/**
 * Clear all tools (for testing)
 */
export function clearTools() {
    toolRegistry.clear();
}
