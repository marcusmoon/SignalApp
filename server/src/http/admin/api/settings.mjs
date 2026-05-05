import {
  ensureNewsSourcesFromItems,
  normalizeNewsSourceName,
  normalizeNewsSourceNameWithAliases,
  nowIso,
  readDb,
  listAdminUsers,
  createAdminUser,
  updateAdminUser,
  deleteAdminUser,
  updateDb,
} from '../../../db.mjs';
import { MARKET_LIST_KEYS, normalizeMarketSymbols, publicMarketList } from '../../../marketLists.mjs';
import { listProviderSettingsPublic, updateProviderSetting } from '../../../providerSettings.mjs';
import { translateNews } from '../../../providers/translation/index.mjs';
import { getMarketList, json, readBody } from '../../shared.mjs';

const SUPPORTED_PROVIDERS = ['finnhub', 'openai', 'claude', 'youtube', 'ninjas', 'coingecko'];

function adminUserErrorStatus(error) {
  const code = error instanceof Error ? error.message : String(error || '');
  if (code === 'ADMIN_USER_NOT_FOUND') return 404;
  if (code === 'ADMIN_USER_EXISTS') return 409;
  if (code.startsWith('ADMIN_USER_')) return 400;
  return 500;
}

export async function handleAdminSettingsRoutes({ req, res, url, pathname, adminId }) {
  if (req.method === 'GET' && pathname === '/admin/api/translation-settings') {
    const db = await readDb();
    json(res, 200, { data: db.translationSettings });
    return true;
  }

  if (req.method === 'GET' && pathname === '/admin/api/provider-settings') {
    json(res, 200, { data: await listProviderSettingsPublic() });
    return true;
  }

  if (req.method === 'GET' && pathname === '/admin/api/app-settings') {
    const db = await readDb();
    json(res, 200, { data: db.appSettings || null });
    return true;
  }

  if (req.method === 'PATCH' && pathname === '/admin/api/app-settings') {
    const patch = await readBody(req);
    const updated = await updateDb((db) => {
      const cur = db.appSettings && typeof db.appSettings === 'object' ? db.appSettings : {};
      const next = { ...cur };
      if (patch.marketQuotesMaxAgeSec != null) {
        const n = Number(patch.marketQuotesMaxAgeSec);
        if (Number.isFinite(n)) next.marketQuotesMaxAgeSec = Math.max(0, Math.min(300, Math.floor(n)));
      }
      next.updatedAt = nowIso();
      db.appSettings = next;
      return next;
    });
    json(res, 200, { data: updated });
    return true;
  }

  if (req.method === 'GET' && pathname === '/admin/api/admin-users') {
    json(res, 200, { data: await listAdminUsers() });
    return true;
  }

  if (req.method === 'POST' && pathname === '/admin/api/admin-users') {
    try {
      const body = await readBody(req);
      const created = await createAdminUser({
        id: body.id,
        password: body.password,
        active: body.active !== false,
      });
      json(res, 200, { data: created });
    } catch (error) {
      json(res, adminUserErrorStatus(error), { error: error instanceof Error ? error.message : String(error) });
    }
    return true;
  }

  const adminUserMatch = pathname.match(/^\/admin\/api\/admin-users\/([^/]+)$/);
  if (adminUserMatch && req.method === 'PATCH') {
    const id = decodeURIComponent(adminUserMatch[1]);
    const body = await readBody(req);
    if (id === adminId && body.active === false) {
      json(res, 400, { error: 'ADMIN_USER_SELF_DEACTIVATE' });
      return true;
    }
    try {
      const updated = await updateAdminUser(id, {
        active: typeof body.active === 'boolean' ? body.active : undefined,
        password: typeof body.password === 'string' ? body.password : undefined,
      });
      json(res, 200, { data: updated });
    } catch (error) {
      json(res, adminUserErrorStatus(error), { error: error instanceof Error ? error.message : String(error) });
    }
    return true;
  }

  if (adminUserMatch && req.method === 'DELETE') {
    const id = decodeURIComponent(adminUserMatch[1]);
    if (id === adminId) {
      json(res, 400, { error: 'ADMIN_USER_SELF_DELETE' });
      return true;
    }
    try {
      json(res, 200, { data: await deleteAdminUser(id) });
    } catch (error) {
      json(res, adminUserErrorStatus(error), { error: error instanceof Error ? error.message : String(error) });
    }
    return true;
  }

  if (req.method === 'GET' && pathname === '/admin/api/news-sources') {
    const db = await readDb();
    ensureNewsSourcesFromItems(db);
    const category = url.searchParams.get('category');
    const cat = category ? String(category).trim().toLowerCase() : '';
    const includeHidden = url.searchParams.get('includeHidden') === '1';
    const sources = [...(db.newsSources || [])]
      .map((s) => ({
        id: String(s.id || '').trim(),
        name: normalizeNewsSourceName(s.name),
        category: String(s.category || 'global'),
        hidden: s.hidden === true,
        enabled: s.enabled !== false,
        order: Number(s.order) || 0,
      }))
      .filter((s) => s.id && s.name)
      .filter((s) => (!cat ? true : s.category === cat))
      .filter((s) => (includeHidden ? true : !s.hidden))
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
    json(res, 200, { data: sources });
    return true;
  }

  if (req.method === 'GET' && pathname === '/admin/api/news-source-settings') {
    const db = await readDb();
    json(res, 200, { data: db.newsSourceSettings || null });
    return true;
  }

  if (req.method === 'PATCH' && pathname === '/admin/api/news-source-settings') {
    const patch = await readBody(req);
    const updated = await updateDb((db) => {
      const cur = db.newsSourceSettings && typeof db.newsSourceSettings === 'object' ? db.newsSourceSettings : {};
      const next = {
        ...cur,
        autoEnableNewSources: {
          ...(cur.autoEnableNewSources || {}),
          ...(patch.autoEnableNewSources && typeof patch.autoEnableNewSources === 'object' ? patch.autoEnableNewSources : {}),
        },
        aliases: {
          ...(cur.aliases || {}),
          ...(patch.aliases && typeof patch.aliases === 'object' ? patch.aliases : {}),
        },
        updatedAt: nowIso(),
      };
      db.newsSourceSettings = next;
      // Re-normalize catalog names when aliases change.
      ensureNewsSourcesFromItems(db);
      return next;
    });
    json(res, 200, { data: updated });
    return true;
  }

  if (req.method === 'PUT' && pathname === '/admin/api/news-sources') {
    const patch = await readBody(req);
    const items = Array.isArray(patch?.items) ? patch.items : [];
    const category = String(patch?.category || '').trim().toLowerCase();
    const updated = await updateDb((db) => {
      ensureNewsSourcesFromItems(db);
      const cur = Array.isArray(db.newsSources) ? db.newsSources : [];
      const byKey = new Map(cur.map((s) => [`${String(s.id || '').trim()}|${String(s.category || 'global')}`, s]));
      const seen = new Set();
      const next = [];
      let order = 0;

      for (const raw of items) {
        const id = String(raw?.id || '').trim();
        const cat = String(raw?.category || category || 'global').trim().toLowerCase() || 'global';
        const key = `${id}|${cat}`;
        if (!id || seen.has(key)) continue;
        const prevHit = byKey.get(key) || {};
        const name = normalizeNewsSourceName(raw?.name || prevHit?.name);
        if (!name) continue;
        seen.add(key);
        order += 1;
        next.push({
          ...prevHit,
          id,
          name: normalizeNewsSourceNameWithAliases(name, cat, db.newsSourceSettings),
          category: cat,
          enabled: raw?.enabled !== false,
          hidden: raw?.hidden === true,
          order: Number(raw?.order) || order,
          updatedAt: nowIso(),
        });
      }

      // Keep anything not explicitly mentioned (safety).
      for (const s of cur) {
        const id = String(s.id || '').trim();
        const cat = String(s.category || 'global');
        const key = `${id}|${cat}`;
        if (!id || seen.has(key)) continue;
        next.push({ ...s, enabled: s.enabled !== false });
      }

      next.sort(
        (a, b) =>
          String(a.category || 'global').localeCompare(String(b.category || 'global')) ||
          (Number(a.order) || 0) - (Number(b.order) || 0) ||
          String(a.name || '').localeCompare(String(b.name || '')),
      );
      // Normalize order within each category
      const counters = new Map();
      for (const s of next) {
        const c = String(s.category || 'global');
        const n = (counters.get(c) || 0) + 1;
        counters.set(c, n);
        s.order = n;
      }
      db.newsSources = next;
      return next.map((s) => ({
        id: String(s.id || '').trim(),
        name: normalizeNewsSourceName(s.name),
        category: String(s.category || 'global'),
        hidden: s.hidden === true,
        enabled: s.enabled !== false,
        order: Number(s.order) || 0,
      }));
    });
    json(res, 200, { data: updated });
    return true;
  }

  if (req.method === 'GET' && pathname === '/admin/api/ui-model-presets') {
    const db = await readDb();
    json(res, 200, { data: db.uiModelPresets || null });
    return true;
  }

  if (req.method === 'PATCH' && pathname === '/admin/api/ui-model-presets') {
    const patch = await readBody(req);
    const updated = await updateDb((db) => {
      const cur = db.uiModelPresets && typeof db.uiModelPresets === 'object' ? db.uiModelPresets : {};
      const next = {
        ...cur,
        openai: Array.isArray(patch.openai) ? patch.openai : cur.openai,
        claude: Array.isArray(patch.claude) ? patch.claude : cur.claude,
        mock: Array.isArray(patch.mock) ? patch.mock : cur.mock,
        updatedAt: nowIso(),
      };
      db.uiModelPresets = next;
      return next;
    });
    json(res, 200, { data: updated });
    return true;
  }

  if (req.method === 'GET' && pathname === '/admin/api/market-lists') {
    const db = await readDb();
    json(res, 200, { data: (db.marketLists || []).map(publicMarketList) });
    return true;
  }

  const marketListMatch = pathname.match(/^\/admin\/api\/market-lists\/([^/]+)$/);
  if (req.method === 'PATCH' && marketListMatch) {
    const key = decodeURIComponent(marketListMatch[1]);
    if (!MARKET_LIST_KEYS.includes(key)) {
      json(res, 400, { error: 'UNKNOWN_MARKET_LIST' });
      return true;
    }
    const patch = await readBody(req);
    const updated = await updateDb((db) => {
      const list = getMarketList(db, key);
      if (!list) throw new Error(`MARKET_LIST_NOT_FOUND:${key}`);
      if (typeof patch.displayName === 'string') list.displayName = patch.displayName.trim() || key;
      if (typeof patch.description === 'string') list.description = patch.description.trim();
      if (patch.symbols != null) list.symbols = normalizeMarketSymbols(patch.symbols);
      list.updatedAt = nowIso();
      return publicMarketList(list);
    });
    json(res, 200, { data: updated });
    return true;
  }

  const providerSettingMatch = pathname.match(/^\/admin\/api\/provider-settings\/([^/]+)$/);
  if (req.method === 'PATCH' && providerSettingMatch) {
    const provider = decodeURIComponent(providerSettingMatch[1]);
    if (!SUPPORTED_PROVIDERS.includes(provider)) {
      json(res, 400, { error: 'UNKNOWN_PROVIDER' });
      return true;
    }
    const patch = await readBody(req);
    const updated = await updateProviderSetting(provider, patch);
    json(res, 200, { data: updated });
    return true;
  }

  if (req.method === 'POST' && pathname === '/admin/api/translation-test') {
    const body = await readBody(req);
    const locale = body.locale || 'ko';
    const textValue = String(body.text || 'Signal 앱을 이용해 주셔서 감사합니다. 앞으로도 좋은 기능들을 업데이트하겠습니다.');
    const translated = await translateNews({
      locale,
      provider: body.provider,
      model: body.model,
      newsItem: {
        titleOriginal: textValue,
        summaryOriginal: textValue,
        contentOriginal: '',
        sourceName: 'Signal Admin',
      },
    });
    json(res, 200, { data: translated });
    return true;
  }

  const settingMatch = pathname.match(/^\/admin\/api\/translation-settings\/([^/]+)$/);
  if (req.method === 'PATCH' && settingMatch) {
    const locale = decodeURIComponent(settingMatch[1]);
    const patch = await readBody(req);
    const updated = await updateDb((db) => {
      let setting = db.translationSettings.find((s) => s.locale === locale);
      if (!setting) {
        setting = { locale, provider: 'mock', enabled: false, autoTranslateNews: false };
        db.translationSettings.push(setting);
      }
      for (const key of ['provider']) {
        if (typeof patch[key] === 'string') setting[key] = patch[key];
      }
      if ('model' in setting) delete setting.model;
      for (const key of ['enabled', 'autoTranslateNews']) {
        if (typeof patch[key] === 'boolean') setting[key] = patch[key];
      }
      setting.updatedAt = nowIso();
      return setting;
    });
    json(res, 200, { data: updated });
    return true;
  }

  return false;
}
