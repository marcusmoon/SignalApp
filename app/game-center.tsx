import type { ComponentProps } from 'react';
import { useMemo } from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Stack, useRouter, type Href } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { signalDrillStackOptions } from '@/components/layout/signalDrillStackOptions';
import { APP_CONTENT_MAX_WIDTH } from '@/constants/responsiveLayout';
import { SCREEN_LIST_CONTENT_PADDING_TOP, stackScreenScrollBottomPadding } from '@/constants/screenLayout';
import type { AppTheme } from '@/constants/theme';
import { UI_RADIUS_CARD } from '@/constants/uiCornerRadius';
import { webShellBackground } from '@/constants/webLayout';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
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

/** 더보기 → 게임센터 */
export default function GameCenterScreen() {
  const { theme, scaleFont } = useSignalTheme();
  const { t } = useLocale();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(theme, scaleFont), [theme, scaleFont]);

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <Stack.Screen
        options={signalDrillStackOptions({
          title: t('screenGameCenter'),
          onBack: () => router.back(),
        })}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{
          paddingTop: SCREEN_LIST_CONTENT_PADDING_TOP,
          paddingBottom: stackScreenScrollBottomPadding(insets.bottom),
          paddingHorizontal: 16,
          gap: 12,
        }}>
        <Text style={styles.lead}>{t('gameCenterLead')}</Text>
        {GAMES.map((game) => (
          <Pressable
            key={game.id}
            onPress={() => router.push(game.href)}
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            accessibilityRole="button"
            accessibilityLabel={t(game.titleId)}>
            <View style={styles.iconCircle}>
              <FontAwesome name={game.icon} size={20} color={theme.green} />
            </View>
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>{t(game.titleId)}</Text>
              <Text style={styles.cardBody}>{t(game.bodyId)}</Text>
            </View>
            <FontAwesome name="chevron-right" size={12} color={theme.textDim} />
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: webShellBackground(theme.bg) },
    scroll: {
      flex: 1,
      width: '100%',
      maxWidth: APP_CONTENT_MAX_WIDTH,
      alignSelf: 'center',
    },
    lead: {
      fontSize: sf(14),
      lineHeight: sf(20),
      color: theme.textMuted,
      marginBottom: 4,
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
    },
    cardPressed: {
      backgroundColor: theme.bgElevated,
      borderColor: theme.greenBorder,
    },
    iconCircle: {
      width: 40,
      height: 40,
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
      fontSize: sf(15),
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
