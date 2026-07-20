import type { MessageId } from '@/locales/messages';
import type { SignalApiMarketBriefing } from '@/integrations/signal-api/types';

const SESSION_LABEL_IDS: ReadonlyArray<{
  market: 'us' | 'kr';
  session: string;
  labelId: MessageId;
}> = [
  { market: 'us', session: 'overnight', labelId: 'briefingSessionOvernight' },
  { market: 'kr', session: 'morning', labelId: 'briefingSessionMorning' },
  { market: 'kr', session: 'lunch', labelId: 'briefingSessionLunch' },
  { market: 'kr', session: 'close', labelId: 'briefingSessionClose' },
];

export function marketBriefingSessionLabelId(
  briefing: Pick<SignalApiMarketBriefing, 'market' | 'session'>,
): MessageId | null {
  const market = String(briefing.market || '').trim().toLowerCase();
  const session = String(briefing.session || '').trim().toLowerCase();
  const row = SESSION_LABEL_IDS.find((item) => item.market === market && item.session === session);
  return row?.labelId ?? null;
}
