import type { MessageId } from '@/locales/messages';
import type { NewsSegmentKey } from '@/constants/newsSegment';

export type HomeDigestCategory = Extract<NewsSegmentKey, 'global' | 'korea' | 'crypto'>;

export type NewsIssuesCategory = HomeDigestCategory | 'all';

export const HOME_DIGEST_CATEGORIES: HomeDigestCategory[] = ['global', 'korea', 'crypto'];

export const NEWS_ISSUES_CATEGORY_ORDER: NewsIssuesCategory[] = ['all', ...HOME_DIGEST_CATEGORIES];

export type DisclosureFlowMarket = 'all' | 'us' | 'kr';

export const DISCLOSURE_FLOW_MARKET_ORDER: DisclosureFlowMarket[] = ['all', 'us', 'kr'];

export type HomeDigestCategoryIcon = 'globe' | 'flag' | 'bitcoin';

export function homeDigestCategoryIcon(category: HomeDigestCategory): HomeDigestCategoryIcon {
  if (category === 'crypto') return 'bitcoin';
  if (category === 'korea') return 'flag';
  return 'globe';
}

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
