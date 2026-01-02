// O(1) Tool Registry - Map-based lookup replaces O(n) switch statement

export class ToolRegistry {
  constructor() {
    this.registry = new Map();
  }

  register(name, handler) {
    this.registry.set(name, handler);
  }

  get(name) {
    return this.registry.get(name);
  }

  get size() {
    return this.registry.size;
  }

  has(name) {
    return this.registry.has(name);
  }

  listTools() {
    return Array.from(this.registry.keys());
  }
}

export const toolRegistry = new ToolRegistry();
export default toolRegistry;
