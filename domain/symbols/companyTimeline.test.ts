import test from 'node:test';
import assert from 'node:assert/strict';
import { companyTimeline } from './companyTimeline.ts';
import type { SignalApiNewsDigestItem } from '../../integrations/signal-api/types.ts';
import type { NewsItem } from '../../types/signal.ts';

test('company timeline removes raw evidence duplication and excludes unrelated issues', () => {
  const issue = { id: 'digest', symbols: ['005930.KS'], title: 'Samsung result', summary: 'Context',
    sourceRefs: [{ id: 'source' }], generatedAt: '2026-09-21T01:00:00Z' } as SignalApiNewsDigestItem;
  const news = [{ id: 'source', titleKo: 'Source', publishedAt: '2026-09-21T00:00:00Z' },
    { id: 'other', titleKo: 'Other report', publishedAt: '2026-09-21T02:00:00Z' }] as NewsItem[];
  const rows = companyTimeline('KRX:005930', news, [], [issue, { ...issue, id: 'unrelated', symbols: ['NVDA'] }], []);
  assert.deepEqual(rows.map((row) => row.id), ['news:other', 'issue:digest']);
  assert.equal(rows[1].route, '/news-digest?id=digest');
});

test('company timeline is bounded and uses new facts for follow-up issues', () => {
  const issues = Array.from({ length: 20 }, (_, i) => ({ id: String(i), symbols: ['NVDA'], title: 'Result', summary: 'Context',
    changeType: 'update', changes: [{ text: 'New fact', sourceIds: [] }], sourceRefs: [], generatedAt: '2026-09-21T01:00:00Z' } as SignalApiNewsDigestItem));
  const rows = companyTimeline('NVDA', [], [], issues, []);
  assert.equal(rows.length, 16);
  assert.equal(rows[0].summary, 'New fact');
});
