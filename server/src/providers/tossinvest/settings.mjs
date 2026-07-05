import { config } from '../../config.mjs';
import { getProviderSetting } from '../../providerSettings.mjs';

const DEFAULT_BASE_URL = 'https://openapi.tossinvest.com';

function cleanText(value) {
  return String(value || '').trim();
}

function cleanAccountSeq(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

/** @returns {{ enabled: boolean, clientId: string, clientSecret: string, accountSeq: number|null, baseUrl: string }} */
export async function getTossInvestSetting() {
  const stored = await getProviderSetting('tossinvest');
  const clientId = cleanText(stored.clientId) || cleanText(config.tossinvestClientId);
  const clientSecret = cleanText(stored.clientSecret) || cleanText(config.tossinvestClientSecret);
  const accountSeq = cleanAccountSeq(stored.accountSeq ?? config.tossinvestAccountSeq);
  const baseUrl = (cleanText(stored.baseUrl) || cleanText(config.tossinvestApiBaseUrl) || DEFAULT_BASE_URL).replace(/\/+$/, '');
  return {
    enabled: stored.enabled !== false,
    clientId,
    clientSecret,
    accountSeq,
    baseUrl,
  };
}

export async function assertTossInvestConfigured() {
  const setting = await getTossInvestSetting();
  if (!setting.enabled) throw new Error('TOSSINVEST_PROVIDER_DISABLED');
  if (!setting.clientId) throw new Error('TOSSINVEST_CLIENT_ID_MISSING');
  if (!setting.clientSecret) throw new Error('TOSSINVEST_CLIENT_SECRET_MISSING');
  return setting;
}

export async function assertTossInvestAccountConfigured() {
  const setting = await assertTossInvestConfigured();
  if (setting.accountSeq == null) throw new Error('TOSSINVEST_ACCOUNT_SEQ_MISSING');
  return setting;
}
