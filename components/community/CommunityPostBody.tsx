import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { communityBodyBlocks } from '@/components/community/communityBodyBlocks';
import type { AppTheme } from '@/constants/theme';
import type { FeedContentTypography } from '@/services/feedContentWeightPreference';
import { useSignalTheme } from '@/contexts/SignalThemeContext';

type Props = {
  body: string;
};

export function CommunityPostBody({ body }: Props) {
  const { theme, scaleFont, feedTypo } = useSignalTheme();
  const styles = useMemo(() => makeStyles(theme, scaleFont, feedTypo), [theme, scaleFont, feedTypo]);
  const blocks = useMemo(() => communityBodyBlocks(body), [body]);

  if (!blocks.length) return null;

  return (
    <View style={styles.wrap}>
      {blocks.map((block, index) => {
        if (block.kind === 'section') {
          return (
            <Text key={`${index}-${block.text}`} style={[styles.section, index > 0 && styles.blockGap]}>
              {block.text}
            </Text>
          );
        }
        if (block.kind === 'bullet') {
          return (
            <Text key={`${index}-${block.text}`} style={[styles.bullet, index > 0 && styles.blockGapTight]}>
              {block.text}
            </Text>
          );
        }
        return (
          <Text key={`${index}-${block.text}`} style={[styles.paragraph, index > 0 && styles.blockGap]}>
            {block.text}
          </Text>
        );
      })}
    </View>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number, ft: FeedContentTypography) {
  return StyleSheet.create({
    wrap: {
      gap: 0,
    },
    blockGap: {
      marginTop: 12,
    },
    blockGapTight: {
      marginTop: 8,
    },
    paragraph: {
      color: theme.textMuted,
      fontSize: ft.ff(15),
      lineHeight: sf(25),
      fontWeight: ft.bodyWeight,
    },
    section: {
      color: theme.text,
      fontSize: ft.ff(13),
      lineHeight: sf(20),
      fontWeight: '800',
    },
    bullet: {
      color: theme.textMuted,
      fontSize: ft.ff(15),
      lineHeight: sf(25),
      fontWeight: ft.bodyWeight,
      paddingLeft: 2,
    },
  });
}
