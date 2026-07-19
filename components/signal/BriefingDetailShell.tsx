import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { WideSubpaneHeader } from '@/components/layout/WideSubpaneHeader';
import { signalDrillStackOptions } from '@/components/layout/signalDrillStackOptions';
import { WebWheelScrollView } from '@/components/layout/WebWheelScrollView';
import { SignalLoadingIndicator } from '@/components/signal/SignalLoadingIndicator';
import { ThemedRefreshControl } from '@/components/signal/ThemedRefreshControl';
import { APP_CONTENT_MAX_WIDTH, APP_WIDE_CONTENT_MAX_WIDTH } from '@/constants/responsiveLayout';
import {
  SCREEN_EMBEDDED_WIDE_PADDING_HORIZONTAL,
  SCREEN_EMBEDDED_WIDE_PADDING_TOP,
} from '@/constants/screenLayout';
import type { AppTheme } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import type { FeedContentTypography } from '@/services/feedContentWeightPreference';

export type BriefingDetailShellProps = {
  embedded?: boolean;
  onBack?: () => void;
  /**
   * Stack / WideSubpane 공통 헤더 제목(섹션명).
   * 본문 `headline`(단건 제목)과 분리. 홈 숏컷·플로우와 같은 뒤로+제목 chrome.
   */
  chromeTitle?: string | null;
  loading?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  error?: string | null;
  emptyText?: string | null;
  /** 본문 최상단 헤드라인 (단건 제목) */
  headline?: string | null;
  scrollResetKey?: string;
  contentRevision?: unknown;
  children?: ReactNode;
};

/**
 * 단건 브리핑·다이제스트 상세 공통 셸.
 * 헤더: 숏컷과 동일 — 뒤로(chevron) + 섹션명(`chromeTitle`). dateBar 없음.
 * 본문: 단건 헤드라인 + children.
 */
export function BriefingDetailShell({
  embedded = false,
  onBack,
  chromeTitle = null,
  loading = false,
  refreshing = false,
  onRefresh,
  error = null,
  emptyText = null,
  headline = null,
  scrollResetKey = '',
  contentRevision,
  children,
}: BriefingDetailShellProps) {
  const { theme, scaleFont, feedTypo } = useSignalTheme();
  const { t } = useLocale();
  const router = useRouter();
  const styles = useMemo(
    () => makeStyles(theme, scaleFont, feedTypo, embedded),
    [theme, scaleFont, feedTypo, embedded],
  );
  const sectionTitle = String(chromeTitle || '').trim();
  const title = String(headline || '').trim();

  return (
    <SafeAreaView style={styles.safe} edges={embedded ? [] : ['bottom']}>
      {!embedded ? (
        <Stack.Screen
          options={signalDrillStackOptions({
            title: sectionTitle,
            onBack: () => router.back(),
          })}
        />
      ) : null}
      {onBack ? <WideSubpaneHeader title={sectionTitle || undefined} onBack={onBack} /> : null}
      {loading ? (
        <View style={styles.loadingWrap}>
          <SignalLoadingIndicator message={t('commonLoading')} />
        </View>
      ) : (
        <WebWheelScrollView
          scrollResetKey={scrollResetKey}
          contentRevision={contentRevision}
          style={styles.scroll}
          contentContainerStyle={styles.content}
          refreshControl={
            onRefresh ? (
              <ThemedRefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} />
            ) : undefined
          }>
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
          {!error && emptyText ? <Text style={styles.emptyText}>{emptyText}</Text> : null}
          {!error && !emptyText ? (
            <>
              {title ? <Text style={styles.headline}>{title}</Text> : null}
              {children}
            </>
          ) : null}
        </WebWheelScrollView>
      )}
    </SafeAreaView>
  );
}

function makeStyles(
  theme: AppTheme,
  sf: (n: number) => number,
  ft: FeedContentTypography,
  embedded: boolean,
) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: theme.bg,
    },
    scroll: {
      flex: 1,
    },
    content: {
      flexGrow: 1,
      paddingHorizontal: embedded ? SCREEN_EMBEDDED_WIDE_PADDING_HORIZONTAL : 16,
      paddingTop: embedded ? SCREEN_EMBEDDED_WIDE_PADDING_TOP : 14,
      paddingBottom: 28,
      gap: 16,
      maxWidth: embedded ? APP_WIDE_CONTENT_MAX_WIDTH : APP_CONTENT_MAX_WIDTH,
      alignSelf: 'center',
      width: '100%',
    },
    loadingWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    errorBox: {
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.danger,
      backgroundColor: theme.dangerDim,
      padding: 12,
    },
    errorText: {
      fontSize: sf(13),
      lineHeight: sf(18),
      fontWeight: '600',
      color: theme.danger,
    },
    emptyText: {
      fontSize: ft.ff(13),
      lineHeight: sf(19),
      fontWeight: ft.bodyWeight,
      color: theme.textDim,
      textAlign: 'center',
      paddingVertical: 24,
    },
    headline: {
      fontSize: ft.ff(17),
      lineHeight: sf(25),
      fontWeight: ft.titleWeight,
      color: theme.text,
    },
  });
}
