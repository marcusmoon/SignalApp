import { config } from './config.mjs';
import { nowIso } from './db.mjs';
import {
  findProviderSetting,
  findProviderSettings,
  upsertProviderSetting,
} from './db/repositories/providerSettingsRepository.mjs';

const FALLBACKS = {
  finnhub: { apiKey: config.finnhubToken },
  openai: { apiKey: config.openaiApiKey, defaultModel: 'gpt-4o-mini' },
  claude: { apiKey: config.anthropicApiKey, defaultModel: 'claude-3-5-haiku-latest' },
  youtube: { apiKey: config.youtubeApiKey },
  dart: { apiKey: config.dartApiKey },
  tossinvest: {
    clientId: config.tossinvestClientId,
    clientSecret: config.tossinvestClientSecret,
    accountSeq: config.tossinvestAccountSeq,
    baseUrl: config.tossinvestApiBaseUrl,
  },
};

const LLM_PROVIDERS = new Set(['openai', 'claude']);
const TOSSINVEST_PROVIDER = 'tossinvest';

/** Providers shown in Admin > Provider settings. */
export const PUBLIC_PROVIDER_SETTING_IDS = ['finnhub', 'openai', 'claude', 'youtube', 'dart'];

/** Providers allowed for PATCH /admin/api/provider-settings/:id (includes legacy ids). */
export const PATCHABLE_PROVIDER_SETTING_IDS = [...PUBLIC_PROVIDER_SETTING_IDS, 'sec', 'rss', TOSSINVEST_PROVIDER];

export function maskSecret(value) {
  const s = String(value || '');
  if (!s) return '';
  if (s.length <= 8) return '••••';
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
}

function cleanAccountSeq(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

function normalizeProviderSetting(setting, provider) {
  const fallback = FALLBACKS[provider] || { apiKey: '' };
  const normalized = {
    provider,
    enabled: setting?.enabled !== false,
    apiKey: setting?.apiKey || fallback.apiKey || '',
    updatedAt: setting?.updatedAt || nowIso(),
  };
  if (LLM_PROVIDERS.has(provider)) {
    normalized.defaultModel = setting?.defaultModel ?? fallback.defaultModel ?? '';
  }
  if (provider === TOSSINVEST_PROVIDER) {
    normalized.clientId = String(setting?.clientId || fallback.clientId || '').trim();
    normalized.clientSecret = String(setting?.clientSecret || fallback.clientSecret || '').trim();
    normalized.accountSeq = cleanAccountSeq(setting?.accountSeq ?? fallback.accountSeq);
    normalized.baseUrl = String(setting?.baseUrl || fallback.baseUrl || '').trim();
    delete normalized.apiKey;
  }
  return normalized;
}

export async function getProviderSetting(provider) {
  const id = String(provider || '').trim();
  return normalizeProviderSetting(await findProviderSetting(id), id);
}

export async function listProviderSettingsPublic() {
  const providers = PUBLIC_PROVIDER_SETTING_IDS;
  const rows = await findProviderSettings(providers);
  const byProvider = new Map(rows.map((row) => [row.provider, row.payload]));
  return providers.map((provider) => {
    const setting = normalizeProviderSetting(byProvider.get(provider), provider);
    return {
      provider,
      enabled: setting.enabled,
      hasApiKey: setting.apiKey.length > 0,
      maskedApiKey: maskSecret(setting.apiKey),
      ...(LLM_PROVIDERS.has(provider) ? { defaultModel: setting.defaultModel } : {}),
      updatedAt: setting.updatedAt,
    };
  });
}

function publicTossInvestSetting(setting) {
  return {
    provider: TOSSINVEST_PROVIDER,
    enabled: setting.enabled,
    hasClientId: setting.clientId.length > 0,
    maskedClientId: maskSecret(setting.clientId),
    hasClientSecret: setting.clientSecret.length > 0,
    maskedClientSecret: maskSecret(setting.clientSecret),
    accountSeq: setting.accountSeq,
    baseUrl: setting.baseUrl || 'https://openapi.tossinvest.com',
    updatedAt: setting.updatedAt,
  };
}

export async function updateProviderSetting(provider, patch) {
  const id = String(provider || '').trim();
  const current = await getProviderSetting(id);
  const setting = normalizeProviderSetting(current, id);
  if (typeof patch.enabled === 'boolean') setting.enabled = patch.enabled;
  if (LLM_PROVIDERS.has(id) && typeof patch.defaultModel === 'string') setting.defaultModel = patch.defaultModel;
  if (!LLM_PROVIDERS.has(id) && 'defaultModel' in setting) delete setting.defaultModel;
  if (id === TOSSINVEST_PROVIDER) {
    if (typeof patch.clientId === 'string' && patch.clientId.trim().length > 0) setting.clientId = patch.clientId.trim();
    if (typeof patch.clientSecret === 'string' && patch.clientSecret.trim().length > 0) {
      setting.clientSecret = patch.clientSecret.trim();
    }
    if (patch.clearClientSecret === true) setting.clientSecret = '';
    if (patch.accountSeq != null) setting.accountSeq = cleanAccountSeq(patch.accountSeq);
    if (typeof patch.baseUrl === 'string') setting.baseUrl = patch.baseUrl.trim();
  } else {
    if (typeof patch.apiKey === 'string' && patch.apiKey.trim().length > 0) setting.apiKey = patch.apiKey.trim();
    if (patch.clearApiKey === true) setting.apiKey = '';
  }
  setting.updatedAt = nowIso();
  await upsertProviderSetting(setting);
  if (id === TOSSINVEST_PROVIDER) return publicTossInvestSetting(setting);
  return {
    provider: id,
    enabled: setting.enabled,
    hasApiKey: setting.apiKey.length > 0,
    maskedApiKey: maskSecret(setting.apiKey),
    ...(LLM_PROVIDERS.has(id) ? { defaultModel: setting.defaultModel } : {}),
    updatedAt: setting.updatedAt,
  };
}
