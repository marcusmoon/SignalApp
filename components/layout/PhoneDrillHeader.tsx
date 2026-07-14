import { StyleSheet, Text, View } from 'react-native';

import { PhoneHeaderBackButton } from '@/components/layout/PhoneHeaderBackButton';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { webShellBackground } from '@/constants/webLayout';

type Props = {
  title: string;
  onBack: () => void;
};

/**
 * iPhone More 허브 드릴인 — Expo Stack 헤더와 동일 크롬
 * (좌: chevron+「뒤로」, 중앙: 제목). wide의 `WideSubpaneHeader`와 혼용하지 않는다.
 */
export function PhoneDrillHeader({ title, onBack }: Props) {
  const { theme, scaleFont } = useSignalTheme();
  const styles = makeStyles(theme, scaleFont);

  return (
    <View style={styles.bar}>
      <View style={styles.side}>
        <PhoneHeaderBackButton onPress={onBack} />
      </View>
      <View style={styles.titleWrap} pointerEvents="none">
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
      </View>
      <View style={styles.side} />
    </View>
  );
}

function makeStyles(theme: ReturnType<typeof useSignalTheme>['theme'], sf: (n: number) => number) {
  return StyleSheet.create({
    bar: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 44,
      backgroundColor: webShellBackground(theme.bg),
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
      paddingHorizontal: 4,
    },
    side: {
      width: 88,
      justifyContent: 'center',
    },
    titleWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
    },
    title: {
      fontSize: sf(17),
      lineHeight: sf(22),
      fontWeight: '600',
      color: theme.text,
      textAlign: 'center',
    },
  });
}
