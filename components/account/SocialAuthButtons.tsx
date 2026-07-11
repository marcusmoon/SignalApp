import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { AppTheme } from '@/constants/theme';
import type { SignalSocialCatalog, SocialProviderKey } from '@/integrations/signal-api';

export function SocialAuthButtons({
  providers,
  catalog,
  saving,
  action,
  onPress,
  labelForProvider,
  theme,
  scaleFont,
}: {
  providers: readonly SocialProviderKey[];
  catalog: SignalSocialCatalog | null;
  saving: boolean;
  action: 'login' | 'signup';
  onPress: (provider: SocialProviderKey, action: 'login' | 'signup') => void;
  labelForProvider: (provider: SocialProviderKey) => string;
  theme: AppTheme;
  scaleFont: (n: number) => number;
}) {
  const styles = useMemo(() => makeStyles(theme, scaleFont), [theme, scaleFont]);
  return (
    <View style={styles.stack}>
      {providers.map((provider) => {
        const enabled = catalog ? catalog.providers[provider]?.enabled === true : true;
        const label = labelForProvider(provider);
        const brandStyle =
          provider === 'kakao'
            ? styles.brandKakao
            : provider === 'naver'
              ? styles.brandNaver
              : provider === 'google'
                ? styles.brandGoogle
                : styles.brandApple;
        const buttonStyle =
          provider === 'kakao'
            ? styles.buttonKakao
            : provider === 'naver'
              ? styles.buttonNaver
              : provider === 'google'
                ? styles.buttonGoogle
                : styles.buttonApple;
        const labelStyle =
          provider === 'kakao' ? styles.labelDark : provider === 'naver' ? styles.labelLight : null;
        return (
          <Pressable
            key={provider}
            disabled={saving || !enabled}
            onPress={() => onPress(provider, action)}
            accessibilityRole="button"
            accessibilityLabel={label}
            style={({ pressed }) => [
              styles.button,
              buttonStyle,
              !enabled && styles.buttonDisabled,
              pressed && styles.buttonPressed,
            ]}>
            <View style={[styles.brand, brandStyle]}>
              {provider === 'naver' ? (
                <Text style={styles.brandLetter}>N</Text>
              ) : (
                <FontAwesome5
                  name={provider === 'apple' ? 'apple' : provider === 'google' ? 'google' : 'comment'}
                  size={provider === 'apple' ? 16 : 14}
                  color={provider === 'kakao' ? '#191600' : provider === 'google' ? '#4285F4' : theme.bg}
                />
              )}
            </View>
            <Text style={[styles.label, labelStyle]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number) {
  return StyleSheet.create({
    stack: { gap: 16 },
    button: {
      minHeight: 48,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.bgElevated,
      alignItems: 'center',
      justifyContent: 'flex-start',
      flexDirection: 'row',
      gap: 16,
      paddingHorizontal: 12,
    },
    buttonPressed: { opacity: 0.78 },
    buttonDisabled: { opacity: 0.45 },
    buttonKakao: { backgroundColor: '#FEE500', borderColor: '#FEE500' },
    buttonNaver: { backgroundColor: '#03C75A', borderColor: '#03C75A' },
    buttonGoogle: { backgroundColor: theme.bgElevated, borderColor: theme.border },
    buttonApple: { backgroundColor: theme.bgElevated, borderColor: theme.border },
    brand: {
      width: 28,
      height: 28,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
    },
    brandKakao: { backgroundColor: '#FEE500', borderColor: 'rgba(0,0,0,0.12)' },
    brandNaver: { backgroundColor: '#03C75A', borderColor: 'rgba(255,255,255,0.2)' },
    brandGoogle: { backgroundColor: '#FFFFFF', borderColor: '#E2E6EA' },
    brandApple: { backgroundColor: theme.text, borderColor: theme.text },
    brandLetter: { color: '#FFFFFF', fontSize: sf(15), fontWeight: '900' },
    label: { color: theme.text, fontSize: sf(14), fontWeight: '900' },
    labelDark: { color: '#191600' },
    labelLight: { color: '#FFFFFF' },
  });
}
