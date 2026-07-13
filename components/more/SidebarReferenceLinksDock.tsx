import { Image } from 'expo-image';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { REFERENCE_LINK_ITEMS, type ReferenceLinkItem } from '@/constants/referenceAppLinks';
import type { AppTheme } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import type { MessageId } from '@/locales/messages';
import { markSourceIconFailed } from '@/services/sourceIcon';
import { externalLinkFaviconUrl } from '@/utils/externalLinkFavicon';
import { openReferenceLink } from '@/utils/referenceLinkOpen';

const COLUMNS = 4;
const ICON = 20;

type DockCellProps = {
  item: ReferenceLinkItem;
  styles: ReturnType<typeof makeStyles>;
  label: string;
};

function DockCell({ item, styles, label }: DockCellProps) {
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
    </Pressable>
  );
}

/** iPad·웹 사이드바 — My info 위 슬림 퀵 링크 바 */
export function SidebarReferenceLinksDock() {
  const { theme } = useSignalTheme();
  const { t } = useLocale();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const rows = useMemo(() => {
    const out: ReferenceLinkItem[][] = [];
    for (let i = 0; i < REFERENCE_LINK_ITEMS.length; i += COLUMNS) {
      out.push(REFERENCE_LINK_ITEMS.slice(i, i + COLUMNS));
    }
    return out;
  }, []);

  return (
    <View style={styles.dock} accessibilityRole="toolbar" accessibilityLabel={t('moreRefLinksKicker')}>
      {rows.map((row, rowIndex) => (
        <View key={`row-${rowIndex}`} style={styles.row}>
          {row.map((item) => (
            <DockCell
              key={item.id}
              item={item}
              styles={styles}
              label={t(item.labelKey as MessageId)}
            />
          ))}
          {row.length < COLUMNS
            ? Array.from({ length: COLUMNS - row.length }, (_, i) => (
                <View key={`pad-${i}`} style={styles.cellSpacer} />
              ))
            : null}
        </View>
      ))}
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    dock: {
      gap: 4,
      paddingHorizontal: 4,
      paddingTop: 4,
      paddingBottom: 10,
    },
    row: {
      flexDirection: 'row',
      gap: 4,
    },
    cell: {
      flex: 1,
      minWidth: 0,
      minHeight: 34,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 8,
    },
    cellSpacer: {
      flex: 1,
      minWidth: 0,
    },
    cellPressed: {
      backgroundColor: theme.greenDim,
    },
    iconCircle: {
      width: ICON + 4,
      height: ICON + 4,
      alignItems: 'center',
      justifyContent: 'center',
    },
    favicon: {
      width: ICON,
      height: ICON,
      borderRadius: 4,
    },
    faviconFallback: {
      width: ICON,
      height: ICON,
      borderRadius: 4,
      backgroundColor: theme.bgElevated,
    },
  });
}
