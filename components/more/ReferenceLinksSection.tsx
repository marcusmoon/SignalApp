import { Image } from 'expo-image';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ExternalLinkGrid } from '@/components/common/ExternalLinkGrid';
import { REFERENCE_LINK_ITEMS, type ReferenceLinkItem } from '@/constants/referenceAppLinks';
import type { AppTheme } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import type { MessageId } from '@/locales/messages';
import { markSourceIconFailed } from '@/services/sourceIcon';
import { externalLinkFaviconUrl } from '@/utils/externalLinkFavicon';
import { openReferenceLink } from '@/utils/referenceLinkOpen';

const GAP = 6;
const BOX_PAD = 10;
const MIN_CELL_WIDTH = 72;

type LinkCellProps = {
  item: ReferenceLinkItem;
  styles: ReturnType<typeof makeStyles>;
  label: string;
};

function LinkCell({ item, styles, label }: LinkCellProps) {
  const faviconUrl = useMemo(
    () => externalLinkFaviconUrl(item.id, item.webUrl, 32),
    [item.id, item.webUrl],
  );
  const [iconFailed, setIconFailed] = useState(false);

  useEffect(() => {
    setIconFailed(false);
  }, [faviconUrl]);

  return (
    <Pressable
      style={({ pressed }) => [styles.cell, pressed && styles.cellPressed]}
      onPress={() => void openReferenceLink(item)}
      accessibilityRole="button"
      accessibilityLabel={label}>
      <View style={styles.iconCircle}>
        {!iconFailed ? (
          <Image
            source={{ uri: faviconUrl }}
            style={styles.favicon}
            contentFit="contain"
            onError={() => {
              markSourceIconFailed(faviconUrl);
              setIconFailed(true);
            }}
          />
        ) : (
          <View style={styles.faviconFallback} />
        )}
      </View>
      <Text style={styles.cellLabel} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

export function ReferenceLinksSection() {
  const { theme, scaleFont } = useSignalTheme();
  const { t } = useLocale();
  const styles = useMemo(() => makeStyles(theme, scaleFont), [theme, scaleFont]);

  return (
    <ExternalLinkGrid
      items={REFERENCE_LINK_ITEMS}
      horizontalInset={16}
      boxPaddingHorizontal={BOX_PAD}
      gap={GAP}
      columnOptions={{ minCellWidth: MIN_CELL_WIDTH, maxColumns: 4, preferredColumns: 3 }}
      keyExtractor={(item) => item.id}
      style={styles.box}
      renderItem={(item) => (
        <LinkCell item={item} styles={styles} label={t(item.labelKey as MessageId)} />
      )}
    />
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number) {
  return StyleSheet.create({
    box: {
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      padding: BOX_PAD,
    },
    cell: {
      minHeight: 74,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 8,
      paddingHorizontal: 5,
      paddingVertical: 6,
    },
    cellPressed: {
      backgroundColor: theme.greenDim,
    },
    iconCircle: {
      width: 28,
      height: 28,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 6,
    },
    favicon: {
      width: 24,
      height: 24,
      borderRadius: 4,
    },
    faviconFallback: {
      width: 24,
      height: 24,
      borderRadius: 4,
      backgroundColor: theme.bgElevated,
    },
    cellLabel: {
      flex: 1,
      textAlignVertical: 'center',
      fontSize: sf(11),
      fontWeight: '800',
      color: theme.textDim,
      textAlign: 'center',
      lineHeight: sf(14),
      minHeight: Math.round(sf(24)),
    },
  });
}
