import { Image } from 'expo-image';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import type { SourceAccent } from '@/constants/sourceAccent';
import type { AppTheme } from '@/constants/theme';
import { useSignalTheme } from '@/contexts/SignalThemeContext';

type Props = {
  accent: SourceAccent;
  size?: number;
  style?: StyleProp<ViewStyle>;
};

export function CommunitySourceMark({ accent, size = 36, style }: Props) {
  const { theme, scaleFont } = useSignalTheme();
  const iconUrl = accent.iconUrl?.trim() || null;
  const [iconFailed, setIconFailed] = useState(!iconUrl);
  const styles = useMemo(() => makeStyles(theme, scaleFont, size), [theme, scaleFont, size]);

  useEffect(() => {
    setIconFailed(!iconUrl);
  }, [iconUrl]);

  const showIcon = Boolean(iconUrl) && !iconFailed;

  return (
    <View
      style={[
        styles.mark,
        { backgroundColor: accent.dim, borderColor: accent.border },
        style,
      ]}>
      {showIcon && iconUrl ? (
        <Image
          source={{ uri: iconUrl }}
          style={styles.icon}
          contentFit="contain"
          cachePolicy="memory-disk"
          transition={100}
          onError={() => setIconFailed(true)}
        />
      ) : (
        <Text style={[styles.glyph, { color: accent.accent }]} numberOfLines={1}>
          {accent.glyph}
        </Text>
      )}
    </View>
  );
}

function makeStyles(_theme: AppTheme, sf: (n: number) => number, size: number) {
  const radius = Math.max(6, Math.round(size * 0.28));
  return StyleSheet.create({
    mark: {
      width: size,
      height: size,
      borderRadius: radius,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      overflow: 'hidden',
      flexShrink: 0,
    },
    icon: {
      width: size - 6,
      height: size - 6,
    },
    glyph: {
      fontSize: sf(Math.round(size * 0.42)),
      lineHeight: sf(Math.round(size * 0.5)),
      fontWeight: '900',
    },
  });
}
