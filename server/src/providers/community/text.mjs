function decodeEntities(text) {
  return String(text || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => {
      const code = Number(n);
      return Number.isFinite(code) ? String.fromCharCode(code) : _;
    });
}

export function stripHtml(html) {
  return htmlToPlainText(html);
}

export function htmlToPlainText(html) {
  let text = String(html || '');
  text = text.replace(/<(br|BR)\s*\/?>/g, '\n');
  text = text.replace(/<\/p\s*>/gi, '\n\n');
  text = text.replace(/<\/div\s*>/gi, '\n');
  text = text.replace(/<\/li\s*>/gi, '\n');
  text = text.replace(/<li[^>]*>/gi, '• ');
  text = text.replace(/<[^>]+>/g, ' ');
  text = decodeEntities(text);
  text = text.replace(/[ \t\f\v]+/g, ' ');
  text = text.replace(/\n[ \t]+/g, '\n');
  text = text.replace(/\n{3,}/g, '\n\n');
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
    .trim();
}

export function saveDetailBody(post) {
  const blocks = Array.isArray(post?.content) ? post.content : [];
  return blocks
    .map((block) => (block?.type === 'text' ? String(block.content || '').trim() : ''))
    .filter(Boolean)
    .join('\n\n')
    .trim();
}

export async function mapWithConcurrency(items, limit, mapper) {
  const list = Array.isArray(items) ? items : [];
  if (list.length === 0) return [];
  const results = new Array(list.length);
  let nextIndex = 0;
  const workerCount = Math.min(Math.max(1, limit), list.length);

  async function worker() {
    while (nextIndex < list.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(list[index], index);
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}
