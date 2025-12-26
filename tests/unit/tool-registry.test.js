/**
 * Unit Tests for Tool Registry
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { registerTool, getTool, getAllTools, clearTools, getToolCount } from '../../lib/tool-registry.js';

describe('Tool Registry', () => {
    beforeEach(() => {
        clearTools();
    });

    it('should register a tool', () => {
        const handler = () => 'test';
        registerTool('test_tool', handler);

        assert.strictEqual(getTool('test_tool'), handler);
        assert.strictEqual(getToolCount(), 1);
    });

    it('should retrieve all tools', () => {
        registerTool('tool1', () => {});
        registerTool('tool2', () => {});

        const tools = getAllTools();
        assert.strictEqual(tools.size, 2);
        assert.ok(tools.has('tool1'));
        assert.ok(tools.has('tool2'));
    });

    it('should return undefined for unknown tool', () => {
        assert.strictEqual(getTool('unknown_tool'), undefined);
    });

    it('should overwrite existing tool with warning', () => {
        const handler1 = () => '1';
        const handler2 = () => '2';

        registerTool('test_tool', handler1);
        registerTool('test_tool', handler2);

        assert.strictEqual(getTool('test_tool'), handler2);
    });

    it('should clear tools', () => {
        registerTool('tool1', () => {});
        clearTools();
        assert.strictEqual(getToolCount(), 0);
    });
});
