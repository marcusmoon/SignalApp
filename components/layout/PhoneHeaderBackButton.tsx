import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { useNavigation, useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';

type Props = {
  onPress: () => void;
};

/** 백 버튼 공통 규격 — iPhone Stack · iPad/web 드릴인 모두 동일 */
export const SIGNAL_BACK_CHEVRON_SIZE = 16;

/**
 * 상단 뒤로 — chevron만. 라벨·pill 배경 없음.
 * iPhone / iPad / web 동일. a11y 라벨만 `commonBack`.
 */
export function PhoneHeaderBackButton({ onPress }: Props) {
  const { t } = useLocale();
  const { theme } = useSignalTheme();
  const styles = makeStyles();

  return (
    <Pressable
      onPress={onPress}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={t('commonBack')}
      style={({ pressed }) => [styles.hit, pressed && styles.pressed]}>
      <FontAwesome5 name="chevron-left" size={SIGNAL_BACK_CHEVRON_SIZE} color={theme.green} />
    </Pressable>
  );
}

/** root Stack `headerLeft` 기본값 — 화면마다 색/형태가 갈리지 않게 한다 */
export function StackHeaderBackButton() {
  const navigation = useNavigation();
  const router = useRouter();

  return (
    <PhoneHeaderBackButton
      onPress={() => {
        if (navigation.canGoBack()) {
          navigation.goBack();
          return;
        }
        router.back();
      }}
    />
  );
}

function makeStyles() {
  return StyleSheet.create({
    hit: {
      alignItems: 'center',
      justifyContent: 'center',
      width: 36,
      height: 36,
      backgroundColor: 'transparent',
      borderWidth: 0,
    },
    pressed: {
      opacity: 0.55,
    },
  });
}
