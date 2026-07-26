export * from '@/integrations/signal-api/cache/calendarCache';
export * from '@/integrations/signal-api/cache/communityCache';
export * from '@/integrations/signal-api/cache/disclosuresCache';
export * from '@/integrations/signal-api/cache/disclosureDigestsCache';
export * from '@/integrations/signal-api/cache/marketBriefingsCache';
export * from '@/integrations/signal-api/cache/marketCache';
export * from '@/integrations/signal-api/cache/newsCache';
export * from '@/integrations/signal-api/cache/newsDigestsCache';
export * from '@/integrations/signal-api/cache/todayBriefingsCache';
export * from '@/integrations/signal-api/cache/etfInsightsCache';
export * from '@/integrations/signal-api/cache/screenerCache';
export * from '@/integrations/signal-api/cache/notificationsCache';
export * from '@/integrations/signal-api/cache/youtubeCache';

import { clearSignalCalendarCache } from '@/integrations/signal-api/cache/calendarCache';
import { clearSignalCommunityCache } from '@/integrations/signal-api/cache/communityCache';
import { clearSignalDisclosuresCache } from '@/integrations/signal-api/cache/disclosuresCache';
import { clearSignalDisclosureDigestsCache } from '@/integrations/signal-api/cache/disclosureDigestsCache';
import { clearSignalMarketBriefingsCache } from '@/integrations/signal-api/cache/marketBriefingsCache';
import { clearSignalMarketCache } from '@/integrations/signal-api/cache/marketCache';
import { clearSignalNewsCache } from '@/integrations/signal-api/cache/newsCache';
import { clearSignalNewsDigestsCache } from '@/integrations/signal-api/cache/newsDigestsCache';
import { clearSignalTodayBriefingsCache } from '@/integrations/signal-api/cache/todayBriefingsCache';
import { clearSignalEtfInsightsCache } from '@/integrations/signal-api/cache/etfInsightsCache';
import { clearSignalScreenerCache } from '@/integrations/signal-api/cache/screenerCache';
import { clearSignalNotificationsCache } from '@/integrations/signal-api/cache/notificationsCache';
import { clearSignalYoutubeCache } from '@/integrations/signal-api/cache/youtubeCache';

export function clearSignalApiCache(): void {
  clearSignalYoutubeCache();
  clearSignalCalendarCache();
  clearSignalNewsCache();
  clearSignalNewsDigestsCache();
  clearSignalCommunityCache();
  clearSignalDisclosuresCache();
  clearSignalDisclosureDigestsCache();
  clearSignalMarketCache();
  clearSignalMarketBriefingsCache();
  clearSignalTodayBriefingsCache();
  clearSignalEtfInsightsCache();
  clearSignalScreenerCache();
  clearSignalNotificationsCache();
}
