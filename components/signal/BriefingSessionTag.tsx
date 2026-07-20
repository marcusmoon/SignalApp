import { useMemo } from 'react';
import { StyleSheet, Text } from 'react-native';

import { FEED_BADGE_PX } from '@/constants/feedTypography';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { marketBriefingSessionLabelId } from '@/domain/briefings/sessionLabel';
import type { AppTheme } from '@/constants/theme';
import type { SignalApiMarketBriefing } from '@/integrations/signal-api/types';
import type { FeedContentTypography } from '@/services/feedContentWeightPreference';

type Props = {
  briefing: Pick<SignalApiMarketBriefing, 'market' | 'session'>;
};

/** 세션 브리핑 본문 앞 회차 라벨 — 장전·장중·마감·미장 (인라인 Text) */
export function BriefingSessionTag({ briefing }: Props) {
  const { t } = useLocale();
  const { theme, scaleFont, feedTypo } = useSignalTheme();
  const labelId = marketBriefingSessionLabelId(briefing);
  const styles = useMemo(() => makeStyles(theme, scaleFont, feedTypo), [theme, scaleFont, feedTypo]);

  if (!labelId) return null;

  return (
    <Text style={styles.tagText} accessibilityRole="text">
      {t(labelId)}
      {' '}
    </Text>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number, ft: FeedContentTypography) {
  return StyleSheet.create({
    tagText: {
      fontSize: ft.ff(FEED_BADGE_PX + 1),
      fontWeight: ft.metaWeight,
      color: theme.textMuted,
      backgroundColor: theme.bgElevated,
      borderRadius: 4,
      paddingHorizontal: 5,
      paddingVertical: 1,
    },
  });
}
