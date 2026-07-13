import { Image } from 'expo-image';
import { useMemo, useState, useEffect } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { symbolAvatarColors, symbolAvatarGlyph } from '@/constants/symbolAvatar';
import type { AppTheme } from '@/constants/theme';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { markSymbolLogoFailed, symbolLogoUrls } from '@/services/symbolLogo';

type Props = {
  symbol: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
};

export function SymbolLogo({ symbol, size = 24, style }: Props) {
  const { theme, scaleFont } = useSignalTheme();
  const urls = useMemo(() => symbolLogoUrls(symbol), [symbol]);
  const [urlIndex, setUrlIndex] = useState(0);
  const url = urls[urlIndex] ?? null;
  const [failed, setFailed] = useState(urls.length === 0);
  useEffect(() => {
    setUrlIndex(0);
    setFailed(urls.length === 0);
  }, [symbol, urls]);
  const avatar = useMemo(() => symbolAvatarColors(symbol, theme), [symbol, theme]);
  const styles = useMemo(() => makeStyles(theme, scaleFont, size), [theme, scaleFont, size]);
  const showLogo = Boolean(url) && !failed;
  const glyph = symbolAvatarGlyph(symbol);

  const handleImageError = () => {
    if (!url) {
      setFailed(true);
      return;
    }
    markSymbolLogoFailed(symbol, url);
    if (urlIndex < urls.length - 1) {
      setUrlIndex((prev) => prev + 1);
      return;
    }
    setFailed(true);
  };

  if (showLogo && url) {
    return (
      <View style={[styles.frame, style]}>
        <Image
          source={{ uri: url }}
          style={styles.image}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={120}
          onError={handleImageError}
        />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.frame,
        styles.avatar,
        { backgroundColor: avatar.background, borderColor: avatar.border },
        style,
      ]}
      accessibilityLabel={symbol}>
      <Text style={[styles.avatarText, { color: avatar.text }]} numberOfLines={1}>
        {glyph}
      </Text>
    </View>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number, size: number) {
  const radius = Math.max(6, Math.round(size * 0.28));
  return StyleSheet.create({
    frame: {
      width: size,
      height: size,
      borderRadius: radius,
      overflow: 'hidden',
      flexShrink: 0,
    },
    image: {
      width: size,
      height: size,
      borderRadius: radius,
      backgroundColor: theme.bgElevated,
    },
    avatar: {
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
    },
    avatarText: {
      fontSize: sf(size <= 22 ? 10 : 12),
      lineHeight: sf(size <= 22 ? 12 : 14),
      fontWeight: '700',
      letterSpacing: -0.2,
    },
  });
}
