import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

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

/** 세션 브리핑 헤더용 회차 라벨 — 장전·장중·마감·미장 */
export function BriefingSessionTag({ briefing }: Props) {
  const { t } = useLocale();
  const { theme, scaleFont, feedTypo } = useSignalTheme();
  const labelId = marketBriefingSessionLabelId(briefing);
  const styles = useMemo(() => makeStyles(theme, scaleFont, feedTypo), [theme, scaleFont, feedTypo]);

  if (!labelId) return null;

  return (
    <View style={styles.tag} accessibilityRole="text">
      <Text style={styles.tagText}>{t(labelId)}</Text>
    </View>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number, ft: FeedContentTypography) {
  return StyleSheet.create({
    tag: {
      alignSelf: 'center',
      borderRadius: 999,
      paddingHorizontal: 6,
      paddingVertical: 2,
      backgroundColor: theme.bgElevated,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      flexShrink: 0,
    },
    tagText: {
      fontSize: ft.ff(FEED_BADGE_PX + 1),
      lineHeight: sf(13),
      fontWeight: ft.metaWeight,
      color: theme.textMuted,
    },
  });
}
