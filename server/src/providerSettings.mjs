import { config } from './config.mjs';
import { readDb, updateDb, nowIso } from './db.mjs';

const FALLBACKS = {
  finnhub: { apiKey: config.finnhubToken, defaultModel: '' },
  openai: { apiKey: config.openaiApiKey, defaultModel: 'gpt-4o-mini' },
  claude: { apiKey: config.anthropicApiKey, defaultModel: 'claude-3-5-haiku-latest' },
  youtube: { apiKey: config.youtubeApiKey, defaultModel: '' },
  coingecko: { apiKey: '', defaultModel: '' },
};

export function maskSecret(value) {
  const s = String(value || '');
  if (!s) return '';
  if (s.length <= 8) return '••••';
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
}

function normalizeProviderSetting(setting, provider) {
  const fallback = FALLBACKS[provider] || { apiKey: '', defaultModel: '' };
  return {
    provider,
    enabled: setting?.enabled !== false,
    apiKey: setting?.apiKey || fallback.apiKey || '',
    defaultModel: setting?.defaultModel ?? fallback.defaultModel ?? '',
    updatedAt: setting?.updatedAt || nowIso(),
  };
}

export async function getProviderSetting(provider) {
  const db = await readDb();
  return normalizeProviderSetting(db.providerSettings?.find((s) => s.provider === provider), provider);
}

export async function listProviderSettingsPublic() {
  const db = await readDb();
  const providers = ['finnhub', 'openai', 'claude', 'youtube', 'coingecko'];
  return providers.map((provider) => {
    const setting = normalizeProviderSetting(db.providerSettings?.find((s) => s.provider === provider), provider);
    return {
      provider,
      enabled: setting.enabled,
      hasApiKey: setting.apiKey.length > 0,
      maskedApiKey: maskSecret(setting.apiKey),
      defaultModel: setting.defaultModel,
      updatedAt: setting.updatedAt,
    };
  });
}

export async function updateProviderSetting(provider, patch) {
  return updateDb((db) => {
    if (!Array.isArray(db.providerSettings)) db.providerSettings = [];
    let setting = db.providerSettings.find((s) => s.provider === provider);
    if (!setting) {
      setting = normalizeProviderSetting(null, provider);
      db.providerSettings.push(setting);
    }
    if (typeof patch.enabled === 'boolean') setting.enabled = patch.enabled;
    if (typeof patch.defaultModel === 'string') setting.defaultModel = patch.defaultModel;
    if (typeof patch.apiKey === 'string' && patch.apiKey.trim().length > 0) setting.apiKey = patch.apiKey.trim();
    if (patch.clearApiKey === true) setting.apiKey = '';
    setting.updatedAt = nowIso();
    return {
      provider,
      enabled: setting.enabled,
      hasApiKey: setting.apiKey.length > 0,
      maskedApiKey: maskSecret(setting.apiKey),
      defaultModel: setting.defaultModel,
      updatedAt: setting.updatedAt,
    };
  });
}
