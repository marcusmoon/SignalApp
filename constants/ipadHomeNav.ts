import type { MessageId } from '@/locales/messages';
import type { NewsSegmentKey } from '@/constants/newsSegment';

export type HomeDigestCategory = Extract<NewsSegmentKey, 'global' | 'korea' | 'crypto'>;

export const HOME_DIGEST_CATEGORIES: HomeDigestCategory[] = ['global', 'korea', 'crypto'];

export type SignalSessionKey = 'us-overnight' | 'kr-morning' | 'kr-lunch' | 'kr-evening';

export const HOME_SIGNAL_SESSIONS: ReadonlyArray<{
  key: SignalSessionKey;
  market: 'us' | 'kr';
  session: string;
  labelId: MessageId;
  hintId: MessageId;
}> = [
  {
    key: 'us-overnight',
    market: 'us',
    session: 'overnight',
    labelId: 'briefingSessionOvernight',
    hintId: 'briefingSessionHintOvernight',
  },
  {
    key: 'kr-morning',
    market: 'kr',
    session: 'morning',
    labelId: 'briefingSessionMorning',
    hintId: 'briefingSessionHintMorning',
  },
  {
    key: 'kr-lunch',
    market: 'kr',
    session: 'lunch',
    labelId: 'briefingSessionLunch',
    hintId: 'briefingSessionHintLunch',
  },
  {
    key: 'kr-evening',
    market: 'kr',
    session: 'evening',
    labelId: 'briefingSessionEvening',
    hintId: 'briefingSessionHintEvening',
  },
];
