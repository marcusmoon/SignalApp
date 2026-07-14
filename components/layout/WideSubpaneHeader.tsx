import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';

type Props = {
  title: string;
  onBack: () => void;
};

/**
 * 서브 화면 공통 상단 — chevron + 「뒤로」 + 제목.
 * wide 우측 pane 드릴인, iPhone More 허브 자식(보드·공시·유튜브)에서 동일 패턴.
 */
export function WideSubpaneHeader({ title, onBack }: Props) {
  const { t } = useLocale();
  const { theme, scaleFont } = useSignalTheme();
  const styles = makeStyles(theme, scaleFont);

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel={t('commonBack')}
        style={({ pressed }) => [styles.backRow, pressed && styles.backRowPressed]}>
        <FontAwesome5 name="chevron-left" size={12} color={theme.green} />
        <Text style={styles.backText}>{t('commonBack')}</Text>
      </Pressable>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

function makeStyles(theme: ReturnType<typeof useSignalTheme>['theme'], sf: (n: number) => number) {
  return StyleSheet.create({
    wrap: {
      gap: 8,
      marginBottom: 4,
    },
    backRow: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 4,
    },
    backRowPressed: {
      opacity: 0.72,
    },
    backText: {
      fontSize: sf(12),
      lineHeight: sf(16),
      fontWeight: '700',
      color: theme.green,
    },
    title: {
      color: theme.text,
      fontSize: sf(15),
      fontWeight: '700',
    },
  });
}
