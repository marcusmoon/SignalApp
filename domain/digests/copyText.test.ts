import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { formatDigestCopyText } from './copyText.ts';

describe('formatDigestCopyText', () => {
  it('returns empty when both blank', () => {
    assert.equal(formatDigestCopyText({}), '');
    assert.equal(formatDigestCopyText({ title: '  ', summary: '' }), '');
  });

  it('returns title only when summary missing or identical', () => {
    assert.equal(formatDigestCopyText({ title: '헤드라인' }), '헤드라인');
    assert.equal(formatDigestCopyText({ title: 'Same', summary: 'Same' }), 'Same');
  });

  it('joins title and summary with a blank line', () => {
    assert.equal(
      formatDigestCopyText({ title: '제목', summary: '요약 본문입니다.' }),
      '제목\n\n요약 본문입니다.',
    );
  });

  it('returns summary alone when title empty', () => {
    assert.equal(formatDigestCopyText({ summary: '요약만' }), '요약만');
  });
});
