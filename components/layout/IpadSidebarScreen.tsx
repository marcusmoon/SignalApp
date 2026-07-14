import { Stack, useRouter, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PhoneHeaderBackButton } from '@/components/layout/PhoneHeaderBackButton';
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
          <PhoneHeaderBackButton onPress={onBack} />
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
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
      backgroundColor: theme.bg,
    },
    title: {
      flex: 1,
      textAlign: 'center',
      fontSize: sf(17),
      lineHeight: sf(22),
      fontWeight: '600',
      color: theme.text,
    },
    spacer: {
      width: 36,
      flexShrink: 0,
    },
  });
}
