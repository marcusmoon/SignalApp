import {
  normalizeNewsSourceName,
  normalizeNewsSourceNameWithAliases,
  nowIso,
  listCollectionPayloads,
  listAdminUsers,
  createAdminUser,
  updateAdminUser,
  deleteAdminUser,
  patchCollectionPayload,
  patchSingletonPayload,
  readSingletonPayload,
  replaceCollectionPayloads,
} from '../../../db.mjs';
import { normalizeSocialLoginRedirectPath } from '../../../auth/socialAuthConfig.mjs';
import { MARKET_LIST_KEYS, normalizeMarketSymbols, publicMarketList } from '../../../marketLists.mjs';
import { listProviderSettingsPublic, updateProviderSetting } from '../../../providerSettings.mjs';
import { translateNews } from '../../../providers/translation/index.mjs';
import { normalizeYoutubeCurationHandles, normalizeYoutubeHandle } from '../../../youtubeCuration.mjs';
import {
  ensureYoutubeChannelsCatalog,
  syncYoutubeCurationHandlesFromCatalog,
  youtubeChannelIdFromHandle,
} from '../../../db/youtubeChannels.mjs';
import { ensureRssSourcesCatalog, normalizeRssSource, publicRssSource } from '../../../db/rssSources.mjs';
import { json, readBody } from '../../shared.mjs';

const SUPPORTED_PROVIDERS = ['finnhub', 'openai', 'claude', 'youtube', 'ninjas', 'coingecko', 'sec', 'rss'];

/** Admin API only: never return raw third-party client secrets to the browser. */
function redactAppSettingsForAdminGet(settings) {
  if (!settings || typeof settings !== 'object') return settings;
  let out;
  try {
    out = JSON.parse(JSON.stringify(settings));
  } catch {
    return settings;
  }
  const social = out.socialAuth;
  if (social && typeof social === 'object') {
    for (const prov of ['kakao', 'naver']) {
      const row = social[prov];
      if (!row || typeof row !== 'object') continue;
      const secret = row.clientSecret;
      const nextRow = { ...row };
      delete nextRow.clientSecret;
      delete nextRow.clientSecretConfigured;
      if (typeof secret === 'string' && secret.length > 0) {
        nextRow.clientSecretConfigured = true;
      }
      social[prov] = nextRow;
    }
  }
  return out;
}

function stripSocialAuthClientMeta(socialAuth) {
  if (!socialAuth || typeof socialAuth !== 'object') return socialAuth;
  const strip = (row) => {
    if (!row || typeof row !== 'object') return row;
    const { clientSecretConfigured, ...rest } = row;
    return rest;
  };
  return {
    ...socialAuth,
    google: strip(socialAuth.google),
    apple: strip(socialAuth.apple),
    kakao: strip(socialAuth.kakao),
    naver: strip(socialAuth.naver),
  };
}

function adminUserErrorStatus(error) {
  const code = error instanceof Error ? error.message : String(error || '');
  if (code === 'ADMIN_USER_NOT_FOUND') return 404;
  if (code === 'ADMIN_USER_EXISTS') return 409;
  if (code.startsWith('ADMIN_USER_')) return 400;
  return 500;
}

export async function handleAdminSettingsRoutes({ req, res, url, pathname, adminId }) {
  if (req.method === 'GET' && pathname === '/admin/api/translation-settings') {
    json(res, 200, { data: await listCollectionPayloads('translationSettings') });
    return true;
  }

  if (req.method === 'GET' && pathname === '/admin/api/provider-settings') {
    json(res, 200, { data: await listProviderSettingsPublic() });
    return true;
  }

  if (req.method === 'GET' && pathname === '/admin/api/app-settings') {
    json(res, 200, { data: redactAppSettingsForAdminGet((await readSingletonPayload('appSettings')) || null) });
    return true;
  }

  if (req.method === 'PATCH' && pathname === '/admin/api/app-settings') {
    const patch = await readBody(req);
    const cur = (await readSingletonPayload('appSettings')) || {};
    const next = { ...cur };
    if (patch.marketQuotesMaxAgeSec != null) {
      const n = Number(patch.marketQuotesMaxAgeSec);
      if (Number.isFinite(n)) next.marketQuotesMaxAgeSec = Math.max(0, Math.min(300, Math.floor(n)));
    }
    if (patch.youtubeCurationHandles != null) {
      next.youtubeCurationHandles = normalizeYoutubeCurationHandles(patch.youtubeCurationHandles);
    }
    if (patch.socialAuth && typeof patch.socialAuth === 'object') {
      const prev = cur.socialAuth && typeof cur.socialAuth === 'object' ? cur.socialAuth : {};
      const p = stripSocialAuthClientMeta(patch.socialAuth);
      const mergeProv = (key) =>
        p[key] && typeof p[key] === 'object' ? { ...(prev[key] || {}), ...p[key] } : prev[key];
      const pathPatch =
        typeof p.socialLoginRedirectPath === 'string'
          ? p.socialLoginRedirectPath
          : typeof p.oauthRedirectPath === 'string'
            ? p.oauthRedirectPath
            : undefined;
      const prevSeg = normalizeSocialLoginRedirectPath(prev.socialLoginRedirectPath || prev.oauthRedirectPath || 'oauth');
      const normalizedRedirect =
        pathPatch !== undefined ? normalizeSocialLoginRedirectPath(pathPatch) : prevSeg;
      next.socialAuth = {
        ...prev,
        socialLoginRedirectPath: normalizedRedirect,
        oauthRedirectPath: normalizedRedirect,
        google: mergeProv('google'),
        apple: mergeProv('apple'),
        kakao: mergeProv('kakao'),
        naver: mergeProv('naver'),
      };
    }
    next.updatedAt = nowIso();
    const updated = await patchSingletonPayload('appSettings', next);
    json(res, 200, { data: redactAppSettingsForAdminGet(updated) });
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
    const category = url.searchParams.get('category');
    const cat = category ? String(category).trim().toLowerCase() : '';
    const includeHidden = url.searchParams.get('includeHidden') === '1';
    const sources = [...(await listCollectionPayloads('newsSources'))]
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
    json(res, 200, { data: (await readSingletonPayload('newsSourceSettings')) || null });
    return true;
  }

  if (req.method === 'PATCH' && pathname === '/admin/api/news-source-settings') {
    const patch = await readBody(req);
    const cur = (await readSingletonPayload('newsSourceSettings')) || {};
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
    const updated = await patchSingletonPayload('newsSourceSettings', next);
    json(res, 200, { data: updated });
    return true;
  }

  if (req.method === 'PUT' && pathname === '/admin/api/news-sources') {
    const patch = await readBody(req);
    const items = Array.isArray(patch?.items) ? patch.items : [];
    const category = String(patch?.category || '').trim().toLowerCase();
    const newsSourceSettings = (await readSingletonPayload('newsSourceSettings')) || {};
    const cur = await listCollectionPayloads('newsSources');
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
        name: normalizeNewsSourceNameWithAliases(name, cat, newsSourceSettings),
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
    // Normalize order within each category.
    const counters = new Map();
    for (const s of next) {
      const c = String(s.category || 'global');
      const n = (counters.get(c) || 0) + 1;
      counters.set(c, n);
      s.order = n;
    }
    await replaceCollectionPayloads('newsSources', next);
    const updated = next.map((s) => ({
      id: String(s.id || '').trim(),
      name: normalizeNewsSourceName(s.name),
      category: String(s.category || 'global'),
      hidden: s.hidden === true,
      enabled: s.enabled !== false,
      order: Number(s.order) || 0,
    }));
    json(res, 200, { data: updated });
    return true;
  }

  if (req.method === 'GET' && pathname === '/admin/api/youtube-channels') {
    const includeHidden = url.searchParams.get('includeHidden') === '1';
    const appSettings = (await readSingletonPayload('appSettings')) || {};
    ensureYoutubeChannelsCatalog(appSettings);
    const channels = [...(appSettings.youtubeChannels || [])]
      .map((c) => ({
        id: String(c.id || '').trim(),
        handle: normalizeYoutubeHandle(c.handle),
        title: String(c.title || '').trim() || `@${normalizeYoutubeHandle(c.handle)}`,
        enabled: c.enabled !== false,
        hidden: c.hidden === true,
        order: Number(c.order) || 0,
      }))
      .filter((c) => c.id && c.handle)
      .filter((c) => (includeHidden ? true : !c.hidden))
      .sort((a, b) => a.order - b.order || a.handle.localeCompare(b.handle));
    json(res, 200, { data: channels });
    return true;
  }

  if (req.method === 'PUT' && pathname === '/admin/api/youtube-channels') {
    const patch = await readBody(req);
    const items = Array.isArray(patch?.items) ? patch.items : [];
    const appSettings = (await readSingletonPayload('appSettings')) || {};
    const cur = ensureYoutubeChannelsCatalog(appSettings);
    const byId = new Map(cur.map((c) => [String(c.id || '').trim(), c]));
    const next = [];
    const seen = new Set();
    let order = 0;
    for (const raw of items) {
      const handle = normalizeYoutubeHandle(raw?.handle || raw?.id);
      if (!handle) continue;
      const id = String(raw?.id || '').trim() || youtubeChannelIdFromHandle(handle);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      order += 1;
      const prev = byId.get(id);
      next.push({
        id,
        handle,
        title: String(raw?.title || prev?.title || `@${handle}`).trim() || `@${handle}`,
        enabled: raw?.enabled !== false,
        hidden: raw?.hidden === true,
        order,
        updatedAt: nowIso(),
      });
    }
    for (const c of cur) {
      const id = String(c.id || '').trim();
      if (!id || seen.has(id)) continue;
      next.push({ ...c, order: (order += 1) });
      seen.add(id);
    }
    appSettings.youtubeChannels = next;
    syncYoutubeCurationHandlesFromCatalog(appSettings);
    appSettings.updatedAt = nowIso();
    const updatedSettings = await patchSingletonPayload('appSettings', appSettings);
    const updated = updatedSettings.youtubeChannels || [];
    const channels = [...(updated || [])]
      .map((c) => ({
        id: String(c.id || '').trim(),
        handle: normalizeYoutubeHandle(c.handle),
        title: String(c.title || '').trim() || `@${normalizeYoutubeHandle(c.handle)}`,
        enabled: c.enabled !== false,
        hidden: c.hidden === true,
        order: Number(c.order) || 0,
      }))
      .filter((c) => c.id && c.handle)
      .sort((a, b) => a.order - b.order || a.handle.localeCompare(b.handle));
    json(res, 200, { data: channels });
    return true;
  }

  if (req.method === 'GET' && pathname === '/admin/api/rss-sources') {
    const includeHidden = url.searchParams.get('includeHidden') === '1';
    const db = { rssSources: await listCollectionPayloads('rssSources') };
    const rows = ensureRssSourcesCatalog(db)
      .map(publicRssSource)
      .filter((source) => (includeHidden ? true : !source.hidden))
      .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0) || a.name.localeCompare(b.name));
    json(res, 200, { data: rows });
    return true;
  }

  if (req.method === 'PUT' && pathname === '/admin/api/rss-sources') {
    const patch = await readBody(req);
    const items = Array.isArray(patch?.items) ? patch.items : [];
    const db = { rssSources: await listCollectionPayloads('rssSources') };
    const cur = ensureRssSourcesCatalog(db);
    const byId = new Map(cur.map((source) => [String(source.id || ''), source]));
    const next = [];
    const seen = new Set();
    let order = 0;
    for (const raw of items) {
      const normalized = normalizeRssSource(raw, order);
      if (!normalized.id || !normalized.feedUrl || seen.has(normalized.id)) continue;
      const prev = byId.get(normalized.id) || {};
      order += 1;
      next.push({
        ...prev,
        ...normalized,
        order,
        createdAt: prev.createdAt || normalized.createdAt || nowIso(),
        updatedAt: nowIso(),
      });
      seen.add(normalized.id);
    }
    await replaceCollectionPayloads('rssSources', next);
    const updated = next.map(publicRssSource);
    json(res, 200, { data: updated });
    return true;
  }

  if (req.method === 'GET' && pathname === '/admin/api/ui-model-presets') {
    json(res, 200, { data: (await readSingletonPayload('uiModelPresets')) || null });
    return true;
  }

  if (req.method === 'PATCH' && pathname === '/admin/api/ui-model-presets') {
    const patch = await readBody(req);
    const cur = (await readSingletonPayload('uiModelPresets')) || {};
    const next = {
      ...cur,
      openai: Array.isArray(patch.openai) ? patch.openai : cur.openai,
      claude: Array.isArray(patch.claude) ? patch.claude : cur.claude,
      mock: Array.isArray(patch.mock) ? patch.mock : cur.mock,
      updatedAt: nowIso(),
    };
    const updated = await patchSingletonPayload('uiModelPresets', next);
    json(res, 200, { data: updated });
    return true;
  }

  if (req.method === 'GET' && pathname === '/admin/api/market-lists') {
    json(res, 200, { data: (await listCollectionPayloads('marketLists')).map(publicMarketList) });
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
    const lists = await listCollectionPayloads('marketLists');
    const list = lists.find((item) => item.key === key);
    if (!list) throw new Error(`MARKET_LIST_NOT_FOUND:${key}`);
    const next = { ...list };
    if (typeof patch.displayName === 'string') next.displayName = patch.displayName.trim() || key;
    if (typeof patch.description === 'string') next.description = patch.description.trim();
    if (patch.symbols != null) next.symbols = normalizeMarketSymbols(patch.symbols);
    next.updatedAt = nowIso();
    const updated = publicMarketList(await patchCollectionPayload('marketLists', key, next));
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
    const settings = await listCollectionPayloads('translationSettings');
    const current = settings.find((s) => s.locale === locale) || { locale, provider: 'mock', enabled: false, autoTranslateNews: false };
    const next = { ...current };
    for (const key of ['provider']) {
      if (typeof patch[key] === 'string') next[key] = patch[key];
    }
    next.model = null;
    for (const key of ['enabled', 'autoTranslateNews']) {
      if (typeof patch[key] === 'boolean') next[key] = patch[key];
    }
    next.updatedAt = nowIso();
    const updated = await patchCollectionPayload('translationSettings', locale, next);
    json(res, 200, { data: updated });
    return true;
  }

  return false;
}
