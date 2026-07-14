import { useCallback, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AccountSubpaneHeader } from '@/components/account/AccountSubpaneHeader';
import { WideOverlayRouteRedirect } from '@/components/layout/WideOverlayRouteRedirect';
import { stackScreenScrollBottomPadding } from '@/constants/screenLayout';
import type { AppTheme } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';
import { useIpadSidebarNav } from '@/contexts/IpadSidebarNavContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';

const DOCUMENT_LINKS = [
  { key: 'service', type: 'service' as const, icon: 'file-alt' as const },
  { key: 'privacy', type: 'privacy' as const, icon: 'user-shield' as const },
];

export type TermsHistoryScreenProps = {
  embedded?: boolean;
  onBack?: () => void;
};

export function TermsHistoryScreen({ embedded = false, onBack }: TermsHistoryScreenProps = {}) {
  const router = useRouter();
  const { theme, scaleFont } = useSignalTheme();
  const { t } = useLocale();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(theme, scaleFont), [theme, scaleFont]);
  const { useTwoPane } = useResponsiveLayout();
  const ipadNav = useIpadSidebarNav();

  const returnToAccountHub = useCallback(() => {
    if (ipadNav.isAvailable) {
      ipadNav.showAccount();
      return;
    }
    router.replace('/account' as never);
  }, [ipadNav, router]);

  const subpaneBack = onBack ?? returnToAccountHub;

  if (useTwoPane && !embedded) {
    return <WideOverlayRouteRedirect kind="terms-history" params={{ from: 'account' }} />;
  }

  return (
    <SafeAreaView style={styles.safe} edges={useTwoPane ? [] : ['bottom']}>
      {!useTwoPane ? <Stack.Screen options={{ title: t('accountHubTermsTitle') }} /> : null}
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: stackScreenScrollBottomPadding(insets.bottom) }]}>
        {useTwoPane ? (
          <AccountSubpaneHeader title={t('accountHubTermsTitle')} onBack={subpaneBack} />
        ) : null}
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

export default TermsHistoryScreen;

function makeStyles(theme: AppTheme, sf: (n: number) => number) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.bg },
    content: { padding: 16, gap: 12 },
    menuStack: {
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      overflow: 'hidden',
    },
    menuRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    menuRowLast: { borderBottomWidth: 0 },
    rowPressed: { opacity: 0.72 },
    menuIcon: {
      width: 28,
      height: 28,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.greenDim,
    },
    menuTitle: {
      flex: 1,
      fontSize: sf(14),
      fontWeight: '600',
      color: theme.text,
    },
  });
}
