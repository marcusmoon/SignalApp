import { Image } from 'expo-image';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import type { AppTheme } from '@/constants/theme';
import {
  MASTER_PANEL_MIN_WIDTH,
  MASTER_PANEL_WIDTH_RATIO,
} from '@/constants/responsiveLayout';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import type { MessageId } from '@/locales/messages';
import { markSourceIconFailed } from '@/services/sourceIcon';
import { openConfiguredExternalLink } from '@/utils/externalLinkOpen';
import {
  computeExternalLinkGridColumns,
  externalLinkGridCellWidth,
} from '@/utils/externalLinkGrid';
import { externalLinkFaviconUrl } from '@/utils/externalLinkFavicon';
import type { SymbolExternalLink } from '@/utils/symbolExternalLinks';

const GAP = 6;
const BOX_PAD_H = 4;
const BOX_PAD_V = 6;
const FAVICON_SIZE = 24;

/** SymbolDetailPane scroll(16) + feedCard(4) + box(4) */
const HORIZONTAL_INSET = 16 + 4 + 4;

function estimateGridInnerWidth(windowWidth: number, useTwoPane: boolean): number {
  let contentWidth = windowWidth;
  if (useTwoPane) {
    const masterWidth = Math.max(
      MASTER_PANEL_MIN_WIDTH,
      Math.round(windowWidth * MASTER_PANEL_WIDTH_RATIO),
    );
    contentWidth = Math.max(0, windowWidth - masterWidth);
  }
  return Math.max(0, contentWidth - HORIZONTAL_INSET * 2);
}

type LinkCellProps = {
  link: SymbolExternalLink;
  styles: ReturnType<typeof makeStyles>;
  label: string;
  cellWidth: number;
};

function LinkCell({ link, styles, label, cellWidth }: LinkCellProps) {
  const faviconUrl = useMemo(
    () => externalLinkFaviconUrl(link.id, link.url, 32),
    [link.id, link.url],
  );
  const [iconFailed, setIconFailed] = useState(false);

  useEffect(() => {
    setIconFailed(false);
  }, [faviconUrl]);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.cell,
        { width: cellWidth, maxWidth: cellWidth },
        pressed && styles.cellPressed,
      ]}
      onPress={() =>
        void openConfiguredExternalLink({
          webUrl: link.url,
          appLaunchUrls: link.appLaunchUrls,
          openInAppBrowser: link.openInAppBrowser,
        })
      }
      accessibilityRole="link"
      accessibilityLabel={label}>
      <View style={styles.iconWrap}>
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
      <Text style={styles.cellLabel} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

type SymbolExternalLinksGridProps = {
  links: SymbolExternalLink[];
};

export function SymbolExternalLinksGrid({ links }: SymbolExternalLinksGridProps) {
  const { theme, scaleFont } = useSignalTheme();
  const { t } = useLocale();
  const { width: windowWidth } = useWindowDimensions();
  const { useTwoPane } = useResponsiveLayout();
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const styles = useMemo(() => makeStyles(theme, scaleFont), [theme, scaleFont]);

  const gridInnerWidth = useMemo(() => {
    const estimated = estimateGridInnerWidth(windowWidth, useTwoPane);
    const measured = measuredWidth > 0 ? measuredWidth - BOX_PAD_H * 2 : 0;
    return Math.max(estimated, measured);
  }, [measuredWidth, useTwoPane, windowWidth]);

  const columns = useMemo(
    () =>
      computeExternalLinkGridColumns(gridInnerWidth, links.length, {
        gap: GAP,
        maxColumns: useTwoPane ? 4 : 3,
        preferredColumns: 3,
      }),
    [gridInnerWidth, links.length, useTwoPane],
  );

  const cellWidth = useMemo(
    () => externalLinkGridCellWidth(gridInnerWidth, columns, GAP),
    [columns, gridInnerWidth],
  );

  if (links.length === 0) return null;

  return (
    <View
      style={styles.box}
      onLayout={(event) => {
        const next = Math.max(0, event.nativeEvent.layout.width);
        setMeasuredWidth((prev) => (prev === next ? prev : next));
      }}>
      <View style={styles.grid}>
        {links.map((link) => (
          <LinkCell
            key={link.id}
            link={link}
            styles={styles}
            label={t(link.labelKey)}
            cellWidth={cellWidth}
          />
        ))}
      </View>
    </View>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number) {
  return StyleSheet.create({
    box: {
      width: '100%',
      alignSelf: 'stretch',
      paddingHorizontal: BOX_PAD_H,
      paddingVertical: BOX_PAD_V,
    },
    grid: {
      width: '100%',
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: GAP,
    },
    cell: {
      minHeight: 56,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 8,
      paddingHorizontal: 2,
      paddingVertical: 4,
    },
    cellPressed: {
      backgroundColor: theme.greenDim,
    },
    iconWrap: {
      width: FAVICON_SIZE,
      height: FAVICON_SIZE,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 4,
    },
    favicon: {
      width: FAVICON_SIZE,
      height: FAVICON_SIZE,
      borderRadius: 4,
    },
    faviconFallback: {
      width: FAVICON_SIZE,
      height: FAVICON_SIZE,
      borderRadius: 4,
      backgroundColor: theme.bgElevated,
    },
    cellLabel: {
      fontSize: sf(10),
      fontWeight: '700',
      color: theme.textDim,
      textAlign: 'center',
      lineHeight: sf(12),
      maxWidth: '100%',
    },
  });
}
