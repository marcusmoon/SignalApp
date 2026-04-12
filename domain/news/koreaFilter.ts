import type { FinnhubNewsRaw } from '@/integrations/finnhub/types';

/**
 * Finnhub에 한국 전용 카테고리가 없어, 헤드라인·요약·관련 심볼에서 키워드로 좁힙니다.
 * (한국 전용 뉴스 API를 붙이면 이 단계를 교체하면 됩니다.)
 * `/iu` — ASCII 구간 대소문자 무시; 한글은 그대로 매칭.
 */
const KOREA_RE =
  /\b(korea|korean|kospi|kosdaq|krw|south\s+korea|seoul|pyongyang|한국|한국은행|증시|코스피|코스닥|삼성|현대|sk\s|lg\s|hanwha|posco|naver|kakao|mirae|lotte|celltrion|hyundai|korea\s+republic|bank\s+of\s+korea|samsung\s+electronics|sk\s+hynix|lg\s+energy(?:\s+solution)?|hyundai\s+motor|kb\s+financial|shinhan|samsung\s+biologics)\b|[₩]|KRW|🇰🇷/iu;

/** 설정 키워드: 제목·요약·related 전체에 부분 일치, 대소문자 무시 */
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
  items: FinnhubNewsRaw[],
  extraKeywords: string[] = [],
): FinnhubNewsRaw[] {
  const extras = extraKeywords.filter((s) => s.length > 0);
  const out: FinnhubNewsRaw[] = [];
  const seen = new Set<number>();
  for (const r of items) {
    if (seen.has(r.id)) continue;
    const text = `${r.headline}\n${r.summary}\n${r.related}`;
    if (KOREA_RE.test(text) || matchesExtraKeywords(text, extras)) {
      seen.add(r.id);
      out.push(r);
    }
  }
  return out.sort((a, b) => b.datetime - a.datetime);
}
