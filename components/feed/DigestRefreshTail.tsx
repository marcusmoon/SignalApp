import FontAwesome from '@expo/vector-icons/FontAwesome';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { DIGEST_REFRESH_TAIL_WIDTH } from '@/constants/digestStripLayout';
import type { AppTheme } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';

type Props = {
  onRefresh: () => void;
  refreshing?: boolean;
};

export function DigestRefreshTail({ onRefresh, refreshing = false }: Props) {
  const { theme } = useSignalTheme();
  const { t } = useLocale();
  const styles = makeStyles(theme);

  return (
    <View style={styles.slot}>
      <Pressable
        onPress={onRefresh}
        disabled={refreshing}
        style={({ pressed }) => [styles.btn, pressed && !refreshing && styles.btnPressed]}
        accessibilityRole="button"
        accessibilityLabel={t('fabRefreshA11y')}
        accessibilityState={{ busy: refreshing }}>
        {refreshing ? (
          <ActivityIndicator size="small" color={theme.green} />
        ) : (
          <FontAwesome name="refresh" size={16} color={theme.textMuted} />
        )}
      </Pressable>
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    slot: {
      width: DIGEST_REFRESH_TAIL_WIDTH,
      flexShrink: 0,
      alignSelf: 'stretch',
    },
    btn: {
      flex: 1,
      minHeight: 72,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.bgElevated,
    },
    btnPressed: {
      opacity: 0.88,
    },
  });
}
