import { Image } from 'expo-image';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { AppTheme } from '@/constants/theme';
import type { SocialProviderKey } from '@/integrations/signal-api';
import { markSourceIconFailed } from '@/services/sourceIcon';
import { socialProviderFaviconUrl } from '@/utils/socialProviderFavicon';

const FAVICON_SIZE = 18;

export function SocialProviderFavicon({
  provider,
  dimmed = false,
  theme,
}: {
  provider: SocialProviderKey;
  dimmed?: boolean;
  theme: AppTheme;
}) {
  const faviconUrl = useMemo(() => socialProviderFaviconUrl(provider, 32), [provider]);
  const [iconFailed, setIconFailed] = useState(false);
  const styles = useMemo(() => makeStyles(theme), [theme]);

  useEffect(() => {
    setIconFailed(false);
  }, [faviconUrl]);

  return (
    <View style={[styles.wrap, dimmed && styles.wrapDimmed]}>
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
        <View style={styles.fallback} />
      )}
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    wrap: {
      width: 28,
      height: 28,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.bgElevated,
      borderWidth: 1,
      borderColor: theme.border,
    },
    wrapDimmed: {
      opacity: 0.7,
    },
    favicon: {
      width: FAVICON_SIZE,
      height: FAVICON_SIZE,
    },
    fallback: {
      width: FAVICON_SIZE,
      height: FAVICON_SIZE,
      borderRadius: 4,
      backgroundColor: theme.border,
    },
  });
}
