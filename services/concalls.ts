import { fetchEarningsCalendarRange } from '@/services/finnhub';
import { fetchEarningsCallTranscript } from '@/services/apiNinjas';
import { summarizeConcallTranscript } from '@/services/anthropic';
import { hasFinnhub } from '@/services/env';
import type { ConcallSummary } from '@/types/signal';
import { addDays } from '@/utils/date';

const YEARS_TRY = [new Date().getFullYear(), new Date().getFullYear() - 1];

export async function fetchConcallSummaries(maxItems = 3): Promise<ConcallSummary[]> {
  if (!hasFinnhub()) {
    throw new Error('FINNHUB_TOKEN_MISSING');
  }
  const from = new Date();
  const to = addDays(from, 21);
  const rows = await fetchEarningsCalendarRange(from, to);

  const symbols = Array.from(
    new Set(
      rows
        .map((r) => r.symbol)
        .filter(Boolean)
        .slice(0, maxItems * 2),
    ),
  ).slice(0, maxItems);

  const out: ConcallSummary[] = [];

  if (symbols.length === 0) {
    return [
      {
        id: 'empty-cal',
        ticker: '—',
        quarter: '—',
        bullets: [
          'Finnhub 실적 캘린더에 표시된 티커가 없습니다. 기간을 넓히거나 토큰 권한을 확인하세요.',
          '—',
        ],
        source: 'fallback',
      },
    ];
  }

  for (const sym of symbols) {
    let text: string | null = null;
    for (const y of YEARS_TRY) {
      text = await fetchEarningsCallTranscript(sym, y);
      if (text && text.length > 200) break;
    }

    const row = rows.find((r) => r.symbol === sym);
    const quarterLabel = row ? `FY${row.year} Q${row.quarter}` : '최근';

    if (!text || text.length < 200) {
      out.push({
        id: `${sym}-pending`,
        ticker: sym,
        quarter: quarterLabel,
        bullets: [
          'API Ninjas에서 해당 티커의 실적콜 트랜스크립트를 찾지 못했습니다.',
          'EXPO_PUBLIC_API_NINJAS_KEY와 티커·연도 조합을 확인하세요.',
        ],
        guidance: row ? `예정/발표일: ${row.date} (${row.hour})` : undefined,
        risk: undefined,
        source: 'fallback',
      });
      continue;
    }

    try {
      const summary = await summarizeConcallTranscript(sym, quarterLabel, text);
      out.push(summary);
    } catch {
      out.push({
        id: `${sym}-err`,
        ticker: sym,
        quarter: quarterLabel,
        bullets: ['요약 중 오류가 발생했습니다.', '—'],
        source: 'fallback',
      });
    }
  }

  return out;
}
