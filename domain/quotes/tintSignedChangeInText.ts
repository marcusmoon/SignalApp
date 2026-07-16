/**
 * 본문 문자열 안의 변동률을 뷰잉 시 색칠하기 위한 토큰 분할.
 * 데이터 가공이 아니라 표시 전용이다.
 *
 * - 부호·화살표·인접 상승/하락 표현: `+1.2%`, `-0.5%`, `▲1%`, `2.78% 상승`
 * - 부호 없는 `%`: 근처(전후 짧은 창)에 방향 힌트가 있을 때만 칠함 (`장중 2.78%까지 올랐다`)
 * - 점유·비중·지분 등 비변동 `%`는 제외
 */

export type ChangeTintSegmentKind = 'plain' | 'up' | 'down';

export type ChangeTintSegment = {
  kind: ChangeTintSegmentKind;
  text: string;
};

const UP_WORDS =
  '상승|급등|올랐다|올랐|오른|올라|반등|강세|뛰었|상승폭|상승률|gain(?:ed|s)?|rose|rally|surges?|climbs?';
const DOWN_WORDS =
  '하락|급락|내렸다|내렸|내린|내려|약세|빠진|밀렸|하락폭|하락률|fell|falls|drop(?:ped|s)?|declin(?:e|ed|es)|lost';

/** +1.2% · -0.5% · (+2%) · ▲1% · 상승 2.3% · 1.2% 하락 · 2.78% 급등 등 */
const SIGNED_OR_LABELED_CHANGE_RE = new RegExp(
  [
    String.raw`\(\s*[+-]\s*\d+(?:\.\d+)?\s*%\s*\)`,
    String.raw`[+-]\s*\d+(?:\.\d+)?\s*%`,
    String.raw`[▲△▼▽]\s*\d+(?:\.\d+)?\s*%`,
    String.raw`(?:${UP_WORDS}|${DOWN_WORDS}|up|down)\s*\d+(?:\.\d+)?\s*%`,
    String.raw`\d+(?:\.\d+)?\s*%\s*(?:${UP_WORDS}|${DOWN_WORDS}|up|down)`,
  ].join('|'),
  'gi'
);

/** 부호·라벨 없이 단독으로 쓰인 퍼센트 */
const BARE_PERCENT_RE = /\d+(?:\.\d+)?\s*%/g;

const UP_HINT_RE = new RegExp(UP_WORDS + '|\\bup\\b', 'i');
const DOWN_HINT_RE = new RegExp(DOWN_WORDS + '|\\bdown\\b', 'i');
const NON_CHANGE_BEFORE_RE =
  /(?:점유(?:율)?|비중|지분|배당(?:률|성향)?|금리|세금|할인(?:율)?|요율|확률|실업(?:률)?|인플레|성장률)\s*$/u;
const NON_CHANGE_AFTER_RE = /^(?:\s*(?:점유(?:율)?|비중|지분))/u;

const CONTEXT_WINDOW = 28;

function directionForLabeledToken(token: string): 'up' | 'down' | null {
  const compact = token.replace(/\s+/g, '');
  if (/[▲△]/.test(compact) || UP_HINT_RE.test(compact) || compact.includes('+')) return 'up';
  if (/[▼▽]/.test(compact) || DOWN_HINT_RE.test(compact) || compact.includes('-') || compact.includes('−')) {
    return 'down';
  }
  return null;
}

function isNonChangePercent(text: string, start: number, end: number): boolean {
  const before = text.slice(Math.max(0, start - 16), start);
  const after = text.slice(end, Math.min(text.length, end + 10));
  return NON_CHANGE_BEFORE_RE.test(before) || NON_CHANGE_AFTER_RE.test(after);
}

function closestHintDistance(haystack: string, pattern: RegExp, fromEnd: boolean): number | null {
  const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);
  let best: number | null = null;
  for (const match of haystack.matchAll(re)) {
    const dist = fromEnd ? haystack.length - (match.index + match[0].length) : match.index;
    if (best == null || dist < best) best = dist;
  }
  return best;
}

function directionFromNearbyContext(text: string, start: number, end: number): 'up' | 'down' | null {
  const before = text.slice(Math.max(0, start - CONTEXT_WINDOW), start);
  const after = text.slice(end, Math.min(text.length, end + CONTEXT_WINDOW));

  const upBefore = closestHintDistance(before, UP_HINT_RE, true);
  const downBefore = closestHintDistance(before, DOWN_HINT_RE, true);
  const upAfter = closestHintDistance(after, UP_HINT_RE, false);
  const downAfter = closestHintDistance(after, DOWN_HINT_RE, false);

  type Cand = { dir: 'up' | 'down'; dist: number };
  const cands: Cand[] = [];
  if (upBefore != null) cands.push({ dir: 'up', dist: upBefore });
  if (downBefore != null) cands.push({ dir: 'down', dist: downBefore });
  if (upAfter != null) cands.push({ dir: 'up', dist: upAfter });
  if (downAfter != null) cands.push({ dir: 'down', dist: downAfter });
  if (cands.length === 0) return null;
  cands.sort((a, b) => a.dist - b.dist);
  return cands[0].dir;
}

type Span = { start: number; end: number; kind: 'up' | 'down'; text: string };

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

function collectLabeledSpans(text: string): Span[] {
  const spans: Span[] = [];
  SIGNED_OR_LABELED_CHANGE_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = SIGNED_OR_LABELED_CHANGE_RE.exec(text)) != null) {
    const token = match[0];
    const start = match.index;
    const end = start + token.length;
    const direction = directionForLabeledToken(token);
    if (!direction) continue;
    spans.push({ start, end, kind: direction, text: token });
    if (token.length === 0) SIGNED_OR_LABELED_CHANGE_RE.lastIndex += 1;
  }
  return spans;
}

function collectBarePercentSpans(text: string, labeled: Span[]): Span[] {
  const spans: Span[] = [];
  BARE_PERCENT_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = BARE_PERCENT_RE.exec(text)) != null) {
    const token = match[0];
    const start = match.index;
    const end = start + token.length;
    if (labeled.some((s) => overlaps(start, end, s.start, s.end))) continue;
    if (isNonChangePercent(text, start, end)) continue;
    const direction = directionFromNearbyContext(text, start, end);
    if (!direction) continue;
    spans.push({ start, end, kind: direction, text: token });
  }
  return spans;
}

function spansToSegments(text: string, spans: Span[]): ChangeTintSegment[] {
  const ordered = [...spans].sort((a, b) => a.start - b.start);
  const segments: ChangeTintSegment[] = [];
  let lastIndex = 0;
  for (const span of ordered) {
    if (span.start < lastIndex) continue;
    if (span.start > lastIndex) {
      segments.push({ kind: 'plain', text: text.slice(lastIndex, span.start) });
    }
    segments.push({ kind: span.kind, text: span.text });
    lastIndex = span.end;
  }
  if (lastIndex < text.length) {
    segments.push({ kind: 'plain', text: text.slice(lastIndex) });
  }
  return segments.length > 0 ? segments : [{ kind: 'plain', text }];
}

export function splitTextWithSignedChangeTints(input: string): ChangeTintSegment[] {
  const text = String(input ?? '');
  if (!text) return [];

  const labeled = collectLabeledSpans(text);
  const bare = collectBarePercentSpans(text, labeled);
  return spansToSegments(text, [...labeled, ...bare]);
}

export function textHasSignedChangeTint(input: string): boolean {
  return splitTextWithSignedChangeTints(input).some((part) => part.kind === 'up' || part.kind === 'down');
}
