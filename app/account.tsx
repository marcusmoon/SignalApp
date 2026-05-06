import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import type { AppTheme } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import {
  fetchSignalMe,
  formatSignalApiError,
  loginSignalUser,
  logoutSignalUser,
  registerSignalUser,
  updateSignalMe,
  type SignalAppUser,
} from '@/integrations/signal-api';
import { hasSignalApi } from '@/services/env';
import {
  clearAppAuthSession,
  loadAppAuthSession,
  saveAppAuthSession,
  type StoredAppAuthSession,
} from '@/services/appAuthSession';

type Mode = 'login' | 'register';

export default function AccountScreen() {
  const { theme, scaleFont } = useSignalTheme();
  const { t } = useLocale();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(theme, scaleFont), [theme, scaleFont]);
  const [session, setSession] = useState<StoredAppAuthSession | null>(null);
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [profileImageUrl, setProfileImageUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const user: SignalAppUser | null = session?.user ?? null;

  const reload = useCallback(async () => {
    const saved = await loadAppAuthSession();
    setSession(saved);
    if (!saved?.token || !hasSignalApi()) return;
    try {
      const fresh = await fetchSignalMe(saved.token);
      const next = { ...saved, user: fresh };
      await saveAppAuthSession(next);
      setSession(next);
    } catch {
      await clearAppAuthSession();
      setSession(null);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!user) return;
    setNickname(user.nickname || '');
    setProfileImageUrl(user.profileImageUrl || '');
  }, [user]);

  const submitAuth = useCallback(async () => {
    if (!hasSignalApi()) {
      setError(t('errorSignalApiShort'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const next =
        mode === 'register'
          ? await registerSignalUser({ email, password, nickname, profileImageUrl })
          : await loginSignalUser({ email, password });
      await saveAppAuthSession(next);
      setSession(next);
      setPassword('');
    } catch (e) {
      setError(formatSignalApiError(e, t, 'accountAuthError'));
    } finally {
      setSaving(false);
    }
  }, [email, mode, nickname, password, profileImageUrl, t]);

  const saveProfile = useCallback(async () => {
    if (!session?.token) return;
    setSaving(true);
    setError(null);
    try {
      const nextUser = await updateSignalMe(session.token, { nickname, profileImageUrl });
      const next = { ...session, user: nextUser };
      await saveAppAuthSession(next);
      setSession(next);
    } catch (e) {
      setError(formatSignalApiError(e, t, 'accountProfileError'));
    } finally {
      setSaving(false);
    }
  }, [nickname, profileImageUrl, session, t]);

  const logout = useCallback(async () => {
    const token = session?.token;
    setSaving(true);
    try {
      if (token) await logoutSignalUser(token).catch(() => {});
      await clearAppAuthSession();
      setSession(null);
      setPassword('');
    } finally {
      setSaving(false);
    }
  }, [session?.token]);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <Stack.Screen options={{ title: t('screenAccount') }} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 28 + insets.bottom }]}>
        <View style={styles.card}>
          <Text style={styles.kicker}>{t('accountKicker')}</Text>
          <Text style={styles.title}>{user ? t('accountProfileTitle') : t('accountAuthTitle')}</Text>
          <Text style={styles.lead}>{t(user ? 'accountProfileLead' : 'accountAuthLead')}</Text>
        </View>

        {error ? (
          <View style={styles.errBox}>
            <Text style={styles.errText}>{error}</Text>
          </View>
        ) : null}

        {user ? (
          <View style={styles.card}>
            <View style={styles.profileRow}>
              {profileImageUrl ? <Image source={{ uri: profileImageUrl }} style={styles.avatar} /> : <View style={styles.avatarFallback}><Text style={styles.avatarText}>{user.nickname.slice(0, 1).toUpperCase()}</Text></View>}
              <View style={styles.profileText}>
                <Text style={styles.profileName}>{user.nickname}</Text>
                <Text style={styles.profileEmail}>{user.email}</Text>
              </View>
            </View>
            <TextInput
              value={nickname}
              onChangeText={setNickname}
              placeholder={t('accountNicknamePlaceholder')}
              placeholderTextColor={theme.textDim}
              style={styles.input}
            />
            <TextInput
              value={profileImageUrl}
              onChangeText={setProfileImageUrl}
              placeholder={t('accountProfileImagePlaceholder')}
              placeholderTextColor={theme.textDim}
              autoCapitalize="none"
              style={styles.input}
            />
            <View style={styles.buttonRow}>
              <Pressable disabled={saving} onPress={() => void saveProfile()} style={styles.primaryBtn}>
                <Text style={styles.primaryText}>{saving ? t('commonLoading') : t('accountSaveProfile')}</Text>
              </Pressable>
              <Pressable disabled={saving} onPress={() => void logout()} style={styles.secondaryBtn}>
                <Text style={styles.secondaryText}>{t('accountLogout')}</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.card}>
            <View style={styles.modeRow}>
              {(['login', 'register'] as Mode[]).map((key) => (
                <Pressable
                  key={key}
                  onPress={() => setMode(key)}
                  style={[styles.modeBtn, mode === key && styles.modeBtnActive]}
                  accessibilityState={{ selected: mode === key }}>
                  <Text style={[styles.modeText, mode === key && styles.modeTextActive]}>
                    {t(key === 'login' ? 'accountModeLogin' : 'accountModeRegister')}
                  </Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder={t('accountEmailPlaceholder')}
              placeholderTextColor={theme.textDim}
              autoCapitalize="none"
              keyboardType="email-address"
              style={styles.input}
            />
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder={t('accountPasswordPlaceholder')}
              placeholderTextColor={theme.textDim}
              secureTextEntry
              style={styles.input}
            />
            {mode === 'register' ? (
              <>
                <TextInput
                  value={nickname}
                  onChangeText={setNickname}
                  placeholder={t('accountNicknamePlaceholder')}
                  placeholderTextColor={theme.textDim}
                  style={styles.input}
                />
                <TextInput
                  value={profileImageUrl}
                  onChangeText={setProfileImageUrl}
                  placeholder={t('accountProfileImagePlaceholder')}
                  placeholderTextColor={theme.textDim}
                  autoCapitalize="none"
                  style={styles.input}
                />
              </>
            ) : null}
            <Pressable disabled={saving} onPress={() => void submitAuth()} style={styles.primaryBtn}>
              <Text style={styles.primaryText}>
                {saving ? t('commonLoading') : t(mode === 'register' ? 'accountRegisterButton' : 'accountLoginButton')}
              </Text>
            </Pressable>
            <Text style={styles.socialHint}>{t('accountSocialHint')}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.bg },
    content: { padding: 16, gap: 12 },
    card: { borderRadius: 14, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.card, padding: 16, gap: 12 },
    kicker: { fontSize: sf(11), fontWeight: '900', color: theme.green },
    title: { fontSize: sf(22), lineHeight: sf(28), fontWeight: '900', color: theme.text },
    lead: { fontSize: sf(13), lineHeight: sf(19), color: theme.textMuted },
    errBox: { borderRadius: 12, borderWidth: 1, borderColor: '#553333', backgroundColor: '#2A1515', padding: 12 },
    errText: { color: '#E0A0A0', fontSize: sf(12), lineHeight: sf(18) },
    modeRow: { flexDirection: 'row', gap: 8, padding: 4, borderRadius: 12, backgroundColor: theme.bgElevated },
    modeBtn: { flex: 1, minHeight: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    modeBtnActive: { backgroundColor: theme.greenDim, borderWidth: 1, borderColor: theme.greenBorder },
    modeText: { fontSize: sf(13), fontWeight: '800', color: theme.textDim },
    modeTextActive: { color: theme.green },
    input: {
      minHeight: 46,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.bgElevated,
      color: theme.text,
      paddingHorizontal: 12,
      fontSize: sf(14),
    },
    primaryBtn: { minHeight: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.green },
    primaryText: { color: '#06100B', fontSize: sf(14), fontWeight: '900' },
    secondaryBtn: { minHeight: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.border, backgroundColor: theme.bgElevated, paddingHorizontal: 14 },
    secondaryText: { color: theme.text, fontSize: sf(14), fontWeight: '900' },
    socialHint: { fontSize: sf(12), color: theme.textDim, lineHeight: sf(17), textAlign: 'center' },
    profileRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    avatar: { width: 56, height: 56, borderRadius: 18, backgroundColor: theme.bgElevated },
    avatarFallback: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.greenDim, borderWidth: 1, borderColor: theme.greenBorder },
    avatarText: { color: theme.green, fontSize: sf(22), fontWeight: '900' },
    profileText: { flex: 1, minWidth: 0 },
    profileName: { color: theme.text, fontSize: sf(17), fontWeight: '900' },
    profileEmail: { color: theme.textMuted, fontSize: sf(12), marginTop: 3 },
    buttonRow: { gap: 10 },
  });
}
