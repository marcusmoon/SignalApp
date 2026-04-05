import { useMemo } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';

import type { AppTheme } from '@/constants/theme';
import { MEGA_CAP_TICKERS } from '@/constants/megaCapUniverse';
import { OtaUpdateBanner } from '@/components/OtaUpdateBanner';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';

const NUM_COLUMNS = 3;

export default function MegaCapListScreen() {
  const { theme } = useSignalTheme();
  const { t } = useLocale();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();

  const header = useMemo(
    () => (
      <View style={styles.leadBlock}>
        <Text style={styles.lead}>{t('screenMegaCapListLead')}</Text>
        <Text style={styles.count}>
          {t('screenMegaCapListCount', { count: MEGA_CAP_TICKERS.length })}
        </Text>
      </View>
    ),
    [styles, t],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {isFocused ? <OtaUpdateBanner /> : null}
      <FlatList
        data={[...MEGA_CAP_TICKERS]}
        keyExtractor={(item) => item}
        numColumns={NUM_COLUMNS}
        columnWrapperStyle={styles.columnWrap}
        ListHeaderComponent={header}
        contentContainerStyle={[styles.listContent, { paddingBottom: 28 + insets.bottom }]}
        renderItem={({ item }) => (
          <View style={styles.cell}>
            <Text style={styles.ticker} selectable>
              {item}
            </Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.bg },
    listContent: { paddingHorizontal: 16, paddingTop: 8 },
    leadBlock: { marginBottom: 16 },
    lead: {
      fontSize: 13,
      color: theme.textMuted,
      lineHeight: 20,
      marginBottom: 8,
    },
    count: { fontSize: 11, color: theme.textDim, fontWeight: '600' },
    columnWrap: { gap: 8, marginBottom: 8 },
    cell: {
      flex: 1,
      minWidth: 0,
      paddingVertical: 10,
      paddingHorizontal: 8,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ticker: {
      fontSize: 13,
      fontWeight: '800',
      color: theme.text,
      letterSpacing: 0.3,
    },
  });
}
