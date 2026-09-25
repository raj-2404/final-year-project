/**
 * CodeX Normalized Test Tree Data Structure
 * Level 3D — Test Tree & Hierarchy
 *
 * Maintains hierarchical test structures:
 * Project -> File -> Suite -> Test
 */

import { TestNodeType, TestStatus } from './testTypes.js';

export class TestTree {
  constructor() {
    this.nodes = new Map();
  }

  clear() {
    this.nodes.clear();
  }

  addNode(node) {
    if (!node || !node.id) return;
    const existing = this.nodes.get(node.id) || {};
    this.nodes.set(node.id, {
      id: node.id,
      name: node.name || 'Test',
      label: node.label || node.name || 'Test',
      type: node.type || TestNodeType.TEST,
      file: node.file || '',
      line: node.line || 1,
      column: node.column || 1,
      parentId: node.parentId || null,
      framework: node.framework || '',
      status: node.status || existing.status || TestStatus.UNKNOWN,
      duration: node.duration || existing.duration || '',
      message: node.message || existing.message || '',
      stackTrace: node.stackTrace || existing.stackTrace || '',
      children: existing.children || [],
    });

    // If has parent, link in parent's children
    if (node.parentId && this.nodes.has(node.parentId)) {
      const parent = this.nodes.get(node.parentId);
      if (!parent.children.includes(node.id)) {
        parent.children.push(node.id);
      }
    }
  }

  getNode(id) {
    return this.nodes.get(id) || null;
  }

  getAllNodes() {
    return Array.from(this.nodes.values());
  }

  getRootNodes() {
    return Array.from(this.nodes.values()).filter((n) => !n.parentId);
  }

  getChildren(parentId) {
    const parent = this.getNode(parentId);
    if (!parent) return [];
    return parent.children.map((id) => this.getNode(id)).filter(Boolean);
  }

  updateNodeStatus(id, status, details = {}) {
    const node = this.getNode(id);
    if (!node) return;
    node.status = status;
    if (details.duration !== undefined) node.duration = details.duration;
    if (details.message !== undefined) node.message = details.message;
    if (details.stackTrace !== undefined) node.stackTrace = details.stackTrace;
  }

  resetAllStatus(newStatus = TestStatus.UNKNOWN) {
    for (const node of this.nodes.values()) {
      node.status = newStatus;
      node.duration = '';
      node.message = '';
      node.stackTrace = '';
    }
  }

  getStats() {
    let passed = 0;
    let failed = 0;
    let skipped = 0;
    let running = 0;
    let total = 0;

    for (const node of this.nodes.values()) {
      if (node.type === TestNodeType.TEST) {
        total++;
        if (node.status === TestStatus.PASSED) passed++;
        else if (node.status === TestStatus.FAILED) failed++;
        else if (node.status === TestStatus.SKIPPED) skipped++;
        else if (node.status === TestStatus.RUNNING) running++;
      }
    }

    // If no leaf test nodes discovered yet, count test files
    if (total === 0) {
      for (const node of this.nodes.values()) {
        if (node.type === TestNodeType.FILE) {
          total++;
          if (node.status === TestStatus.PASSED) passed++;
          else if (node.status === TestStatus.FAILED) failed++;
          else if (node.status === TestStatus.SKIPPED) skipped++;
          else if (node.status === TestStatus.RUNNING) running++;
        }
      }
    }

    return { passed, failed, skipped, running, total };
  }
}
