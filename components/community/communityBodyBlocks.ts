export type CommunityBodyBlock = {
  kind: 'paragraph' | 'bullet' | 'section';
  text: string;
};

const BULLET_RE = /^(?:[•▪\-*]|\d+\.)\s+/;
const SECTION_RE = /^\[[^\]]+\]$/;

export function communityBodyBlocks(body: string): CommunityBodyBlock[] {
  const trimmed = String(body || '').trim();
  if (!trimmed) return [];

  return trimmed
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      if (SECTION_RE.test(line)) return { kind: 'section' as const, text: line };
      if (BULLET_RE.test(line)) return { kind: 'bullet' as const, text: line };
      return { kind: 'paragraph' as const, text: line };
    });
}
