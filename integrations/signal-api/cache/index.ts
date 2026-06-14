export * from '@/integrations/signal-api/cache/calendarCache';
export * from '@/integrations/signal-api/cache/newsCache';
export * from '@/integrations/signal-api/cache/youtubeCache';

import { clearSignalCalendarCache } from '@/integrations/signal-api/cache/calendarCache';
import { clearSignalNewsCache } from '@/integrations/signal-api/cache/newsCache';
import { clearSignalYoutubeCache } from '@/integrations/signal-api/cache/youtubeCache';

export function clearSignalApiCache(): void {
  clearSignalYoutubeCache();
  clearSignalCalendarCache();
  clearSignalNewsCache();
}
