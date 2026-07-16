/**
 * 본문 문자열 안의 부호 있는 변동률을 뷰잉 시 색칠하기 위한 토큰 분할.
 * 데이터 가공이 아니라 표시 전용이다.
 */

export type ChangeTintSegmentKind = 'plain' | 'up' | 'down';

export type ChangeTintSegment = {
  kind: ChangeTintSegmentKind;
  text: string;
};

/** +1.2% · -0.5% · (+2%) · ▲1% · 상승 2.3% · 1.2% 하락 등 */
const CHANGE_TOKEN_RE =
  /\(\s*[+-]\s*\d+(?:\.\d+)?\s*%\s*\)|[+-]\s*\d+(?:\.\d+)?\s*%|[▲△▼▽]\s*\d+(?:\.\d+)?\s*%|(?:상승|하락)\s*\d+(?:\.\d+)?\s*%|\d+(?:\.\d+)?\s*%\s*(?:상승|하락)/g;

function directionForToken(token: string): 'up' | 'down' | null {
  const compact = token.replace(/\s+/g, '');
  if (/[▲△]/.test(compact) || compact.includes('상승') || compact.includes('+')) return 'up';
  if (/[▼▽]/.test(compact) || compact.includes('하락') || compact.includes('-')) return 'down';
  return null;
}

export function splitTextWithSignedChangeTints(input: string): ChangeTintSegment[] {
  const text = String(input ?? '');
  if (!text) return [];

  const segments: ChangeTintSegment[] = [];
  let lastIndex = 0;
  CHANGE_TOKEN_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = CHANGE_TOKEN_RE.exec(text)) != null) {
    const token = match[0];
    const start = match.index;
    if (start > lastIndex) {
      segments.push({ kind: 'plain', text: text.slice(lastIndex, start) });
    }
    const direction = directionForToken(token);
    segments.push({
      kind: direction === 'up' ? 'up' : direction === 'down' ? 'down' : 'plain',
      text: token,
    });
    lastIndex = start + token.length;
  }
  if (lastIndex < text.length) {
    segments.push({ kind: 'plain', text: text.slice(lastIndex) });
  }
  return segments.length > 0 ? segments : [{ kind: 'plain', text }];
}

export function textHasSignedChangeTint(input: string): boolean {
  return splitTextWithSignedChangeTints(input).some((part) => part.kind === 'up' || part.kind === 'down');
}
