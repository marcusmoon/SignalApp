import type { SignalApiNewsItem } from '@/integrations/signal-api/types';

/**
 * 한국 전용 카테고리가 없을 때, 제목·요약·심볼에서 키워드로 좁힙니다.
 * `/iu` — ASCII 구간 대소문자 무시; 한글은 그대로 매칭.
 */
const KOREA_RE =
  /\b(korea|korean|kospi|kosdaq|krw|south\s+korea|seoul|pyongyang|한국|한국은행|증시|코스피|코스닥|삼성|현대|sk\s|lg\s|hanwha|posco|naver|kakao|mirae|lotte|celltrion|hyundai|korea\s+republic|bank\s+of\s+korea|samsung\s+electronics|sk\s+hynix|lg\s+energy(?:\s+solution)?|hyundai\s+motor|kb\s+financial|shinhan|samsung\s+biologics)\b|[₩]|KRW|🇰🇷/iu;

/** 설정 키워드: 제목·요약·심볼 전체에 부분 일치, 대소문자 무시 */
function matchesExtraKeywords(text: string, extraKeywords: string[]): boolean {
  if (extraKeywords.length === 0) return false;
  const hay = text.toLowerCase();
  for (const k of extraKeywords) {
    if (hay.includes(k.toLowerCase())) return true;
  }
  return false;
}

/**
 * @param extraKeywords 설정에서 추가한 키워드(부분 일치, 대소문자 무시). 앱 내장 정규식과 OR로 결합됩니다.
 */
export function filterKoreaRelatedNews(
  items: SignalApiNewsItem[],
  extraKeywords: string[] = [],
): SignalApiNewsItem[] {
  const extras = extraKeywords.filter((s) => s.length > 0);
  const out: SignalApiNewsItem[] = [];
  const seen = new Set<string>();
  for (const r of items) {
    if (seen.has(r.id)) continue;
    const text = `${r.originalTitle || r.title}\n${r.originalSummary || r.summary}\n${(r.symbols || []).join(',')}`;
    if (KOREA_RE.test(text) || matchesExtraKeywords(text, extras)) {
      seen.add(r.id);
      out.push(r);
    }
  }
  return out.sort((a, b) => {
    const ta = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const tb = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    return tb - ta;
  });
}
