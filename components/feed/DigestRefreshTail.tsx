import FontAwesome from '@expo/vector-icons/FontAwesome';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { DIGEST_REFRESH_TAIL_WIDTH } from '@/constants/digestStripLayout';
import type { AppTheme } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';

type Props = {
  onRefresh?: () => void;
  refreshing?: boolean;
  onGoToList?: () => void;
  goToListA11y?: string;
};

export function DigestRefreshTail({ onRefresh, refreshing = false, onGoToList, goToListA11y }: Props) {
  const { theme } = useSignalTheme();
  const { t } = useLocale();
  const styles = makeStyles(theme);
  const showRefresh = Boolean(onRefresh);
  const showList = Boolean(onGoToList);

  if (!showRefresh && !showList) return null;

  return (
    <View style={styles.slot}>
      {showList ? (
        <Pressable
          onPress={onGoToList}
          style={({ pressed }) => [styles.btn, styles.btnList, pressed && styles.btnPressed]}
          accessibilityRole="button"
          accessibilityLabel={goToListA11y ?? t('feedDigestTailGoToListA11y')}>
          <FontAwesome name="list-ul" size={15} color={theme.textMuted} />
        </Pressable>
      ) : null}
      {showRefresh ? (
        <Pressable
          onPress={onRefresh}
          disabled={refreshing}
          style={({ pressed }) => [
            styles.btn,
            showList && styles.btnRefresh,
            pressed && !refreshing && styles.btnPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={t('fabRefreshA11y')}
          accessibilityState={{ busy: refreshing }}>
          {refreshing ? (
            <ActivityIndicator size="small" color={theme.green} />
          ) : (
            <FontAwesome name="refresh" size={16} color={theme.textMuted} />
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    slot: {
      width: DIGEST_REFRESH_TAIL_WIDTH,
      flexShrink: 0,
      alignSelf: 'stretch',
      gap: 16,
    },
    btn: {
      flex: 1,
      minHeight: 52,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.bgElevated,
    },
    btnList: {
      flex: 1,
    },
    btnRefresh: {
      flex: 1,
    },
    btnPressed: {
      opacity: 0.88,
    },
  });
}
