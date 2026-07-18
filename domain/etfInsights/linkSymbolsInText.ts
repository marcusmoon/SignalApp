import { etfInsightDisplayTicker } from '@/domain/etfInsights/openSymbol';

/** 본문 안 알려진 티커를 링크로 나누기 위한 토큰 */
export type SymbolLinkSegment =
  | { kind: 'plain'; text: string }
  | { kind: 'symbol'; text: string; symbol: string };

type AliasHit = {
  start: number;
  end: number;
  text: string;
  symbol: string;
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 심볼별 본문 매칭 별칭 (원문·표시 티커·대소문자 변형) */
export function symbolLinkAliases(symbol: string): string[] {
  const raw = String(symbol || '').trim();
  if (!raw) return [];
  const upper = raw.toUpperCase();
  const display = etfInsightDisplayTicker(raw);
  const out = new Set<string>();
  for (const candidate of [raw, upper, display, display.toUpperCase()]) {
    const t = candidate.trim();
    if (t) out.add(t);
  }
  return [...out].sort((a, b) => b.length - a.length);
}

function isBoundaryChar(ch: string | undefined): boolean {
  if (ch == null || ch === '') return true;
  // 한글·영문·숫자·`.` 가 이어지면 같은 토큰으로 본다
  return !/^[A-Za-z0-9.]$/u.test(ch);
}

function collectAliasHits(text: string, symbols: string[]): AliasHit[] {
  const hits: AliasHit[] = [];
  const seen = new Set<string>();

  for (const symbol of symbols) {
    const trimmed = String(symbol || '').trim();
    if (!trimmed || seen.has(trimmed.toUpperCase())) continue;
    seen.add(trimmed.toUpperCase());

    for (const alias of symbolLinkAliases(trimmed)) {
      const re = new RegExp(escapeRegExp(alias), 'gi');
      let match: RegExpExecArray | null;
      while ((match = re.exec(text)) != null) {
        const start = match.index;
        const end = start + match[0].length;
        const before = text[start - 1];
        const after = text[end];
        if (!isBoundaryChar(before) || !isBoundaryChar(after)) {
          if (match[0].length === 0) re.lastIndex += 1;
          continue;
        }
        hits.push({ start, end, text: match[0], symbol: trimmed });
        if (match[0].length === 0) re.lastIndex += 1;
      }
    }
  }

  hits.sort((a, b) => a.start - b.start || b.end - a.end - (a.end - a.start));
  const picked: AliasHit[] = [];
  for (const hit of hits) {
    if (picked.some((p) => hit.start < p.end && p.start < hit.end)) continue;
    picked.push(hit);
  }
  return picked.sort((a, b) => a.start - b.start);
}

/**
 * `symbols`에 있는 티커가 본문에 나타나면 symbol 세그먼트로 분할한다.
 * (테마 `etfs` 등 — 추측성 전역 티커 스캔은 하지 않음)
 */
export function splitTextWithSymbolLinks(
  input: string,
  symbols: string[] | null | undefined,
): SymbolLinkSegment[] {
  const text = String(input ?? '');
  if (!text) return [];
  const list = Array.isArray(symbols) ? symbols.map((s) => String(s || '').trim()).filter(Boolean) : [];
  if (list.length === 0) return [{ kind: 'plain', text }];

  const hits = collectAliasHits(text, list);
  if (hits.length === 0) return [{ kind: 'plain', text }];

  const segments: SymbolLinkSegment[] = [];
  let last = 0;
  for (const hit of hits) {
    if (hit.start > last) {
      segments.push({ kind: 'plain', text: text.slice(last, hit.start) });
    }
    segments.push({ kind: 'symbol', text: hit.text, symbol: hit.symbol });
    last = hit.end;
  }
  if (last < text.length) {
    segments.push({ kind: 'plain', text: text.slice(last) });
  }
  return segments;
}
