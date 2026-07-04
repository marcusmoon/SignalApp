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
  ninjas: { apiKey: config.ninjasKey },
  coingecko: { apiKey: '' },
  dart: { apiKey: config.dartApiKey },
};

const LLM_PROVIDERS = new Set(['openai', 'claude']);

/** Providers shown in Admin > Provider settings. */
export const PUBLIC_PROVIDER_SETTING_IDS = ['finnhub', 'openai', 'claude', 'youtube', 'ninjas', 'coingecko', 'dart'];

/** Providers allowed for PATCH /admin/api/provider-settings/:id (includes legacy ids). */
export const PATCHABLE_PROVIDER_SETTING_IDS = [...PUBLIC_PROVIDER_SETTING_IDS, 'sec', 'rss'];

export function maskSecret(value) {
  const s = String(value || '');
  if (!s) return '';
  if (s.length <= 8) return '••••';
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
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

export async function updateProviderSetting(provider, patch) {
  const id = String(provider || '').trim();
  const current = await getProviderSetting(id);
  const setting = normalizeProviderSetting(current, id);
  if (typeof patch.enabled === 'boolean') setting.enabled = patch.enabled;
  if (LLM_PROVIDERS.has(id) && typeof patch.defaultModel === 'string') setting.defaultModel = patch.defaultModel;
  if (!LLM_PROVIDERS.has(id) && 'defaultModel' in setting) delete setting.defaultModel;
  if (typeof patch.apiKey === 'string' && patch.apiKey.trim().length > 0) setting.apiKey = patch.apiKey.trim();
  if (patch.clearApiKey === true) setting.apiKey = '';
  setting.updatedAt = nowIso();
  await upsertProviderSetting(setting);
  return {
    provider: id,
    enabled: setting.enabled,
    hasApiKey: setting.apiKey.length > 0,
    maskedApiKey: maskSecret(setting.apiKey),
    ...(LLM_PROVIDERS.has(id) ? { defaultModel: setting.defaultModel } : {}),
    updatedAt: setting.updatedAt,
  };
}
