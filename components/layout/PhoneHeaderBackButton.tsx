import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';

type Props = {
  onPress: () => void;
};

/**
 * iPhone native stack `headerLeft` — chevron + 「뒤로」라벨 (아이콘만인 경우와 통일).
 */
export function PhoneHeaderBackButton({ onPress }: Props) {
  const { t } = useLocale();
  const { theme, scaleFont } = useSignalTheme();
  const styles = makeStyles(theme, scaleFont);

  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={t('commonBack')}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <FontAwesome5 name="chevron-left" size={14} color={theme.green} />
      <Text style={styles.label}>{t('commonBack')}</Text>
    </Pressable>
  );
}

function makeStyles(theme: ReturnType<typeof useSignalTheme>['theme'], sf: (n: number) => number) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: 4,
      marginLeft: 2,
    },
    pressed: {
      opacity: 0.72,
    },
    label: {
      fontSize: sf(15),
      lineHeight: sf(20),
      fontWeight: '600',
      color: theme.green,
    },
  });
}
