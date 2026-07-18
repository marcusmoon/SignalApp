import type { SignalApiBodyEntity } from '@/integrations/signal-api/types';

/** 본문 안 ingest `entities.name` 매칭 세그먼트 */
export type EntityLinkSegment =
  | { kind: 'plain'; text: string }
  | { kind: 'entity'; text: string; symbol: string };

type NameHit = {
  start: number;
  end: number;
  text: string;
  symbol: string;
};

function normalizeEntities(entities: SignalApiBodyEntity[] | null | undefined): SignalApiBodyEntity[] {
  if (!Array.isArray(entities)) return [];
  const out: SignalApiBodyEntity[] = [];
  const seen = new Set<string>();
  for (const row of entities) {
    const name = String(row?.name || '').trim();
    const symbol = String(row?.symbol || '').trim();
    if (!name || !symbol) continue;
    const key = `${name}\u0000${symbol.toUpperCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name, symbol });
  }
  // 긴 name 우선 — 부분 겹침 방지
  return out.sort((a, b) => b.name.length - a.name.length || a.name.localeCompare(b.name));
}

function collectNameHits(text: string, entities: SignalApiBodyEntity[]): NameHit[] {
  const hits: NameHit[] = [];
  for (const entity of entities) {
    const name = entity.name;
    if (!name) continue;
    let from = 0;
    while (from <= text.length - name.length) {
      const start = text.indexOf(name, from);
      if (start < 0) break;
      hits.push({
        start,
        end: start + name.length,
        text: text.slice(start, start + name.length),
        symbol: entity.symbol,
      });
      from = start + name.length;
    }
  }
  hits.sort((a, b) => a.start - b.start || b.end - a.end - (a.end - a.start));
  const picked: NameHit[] = [];
  for (const hit of hits) {
    if (picked.some((p) => hit.start < p.end && p.start < hit.end)) continue;
    picked.push(hit);
  }
  return picked.sort((a, b) => a.start - b.start);
}

/**
 * ingest `entities`의 name이 본문에 정확히 나타나면 entity 세그먼트로 분할.
 * 추측성 티커 스캔 없음 — name 매칭만.
 */
export function splitTextWithEntityLinks(
  input: string,
  entities: SignalApiBodyEntity[] | null | undefined,
): EntityLinkSegment[] {
  const text = String(input ?? '');
  if (!text) return [];
  const list = normalizeEntities(entities);
  if (list.length === 0) return [{ kind: 'plain', text }];

  const hits = collectNameHits(text, list);
  if (hits.length === 0) return [{ kind: 'plain', text }];

  const segments: EntityLinkSegment[] = [];
  let last = 0;
  for (const hit of hits) {
    if (hit.start > last) {
      segments.push({ kind: 'plain', text: text.slice(last, hit.start) });
    }
    segments.push({ kind: 'entity', text: hit.text, symbol: hit.symbol });
    last = hit.end;
  }
  if (last < text.length) {
    segments.push({ kind: 'plain', text: text.slice(last) });
  }
  return segments;
}
