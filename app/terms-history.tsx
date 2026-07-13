import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { stackScreenScrollBottomPadding } from '@/constants/screenLayout';
import type { AppTheme } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';

const DOCUMENT_LINKS = [
  { key: 'service', type: 'service' as const, icon: 'file-alt' as const },
  { key: 'privacy', type: 'privacy' as const, icon: 'user-shield' as const },
];

export default function TermsHistoryScreen() {
  const router = useRouter();
  const { theme, scaleFont } = useSignalTheme();
  const { t } = useLocale();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(theme, scaleFont), [theme, scaleFont]);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <Stack.Screen options={{ title: t('accountHubTermsTitle') }} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: stackScreenScrollBottomPadding(insets.bottom) }]}>
        <View style={styles.menuStack}>
          {DOCUMENT_LINKS.map((item, index) => {
            const title = item.type === 'service' ? t('termsServiceTitle') : t('termsPrivacyTitle');
            return (
              <Pressable
                key={item.key}
                onPress={() => router.push({ pathname: '/terms', params: { type: item.type } })}
                style={({ pressed }) => [
                  styles.menuRow,
                  index === DOCUMENT_LINKS.length - 1 && styles.menuRowLast,
                  pressed && styles.rowPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={title}>
                <View style={styles.menuIcon}>
                  <FontAwesome5 name={item.icon} size={14} color={theme.green} />
                </View>
                <Text style={styles.menuTitle}>{title}</Text>
                <FontAwesome5 name="chevron-right" size={10} color={theme.textDim} />
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.bg },
    content: { padding: 16 },
    menuStack: {
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      overflow: 'hidden',
    },
    menuRow: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    menuRowLast: {
      borderBottomWidth: 0,
    },
    menuIcon: {
      width: 30,
      height: 30,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.greenDim,
      borderWidth: 1,
      borderColor: theme.greenBorder,
    },
    menuTitle: {
      flex: 1,
      color: theme.text,
      fontSize: sf(13),
      fontWeight: '700',
    },
    rowPressed: { opacity: 0.76 },
  });
}
