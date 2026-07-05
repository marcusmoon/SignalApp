import { clearSignalMarketCache } from '@/integrations/signal-api/cache/marketCache';

/** @deprecated 시세 캐시는 integrations/signal-api/cache/marketCache 에 위임 */
export function clearQuotesCache(): void {
  clearSignalMarketCache();
}
