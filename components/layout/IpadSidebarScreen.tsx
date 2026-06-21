import { Stack, useRouter, type Href } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SignalHeader } from '@/components/signal/SignalHeader';
import { SignalSidebarTabBar } from '@/components/signal/SignalSidebarTabBar';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';

type Props = {
  title: string;
  children: ReactNode;
  backHref?: Href;
};

export function IpadSidebarScreen({ title, children, backHref }: Props) {
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
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <SignalHeader compact fullWidth />
      <View style={styles.body}>
        <SignalSidebarTabBar />
        <View style={styles.content}>
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
          <View style={styles.contentBody}>{children}</View>
        </View>
      </View>
    </SafeAreaView>
  );
}

function makeStyles(
  theme: ReturnType<typeof useSignalTheme>['theme'],
  sf: (n: number) => number,
) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: theme.bg,
    },
    body: {
      flex: 1,
      flexDirection: 'row',
      minHeight: 0,
    },
    content: {
      flex: 1,
      minWidth: 0,
      backgroundColor: theme.bg,
    },
    topBar: {
      minHeight: 54,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
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
      fontWeight: '900',
      color: theme.green,
    },
    title: {
      flex: 1,
      textAlign: 'center',
      fontSize: sf(18),
      lineHeight: sf(24),
      fontWeight: '900',
      color: theme.text,
    },
    spacer: {
      width: 78,
      flexShrink: 0,
    },
    contentBody: {
      flex: 1,
      minHeight: 0,
    },
  });
}
