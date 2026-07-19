import type { ComponentProps } from 'react';
import { useMemo } from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Stack, useRouter, type Href } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { WideSubpaneHeader } from '@/components/layout/WideSubpaneHeader';
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
  SCREEN_WIDE_SCROLL_BOTTOM_BASE,
  stackScreenScrollBottomPadding,
} from '@/constants/screenLayout';
import type { AppTheme } from '@/constants/theme';
import { UI_RADIUS_CARD } from '@/constants/uiCornerRadius';
import { webShellBackground } from '@/constants/webLayout';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import type { MessageId } from '@/locales/messages';

type GameCard = {
  id: string;
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
];

export type GameHubContentProps = {
  embedded?: boolean;
  onBack?: () => void;
};

/** 더보기·사이드바 → 게임 허브 */
export function GameHubContent({ embedded = false, onBack }: GameHubContentProps) {
  const { theme, scaleFont } = useSignalTheme();
  const { t } = useLocale();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { useTwoPane } = useResponsiveLayout();
  const wide = embedded || useTwoPane;
  const styles = useMemo(() => makeStyles(theme, scaleFont, wide), [theme, scaleFont, wide]);

  return (
    <SafeAreaView style={styles.safe} edges={wide ? [] : []}>
      {onBack ? <WideSubpaneHeader title={t('screenGameCenter')} onBack={onBack} /> : null}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: wide ? SCREEN_EMBEDDED_WIDE_PADDING_TOP : SCREEN_LIST_CONTENT_PADDING_TOP,
            paddingBottom: wide
              ? SCREEN_WIDE_SCROLL_BOTTOM_BASE + insets.bottom
              : stackScreenScrollBottomPadding(insets.bottom),
            paddingHorizontal: wide ? SCREEN_EMBEDDED_WIDE_PADDING_HORIZONTAL : 16,
          },
        ]}>
        <Text style={styles.lead}>{t('gameCenterLead')}</Text>
        <View style={styles.grid}>
          {GAMES.map((game) => (
            <Pressable
              key={game.id}
              onPress={() => router.push(game.href)}
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
              accessibilityRole="button"
              accessibilityLabel={t(game.titleId)}>
              <View style={styles.iconCircle}>
                <FontAwesome name={game.icon} size={wide ? 22 : 20} color={theme.green} />
              </View>
              <View style={styles.cardText}>
                <Text style={styles.cardTitle}>{t(game.titleId)}</Text>
                <Text style={styles.cardBody}>{t(game.bodyId)}</Text>
              </View>
              <FontAwesome name="chevron-right" size={12} color={theme.textDim} />
            </Pressable>
          ))}
        </View>
      </ScrollView>
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
        <GameHubContent embedded onBack={() => router.back()} />
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

function makeStyles(theme: AppTheme, sf: (n: number) => number, wide: boolean) {
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
      gap: 12,
      maxWidth: wide ? APP_WIDE_CONTENT_MAX_WIDTH : APP_CONTENT_MAX_WIDTH,
      width: '100%',
      alignSelf: 'center',
    },
    lead: {
      fontSize: sf(14),
      lineHeight: sf(20),
      color: theme.textMuted,
      marginBottom: 4,
    },
    grid: {
      gap: 10,
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
      borderRadius: UI_RADIUS_CARD,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      paddingVertical: 14,
      paddingHorizontal: 12,
      ...(wide
        ? {
            flexGrow: 1,
            flexBasis: 320,
            maxWidth: '100%' as const,
            minHeight: 88,
          }
        : null),
    },
    cardPressed: {
      backgroundColor: theme.bgElevated,
      borderColor: theme.greenBorder,
    },
    iconCircle: {
      width: wide ? 44 : 40,
      height: wide ? 44 : 40,
      borderRadius: 10,
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
    cardTitle: {
      fontSize: sf(wide ? 16 : 15),
      fontWeight: '700',
      color: theme.text,
    },
    cardBody: {
      fontSize: sf(13),
      lineHeight: sf(18),
      color: theme.textMuted,
    },
  });
}
