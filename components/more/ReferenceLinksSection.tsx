import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
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
const GAP = 8;
const ITEMS_PER_PAGE = 8;
const BOX_PAD = 12;

function chunkPages(items: ReferenceLinkItem[]): ReferenceLinkItem[][] {
  const pages: ReferenceLinkItem[][] = [];
  for (let i = 0; i < items.length; i += ITEMS_PER_PAGE) {
    pages.push(items.slice(i, i + ITEMS_PER_PAGE));
  }
  return pages;
}

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
      style={[styles.cell, { width }]}
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
          <FontAwesome name={item.icon!} size={22} color={theme.green} />
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
  pageWidth: number;
  cellW: number;
  styles: ReturnType<typeof makeStyles>;
  theme: AppTheme;
  t: (id: MessageId) => string;
};

function LinkGrid({ items, pageWidth, cellW, styles, theme, t }: LinkGridProps) {
  return (
    <View style={[styles.grid, { width: pageWidth }]}>
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
  const [pageIndex, setPageIndex] = useState(0);

  const pages = useMemo(() => chunkPages(REFERENCE_LINK_ITEMS), []);
  const paged = REFERENCE_LINK_ITEMS.length > ITEMS_PER_PAGE;
  const pageWidth = winW - LIST_HORIZONTAL_PAD * 2;
  const gridInnerW = pageWidth - BOX_PAD * 2;
  const cellW = (gridInnerW - GAP * (COLS - 1)) / COLS;

  const onPageScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const idx = Math.round(e.nativeEvent.contentOffset.x / pageWidth);
      setPageIndex(Math.max(0, Math.min(idx, pages.length - 1)));
    },
    [pageWidth, pages.length],
  );

  return (
    <View style={styles.box}>
        {paged ? (
          <>
            <FlatList
              data={pages}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={(_, index) => String(index)}
              onMomentumScrollEnd={onPageScrollEnd}
              getItemLayout={(_, index) => ({ length: pageWidth, offset: pageWidth * index, index })}
              renderItem={({ item }) => (
                <LinkGrid
                  items={item}
                  pageWidth={pageWidth}
                  cellW={cellW}
                  styles={styles}
                  theme={theme}
                  t={t}
                />
              )}
            />
            <View style={styles.pageHintRow} accessibilityRole="adjustable" accessibilityLabel={t('moreRefLinksSwipeA11y')}>
              <FontAwesome
                name="chevron-left"
                size={11}
                color={pageIndex > 0 ? theme.textMuted : theme.border}
              />
              <View style={styles.pageDots}>
                {pages.map((_, i) => (
                  <View key={i} style={[styles.pageDot, i === pageIndex && styles.pageDotActive]} />
                ))}
              </View>
              <FontAwesome
                name="chevron-right"
                size={11}
                color={pageIndex < pages.length - 1 ? theme.textMuted : theme.border}
              />
            </View>
          </>
        ) : (
          <LinkGrid
            items={pages[0] ?? []}
            pageWidth={pageWidth}
            cellW={cellW}
            styles={styles}
            theme={theme}
            t={t}
          />
        )}
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
      paddingVertical: BOX_PAD,
      overflow: 'hidden',
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: GAP,
      paddingHorizontal: BOX_PAD,
    },
    cell: {
      alignItems: 'center',
    },
    iconCircle: {
      width: 52,
      height: 52,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.greenDim,
      borderWidth: 1,
      borderColor: theme.greenBorder,
      marginBottom: 6,
      paddingHorizontal: 4,
    },
    iconMarkText: {
      fontSize: sf(11),
      fontWeight: '800',
      color: theme.green,
      letterSpacing: -0.2,
    },
    cellLabel: {
      fontSize: sf(10),
      fontWeight: '700',
      color: theme.text,
      textAlign: 'center',
      lineHeight: sf(13),
      minHeight: Math.round(sf(26)),
    },
    pageHintRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      marginTop: 10,
      paddingTop: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.border,
      marginHorizontal: BOX_PAD,
    },
    pageDots: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    pageDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.border,
    },
    pageDotActive: {
      width: 14,
      backgroundColor: theme.green,
    },
  });
}
