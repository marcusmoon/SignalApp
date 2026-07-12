import { Image } from 'expo-image';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ExternalLinkGrid } from '@/components/common/ExternalLinkGrid';
import type { AppTheme } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { markSourceIconFailed } from '@/services/sourceIcon';
import { openConfiguredExternalLink } from '@/utils/externalLinkOpen';
import { externalLinkFaviconUrl } from '@/utils/externalLinkFavicon';
import type { SymbolExternalLink } from '@/utils/symbolExternalLinks';

const GAP = 6;
const BOX_PAD_H = 4;
const BOX_PAD_V = 6;
const FAVICON_SIZE = 24;
const HORIZONTAL_INSET = 16 + 4 + 4;

type LinkCellProps = {
  link: SymbolExternalLink;
  styles: ReturnType<typeof makeStyles>;
  label: string;
};

function LinkCell({ link, styles, label }: LinkCellProps) {
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
      style={({ pressed }) => [styles.cell, pressed && styles.cellPressed]}
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
  const styles = useMemo(() => makeStyles(theme, scaleFont), [theme, scaleFont]);

  return (
    <ExternalLinkGrid
      items={links}
      horizontalInset={HORIZONTAL_INSET}
      boxPaddingHorizontal={BOX_PAD_H}
      gap={GAP}
      keyExtractor={(link) => link.id}
      style={styles.box}
      renderItem={(link) => (
        <LinkCell link={link} styles={styles} label={t(link.labelKey)} />
      )}
    />
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number) {
  return StyleSheet.create({
    box: {
      paddingHorizontal: BOX_PAD_H,
      paddingVertical: BOX_PAD_V,
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
