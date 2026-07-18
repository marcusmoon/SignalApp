import { StyleSheet, Text, View } from 'react-native';

import { PhoneHeaderBackButton } from '@/components/layout/PhoneHeaderBackButton';
import { useSignalTheme } from '@/contexts/SignalThemeContext';

type Props = {
  /** 비우면 chevron만 (알림 단건 상세 등) */
  title?: string;
  onBack: () => void;
};

/**
 * Wide web/iPad 우측 서브 화면 공통 상단 — chevron만 + 제목.
 * 백 컨트롤은 `PhoneHeaderBackButton`과 동일 (iPhone Stack과 통일).
 */
export function WideSubpaneHeader({ title, onBack }: Props) {
  const { theme, scaleFont } = useSignalTheme();
  const styles = makeStyles(theme, scaleFont);
  const label = String(title ?? '').trim();

  return (
    <View style={styles.wrap}>
      <PhoneHeaderBackButton onPress={onBack} />
      {label ? (
        <Text style={styles.title} numberOfLines={1}>
          {label}
        </Text>
      ) : null}
    </View>
  );
}

function makeStyles(theme: ReturnType<typeof useSignalTheme>['theme'], sf: (n: number) => number) {
  return StyleSheet.create({
    wrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginBottom: 4,
      minHeight: 36,
    },
    title: {
      flex: 1,
      color: theme.text,
      fontSize: sf(17),
      lineHeight: sf(22),
      fontWeight: '600',
      paddingRight: 8,
    },
  });
}
