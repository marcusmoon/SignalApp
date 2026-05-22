import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { REFERENCE_LINK_ITEMS, type ReferenceLinkItem } from '@/constants/referenceAppLinks';
import type { AppTheme } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import type { MessageId } from '@/locales/messages';
import { openExternalLink } from '@/utils/openExternalLink';

const LIST_HORIZONTAL_PAD = 16;
const COLS = 4;
const GAP = 6;
const BOX_PAD = 10;
const CELL_WIDTH_SAFETY = 2;

type LinkCellProps = {
  item: ReferenceLinkItem;
  width: number;
  styles: ReturnType<typeof makeStyles>;
  theme: AppTheme;
  label: string;
};

function LinkCell({ item, width, styles, theme, label }: LinkCellProps) {
  return (
    <Pressable
      style={({ pressed }) => [styles.cell, { width }, pressed && styles.cellPressed]}
      onPress={() =>
        void openExternalLink(item.webUrl, item.appLaunchUrls, {
          preferInAppBrowser: item.openInAppBrowser,
        })
      }
      accessibilityRole="button"
      accessibilityLabel={label}>
      <View style={styles.iconCircle}>
        {item.iconMark != null ? (
          <Text style={styles.iconMarkText} numberOfLines={1}>
            {item.iconMark}
          </Text>
        ) : (
          <FontAwesome name={item.icon!} size={26} color={theme.textDim} />
        )}
      </View>
      <Text style={styles.cellLabel} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

type LinkGridProps = {
  items: ReferenceLinkItem[];
  cellW: number;
  styles: ReturnType<typeof makeStyles>;
  theme: AppTheme;
  t: (id: MessageId) => string;
};

function LinkGrid({ items, cellW, styles, theme, t }: LinkGridProps) {
  return (
    <View style={styles.grid}>
      {items.map((item) => (
        <LinkCell
          key={item.id}
          item={item}
          width={cellW}
          styles={styles}
          theme={theme}
          label={t(item.labelKey)}
        />
      ))}
    </View>
  );
}

export function ReferenceLinksSection() {
  const { theme, scaleFont } = useSignalTheme();
  const { t } = useLocale();
  const { width: winW } = useWindowDimensions();
  const styles = useMemo(() => makeStyles(theme, scaleFont), [theme, scaleFont]);

  const pageWidth = winW - LIST_HORIZONTAL_PAD * 2;
  const gridInnerW = pageWidth - BOX_PAD * 2;
  const cellW = Math.floor((gridInnerW - GAP * (COLS - 1)) / COLS) - CELL_WIDTH_SAFETY;

  return (
    <View style={styles.box}>
      <LinkGrid
        items={REFERENCE_LINK_ITEMS}
        cellW={cellW}
        styles={styles}
        theme={theme}
        t={t}
      />
    </View>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number) {
  return StyleSheet.create({
    box: {
      borderRadius: 13,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      padding: BOX_PAD,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      rowGap: 16,
      columnGap: GAP,
    },
    cell: {
      minHeight: 74,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 10,
      paddingHorizontal: 5,
      paddingVertical: 6,
    },
    cellPressed: {
      backgroundColor: theme.greenDim,
    },
    iconCircle: {
      width: 46,
      height: 36,
      borderRadius: 0,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 6,
      paddingHorizontal: 0,
    },
    iconMarkText: {
      fontSize: sf(11),
      fontWeight: '900',
      color: theme.textDim,
      letterSpacing: -0.2,
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
