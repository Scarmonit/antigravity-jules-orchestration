// Tool Registry - Map-based lookup
const toolRegistry = new Map();

export function registerTool(name, handler) {
  toolRegistry.set(name, handler);
}

export function getTool(name) {
  return toolRegistry.get(name);
}

export function getToolRegistrySize() {
  return toolRegistry.size;
}

export function getAllTools() {
    return Array.from(toolRegistry.keys());
}
