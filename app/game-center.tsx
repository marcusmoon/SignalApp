import type { ComponentProps } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Stack, useFocusEffect, useRouter, type Href } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { GameRecordsSheet } from '@/components/games/GameRecordsSheet';
import { signalDrillStackOptions } from '@/components/layout/signalDrillStackOptions';
import {
  APP_CONTENT_MAX_WIDTH,
  APP_WIDE_CONTENT_MAX_WIDTH,
  wideContentFill,
} from '@/constants/responsiveLayout';
import {
  SCREEN_EMBEDDED_WIDE_PADDING_HORIZONTAL,
  SCREEN_EMBEDDED_WIDE_PADDING_TOP,
  SCREEN_LIST_CONTENT_PADDING_TOP,
  SCREEN_WIDE_CONTENT_PADDING_TOP,
  SCREEN_WIDE_SCROLL_BOTTOM_BASE,
  stackScreenScrollBottomPadding,
} from '@/constants/screenLayout';
import type { AppTheme } from '@/constants/theme';
import { UI_RADIUS_CARD, UI_RADIUS_CARD_LG } from '@/constants/uiCornerRadius';
import { webShellBackground } from '@/constants/webLayout';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import {
  emptyGameRecords,
  formatDurationMs,
  type GameRecordsState,
} from '@/domain/games/records';
import type { MessageId } from '@/locales/messages';
import { loadGameProgressSummaries } from '@/services/gameProgressStore';
import { loadGameRecords } from '@/services/gameRecordsStore';

type GameCard = {
  id: 'sum-trail' | 'sudoku';
  href: Href;
  icon: ComponentProps<typeof FontAwesome>['name'];
  titleId: MessageId;
  bodyId: MessageId;
};

const GAMES: GameCard[] = [
  {
    id: 'sum-trail',
    href: '/games/sum-trail' as Href,
    icon: 'th',
    titleId: 'gameSumTrailTitle',
    bodyId: 'gameSumTrailCardBody',
  },
  {
    id: 'sudoku',
    href: '/games/sudoku' as Href,
    icon: 'table',
    titleId: 'gameSudokuTitle',
    bodyId: 'gameSudokuCardBody',
  },
];

export type GameHubContentProps = {
  /** iPad·와이드 사이드바 루트 (백 헤더 없음) */
  wideRoot?: boolean;
};

/** 더보기·사이드바 → 게임 허브 */
export function GameHubContent({ wideRoot = false }: GameHubContentProps) {
  const { theme, scaleFont } = useSignalTheme();
  const { t } = useLocale();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { useTwoPane, width } = useResponsiveLayout();
  const wide = wideRoot || useTwoPane;
  const columns = wide ? (width >= 1200 ? 3 : 2) : 1;
  const styles = useMemo(
    () => makeStyles(theme, scaleFont, wide, columns),
    [theme, scaleFont, wide, columns],
  );
  const [recordsOpen, setRecordsOpen] = useState(false);
  const [records, setRecords] = useState<GameRecordsState>(emptyGameRecords);
  const [resume, setResume] = useState<{ sumTrail: boolean; sudoku: boolean; sumLevel: number }>({
    sumTrail: false,
    sudoku: false,
    sumLevel: 0,
  });

  const refreshMeta = useCallback(() => {
    void loadGameRecords().then(setRecords);
    void loadGameProgressSummaries().then((p) => {
      setResume({
        sumTrail: p.sumTrail != null,
        sudoku: p.sudoku != null,
        sumLevel: p.sumTrail?.state.level ?? 0,
      });
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshMeta();
    }, [refreshMeta]),
  );

  useEffect(() => {
    refreshMeta();
  }, [refreshMeta]);

  const cardMeta = (id: GameCard['id']): string => {
    if (id === 'sum-trail') {
      if (resume.sumTrail) {
        return t('gameHubResumeLevel', { level: resume.sumLevel });
      }
      if (records.sumTrail.bestLevel > 0) {
        return t('gameHubBestLevel', { level: records.sumTrail.bestLevel });
      }
      return t('gameHubNoRecordsYet');
    }
    if (resume.sudoku) return t('gameHubResume');
    const best = records.sudoku.byDifficulty.normal.bestTimeMs
      ?? records.sudoku.byDifficulty.easy.bestTimeMs
      ?? records.sudoku.byDifficulty.hard.bestTimeMs;
    if (best != null) return t('gameHubBestTime', { time: formatDurationMs(best) });
    if (records.sudoku.clears > 0) return t('gameHubClears', { count: records.sudoku.clears });
    return t('gameHubNoRecordsYet');
  };

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: wide
              ? wideRoot
                ? SCREEN_WIDE_CONTENT_PADDING_TOP
                : SCREEN_EMBEDDED_WIDE_PADDING_TOP
              : SCREEN_LIST_CONTENT_PADDING_TOP,
            paddingBottom: wide
              ? SCREEN_WIDE_SCROLL_BOTTOM_BASE + insets.bottom
              : stackScreenScrollBottomPadding(insets.bottom),
            paddingHorizontal: wide ? SCREEN_EMBEDDED_WIDE_PADDING_HORIZONTAL : 16,
          },
        ]}>
        {wideRoot ? (
          <View style={styles.wideTitleBlock}>
            <Text style={styles.wideTitle}>{t('screenGameCenter')}</Text>
            <Text style={styles.lead}>{t('gameCenterLead')}</Text>
          </View>
        ) : (
          <Text style={styles.lead}>{t('gameCenterLead')}</Text>
        )}

        <Pressable
          onPress={() => setRecordsOpen(true)}
          style={({ pressed }) => [styles.recordsBtn, pressed && styles.recordsBtnPressed]}
          accessibilityRole="button"
          accessibilityLabel={t('gameRecordsTitle')}>
          <FontAwesome name="trophy" size={14} color={theme.green} />
          <Text style={styles.recordsBtnText}>{t('gameRecordsTitle')}</Text>
          <FontAwesome name="chevron-right" size={11} color={theme.textDim} />
        </Pressable>

        <View style={styles.grid}>
          {GAMES.map((game) => {
            const hasResume =
              (game.id === 'sum-trail' && resume.sumTrail) ||
              (game.id === 'sudoku' && resume.sudoku);
            return (
              <Pressable
                key={game.id}
                onPress={() => router.push(game.href)}
                style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
                accessibilityRole="button"
                accessibilityLabel={t(game.titleId)}>
                <View style={styles.iconCircle}>
                  <FontAwesome name={game.icon} size={wide ? 24 : 20} color={theme.green} />
                </View>
                <View style={styles.cardText}>
                  <View style={styles.titleRow}>
                    <Text style={styles.cardTitle}>{t(game.titleId)}</Text>
                    {hasResume ? (
                      <View style={styles.resumeBadge}>
                        <Text style={styles.resumeBadgeText}>{t('gameHubResumeBadge')}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.cardBody}>{t(game.bodyId)}</Text>
                  <Text style={styles.cardMeta}>{cardMeta(game.id)}</Text>
                </View>
                <FontAwesome name="chevron-right" size={12} color={theme.textDim} />
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
      <GameRecordsSheet visible={recordsOpen} onClose={() => setRecordsOpen(false)} />
    </SafeAreaView>
  );
}

export default function GameCenterScreen() {
  const { t } = useLocale();
  const router = useRouter();
  const { useTwoPane } = useResponsiveLayout();

  if (useTwoPane) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false, animation: 'none' }} />
        <GameHubContent wideRoot />
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={signalDrillStackOptions({
          title: t('screenGameCenter'),
          onBack: () => router.back(),
        })}
      />
      <GameHubContent />
    </>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number, wide: boolean, columns: number) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: webShellBackground(theme.bg) },
    scroll: {
      flex: 1,
      width: '100%',
      ...(wide
        ? wideContentFill
        : { maxWidth: APP_CONTENT_MAX_WIDTH, alignSelf: 'center' as const }),
    },
    scrollContent: {
      gap: wide ? 16 : 12,
      maxWidth: wide ? APP_WIDE_CONTENT_MAX_WIDTH : APP_CONTENT_MAX_WIDTH,
      width: '100%',
      alignSelf: 'center',
      flexGrow: 1,
    },
    wideTitleBlock: {
      gap: 6,
      marginBottom: 4,
    },
    wideTitle: {
      fontSize: sf(22),
      lineHeight: sf(28),
      fontWeight: '800',
      color: theme.text,
    },
    lead: {
      fontSize: sf(14),
      lineHeight: sf(20),
      color: theme.textMuted,
      marginBottom: wide ? 0 : 4,
    },
    recordsBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: UI_RADIUS_CARD,
      borderWidth: 1,
      borderColor: theme.greenBorder,
      backgroundColor: theme.greenDim,
    },
    recordsBtnPressed: {
      opacity: 0.9,
    },
    recordsBtnText: {
      flex: 1,
      fontSize: sf(14),
      fontWeight: '700',
      color: theme.green,
    },
    grid: {
      gap: 12,
      ...(wide
        ? {
            flexDirection: 'row' as const,
            flexWrap: 'wrap' as const,
          }
        : null),
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      borderRadius: UI_RADIUS_CARD_LG,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      paddingVertical: wide ? 18 : 14,
      paddingHorizontal: wide ? 16 : 12,
      ...(wide
        ? {
            flexGrow: 1,
            flexBasis: columns >= 3 ? '30%' : '46%',
            maxWidth: columns >= 3 ? '32%' : '48%',
            minHeight: 108,
          }
        : null),
    },
    cardPressed: {
      backgroundColor: theme.bgElevated,
      borderColor: theme.greenBorder,
    },
    iconCircle: {
      width: wide ? 48 : 40,
      height: wide ? 48 : 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.greenDim,
      borderWidth: 1,
      borderColor: theme.greenBorder,
    },
    cardText: {
      flex: 1,
      minWidth: 0,
      gap: 4,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexWrap: 'wrap',
    },
    cardTitle: {
      fontSize: sf(wide ? 17 : 15),
      fontWeight: '700',
      color: theme.text,
    },
    resumeBadge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 6,
      backgroundColor: theme.warningDim,
      borderWidth: 1,
      borderColor: theme.warning,
    },
    resumeBadgeText: {
      fontSize: sf(11),
      fontWeight: '700',
      color: theme.warning,
    },
    cardBody: {
      fontSize: sf(13),
      lineHeight: sf(18),
      color: theme.textMuted,
    },
    cardMeta: {
      fontSize: sf(12),
      fontWeight: '600',
      color: theme.green,
      marginTop: 2,
    },
  });
}
