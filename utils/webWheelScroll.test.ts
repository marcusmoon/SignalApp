/**
 * Web wheel scroll — DOM View refs must set scrollTop (not Element.scrollTo with RN opts).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { scrollWebScrollableToY } from './webWheelScroll.ts';

function fakeNode(partial: { scrollTop?: number; scrollHeight?: number; clientHeight?: number }) {
  return {
    scrollTop: partial.scrollTop ?? 0,
    scrollHeight: partial.scrollHeight ?? 1000,
    clientHeight: partial.clientHeight ?? 400,
  };
}

describe('scrollWebScrollableToY', () => {
  it('sets scrollTop when instance is the DOM node (RN Web View ref)', () => {
    const node = Object.assign(fakeNode({ scrollTop: 10 }), {
      nodeType: 1,
      ownerDocument: {},
    });
    const next = scrollWebScrollableToY(node, node, 120);
    assert.equal(next, 120);
    assert.equal(node.scrollTop, 120);
  });

  it('does not rely on Element.scrollTo RN options (regression: wide home/market wheel)', () => {
    const calls: unknown[] = [];
    const node = Object.assign(fakeNode({ scrollTop: 0 }), {
      nodeType: 1,
      ownerDocument: {},
      scrollTo(opts: unknown) {
        calls.push(opts);
      },
    });
    scrollWebScrollableToY(node, node, 80);
    assert.equal(node.scrollTop, 80);
    assert.equal(calls.length, 0);
  });

  it('prefers scrollToOffset when present (lazy web scroll API)', () => {
    const node = fakeNode({ scrollTop: 0 });
    let offset = -1;
    const instance = {
      scrollToOffset: (opts: { offset: number }) => {
        offset = opts.offset;
        node.scrollTop = opts.offset;
      },
    };
    scrollWebScrollableToY(instance, node, 200);
    assert.equal(offset, 200);
    assert.equal(node.scrollTop, 200);
  });

  it('clamps to max scroll', () => {
    const node = Object.assign(fakeNode({ scrollTop: 0, scrollHeight: 500, clientHeight: 400 }), {
      nodeType: 1,
      ownerDocument: {},
    });
    scrollWebScrollableToY(node, node, 9999);
    assert.equal(node.scrollTop, 100);
  });
});
