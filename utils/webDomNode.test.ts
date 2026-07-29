import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isWebDomElement, resolveWebDomNode } from './webDomNode.ts';

describe('resolveWebDomNode', () => {
  it('returns null for empty refs', () => {
    assert.equal(resolveWebDomNode(null), null);
    assert.equal(resolveWebDomNode(undefined), null);
    assert.equal(resolveWebDomNode({}), null);
  });

  it('prefers getScrollableNode when it returns a DOM-like node', () => {
    const el = { nodeType: 1, ownerDocument: {}, tag: 'via-getter' };
    const ref = { getScrollableNode: () => el, nodeType: 1, ownerDocument: {}, tag: 'self' };
    assert.equal(resolveWebDomNode(ref), el);
  });

  it('falls back to the ref itself (RN Web View)', () => {
    const el = { nodeType: 1, ownerDocument: {}, tag: 'view-ref' };
    assert.equal(resolveWebDomNode(el), el);
  });

  it('ignores getScrollableNode that returns nothing', () => {
    const ref = {
      nodeType: 1,
      ownerDocument: {},
      tag: 'view-ref',
      getScrollableNode: () => null,
    };
    assert.equal(resolveWebDomNode(ref), ref);
  });
});

describe('isWebDomElement', () => {
  it('rejects plain objects without nodeType', () => {
    assert.equal(isWebDomElement({ scrollTop: 0 }), false);
  });
});
