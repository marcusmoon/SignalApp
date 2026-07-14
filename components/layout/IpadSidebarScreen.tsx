import { Stack, useRouter, type Href } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { webFlexFill } from '@/constants/webLayout';

type Props = {
  title: string;
  children: ReactNode;
  backHref?: Href;
  /** 사이드바 1급 화면(내 정보 등) — 전역 SignalHeader만 두고 뒤로/제목 줄을 숨긴다 */
  hideTopBar?: boolean;
};

/** Wide web/iPad: 사이드바·헤더는 `WideWebShell`이 담당. 여기는 우측 콘텐츠 영역만. */
export function IpadSidebarScreen({ title, children, backHref, hideTopBar = false }: Props) {
  const router = useRouter();
  const { t } = useLocale();
  const { theme, scaleFont } = useSignalTheme();
  const styles = makeStyles(theme, scaleFont);

  const onBack = () => {
    if (backHref) {
      router.replace(backHref);
      return;
    }
    if (typeof router.canGoBack === 'function' && router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)/news');
  };

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      {hideTopBar ? null : (
        <View style={styles.topBar}>
          <Pressable
            onPress={onBack}
            style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed]}
            accessibilityRole="button"
            accessibilityLabel={t('commonBack')}>
            <FontAwesome name="chevron-left" size={14} color={theme.green} />
            <Text style={styles.backText}>{t('commonBack')}</Text>
          </Pressable>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <View style={styles.spacer} />
        </View>
      )}
      <View style={styles.contentBody}>{children}</View>
    </View>
  );
}

function makeStyles(
  theme: ReturnType<typeof useSignalTheme>['theme'],
  sf: (n: number) => number,
) {
  return StyleSheet.create({
    root: {
      ...webFlexFill,
      backgroundColor: theme.bg,
    },
    contentBody: {
      flex: 1,
      minHeight: 0,
    },
    topBar: {
      minHeight: 54,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 20,
      paddingHorizontal: 18,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
      backgroundColor: theme.bg,
    },
    backBtn: {
      minHeight: 36,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      paddingHorizontal: 12,
      borderRadius: 999,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
    },
    backBtnPressed: {
      opacity: 0.72,
    },
    backText: {
      fontSize: sf(13),
      fontWeight: '700',
      color: theme.green,
    },
    title: {
      flex: 1,
      textAlign: 'center',
      fontSize: sf(18),
      lineHeight: sf(24),
      fontWeight: '700',
      color: theme.text,
    },
    spacer: {
      width: 78,
      flexShrink: 0,
    },
  });
}
