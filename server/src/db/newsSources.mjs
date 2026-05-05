import { nowIso } from './time.mjs';

function stableSourceId(name) {
  const s = String(name || '').trim().toLowerCase();
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return `src-${h.toString(16)}`;
}

export function normalizeNewsSourceName(raw) {
  const s = String(raw || '').trim();
  return s.length > 0 ? s : 'Unknown';
}

function aliasKey(raw) {
  return String(raw || '').trim().toLowerCase();
}

function normalizeNewsCategory(raw) {
  const c = String(raw || '').trim().toLowerCase();
  if (c === 'crypto') return 'crypto';
  // Treat unknown/legacy as global for app UX.
  return 'global';
}

export function normalizeNewsSourceNameWithAliases(raw, category, settings) {
  const name = normalizeNewsSourceName(raw);
  const cat = normalizeNewsCategory(category);
  const aliases = settings?.aliases && typeof settings.aliases === 'object' ? settings.aliases : null;
  const table = aliases && typeof aliases[cat] === 'object' ? aliases[cat] : null;
  const mapped = table ? table[aliasKey(name)] : null;
  return mapped ? normalizeNewsSourceName(mapped) : name;
}

export function ensureNewsSourcesFromItems(db) {
  if (!Array.isArray(db.newsSources)) db.newsSources = [];
  const list = db.newsSources;
  // Normalize legacy entries without category.
  for (const s of list) {
    if (!s) continue;
    if (!s.category) s.category = 'global';
    if (s.enabled == null) s.enabled = true;
    if (s.hidden == null) s.hidden = false;
  }

  const byKey = new Map(list.map((x) => [`${x.id}|${x.category || 'global'}`, x]));
  const maxOrderByCat = new Map();
  for (const s of list) {
    const cat = normalizeNewsCategory(s?.category);
    maxOrderByCat.set(cat, Math.max(maxOrderByCat.get(cat) || 0, Number(s?.order) || 0));
  }
  let changed = false;
  for (const item of db.newsItems || []) {
    const category = normalizeNewsCategory(item?.category);
    const name = normalizeNewsSourceNameWithAliases(item?.sourceName, category, db.newsSourceSettings);
    const id = stableSourceId(name);
    const key = `${id}|${category}`;
    if (byKey.has(key)) continue;
    const nextOrder = (maxOrderByCat.get(category) || 0) + 1;
    maxOrderByCat.set(category, nextOrder);
    const autoEnable =
      category === 'crypto'
        ? db.newsSourceSettings?.autoEnableNewSources?.crypto !== false
        : db.newsSourceSettings?.autoEnableNewSources?.global !== false;
    const row = {
      id,
      name,
      category,
      enabled: !!autoEnable,
      hidden: false,
      order: nextOrder,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    list.push(row);
    byKey.set(key, row);
    changed = true;
  }
  if (changed) {
    // keep deterministic order
    list.sort(
      (a, b) =>
        String(a.category || 'global').localeCompare(String(b.category || 'global')) ||
        (Number(a.order) || 0) - (Number(b.order) || 0) ||
        String(a.name).localeCompare(String(b.name)),
    );
  }
  return changed;
}
