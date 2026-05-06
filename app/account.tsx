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
  const [termsAccepted, setTermsAccepted] = useState(false);
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
    if (mode === 'register' && !termsAccepted) {
      setError(t('accountTermsRequired'));
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
  }, [email, mode, nickname, password, profileImageUrl, t, termsAccepted]);

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
        <View style={styles.hero}>
          <View style={styles.heroLogoRow}>
            <View style={styles.signalBars} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <View style={[styles.signalBar, styles.signalBar1]} />
              <View style={[styles.signalBar, styles.signalBar2]} />
              <View style={[styles.signalBar, styles.signalBar3]} />
              <View style={[styles.signalBar, styles.signalBar4]} />
            </View>
            <Text style={styles.kicker}>{t('accountKicker')}</Text>
          </View>
          <Text style={styles.title}>{user ? t('accountProfileTitle') : t('accountAuthTitle')}</Text>
          <Text style={styles.lead}>{t(user ? 'accountProfileLead' : 'accountAuthLead')}</Text>
          {!user ? (
            <View style={styles.benefitRow}>
              <Text style={styles.benefitChip}>{t('accountBenefitAlerts')}</Text>
              <Text style={styles.benefitChip}>{t('accountBenefitWatchlist')}</Text>
              <Text style={styles.benefitChip}>{t('accountBenefitPush')}</Text>
            </View>
          ) : null}
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
            <View style={styles.socialBox}>
              <Text style={styles.socialTitle}>{t('accountSocialTitle')}</Text>
              <View style={styles.socialGrid}>
                {[
                  { key: 'kakao', label: t('accountSocialKakao'), mark: 'K' },
                  { key: 'naver', label: t('accountSocialNaver'), mark: 'N' },
                  { key: 'google', label: t('accountSocialGoogle'), mark: 'G' },
                ].map((item) => (
                  <Pressable
                    key={item.key}
                    disabled
                    style={styles.socialButton}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: true }}
                    accessibilityLabel={`${item.label} ${t('commonComingSoon')}`}>
                    <Text style={styles.socialMark}>{item.mark}</Text>
                    <Text style={styles.socialLabel}>{item.label}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.socialHint}>{t('accountSocialHint')}</Text>
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
            {mode === 'register' ? (
              <Pressable
                onPress={() => setTermsAccepted((value) => !value)}
                style={styles.termsRow}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: termsAccepted }}>
                <View style={[styles.checkBox, termsAccepted && styles.checkBoxActive]}>
                  <Text style={styles.checkText}>{termsAccepted ? '✓' : ''}</Text>
                </View>
                <Text style={styles.termsText}>{t('accountTermsText')}</Text>
              </Pressable>
            ) : null}
            <Pressable disabled={saving} onPress={() => void submitAuth()} style={styles.primaryBtn}>
              <Text style={styles.primaryText}>
                {saving ? t('commonLoading') : t(mode === 'register' ? 'accountRegisterButton' : 'accountLoginButton')}
              </Text>
            </Pressable>
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
    hero: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.greenBorder,
      backgroundColor: theme.card,
      padding: 18,
      gap: 12,
      overflow: 'hidden',
    },
    card: { borderRadius: 14, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.card, padding: 16, gap: 12 },
    heroLogoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    signalBars: { width: 36, height: 28, flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
    signalBar: { width: 6, borderRadius: 4, backgroundColor: theme.green },
    signalBar1: { height: 10, opacity: 0.45 },
    signalBar2: { height: 16, opacity: 0.65 },
    signalBar3: { height: 22, opacity: 0.82 },
    signalBar4: { height: 28 },
    kicker: { fontSize: sf(11), fontWeight: '900', color: theme.green },
    title: { fontSize: sf(22), lineHeight: sf(28), fontWeight: '900', color: theme.text },
    lead: { fontSize: sf(13), lineHeight: sf(19), color: theme.textMuted },
    benefitRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
    benefitChip: {
      overflow: 'hidden',
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.greenBorder,
      backgroundColor: theme.greenDim,
      color: theme.green,
      fontSize: sf(11),
      fontWeight: '900',
      paddingHorizontal: 9,
      paddingVertical: 5,
    },
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
    socialBox: { gap: 8 },
    socialTitle: { color: theme.textMuted, fontSize: sf(12), fontWeight: '800', textAlign: 'center' },
    socialGrid: { flexDirection: 'row', gap: 8 },
    socialButton: {
      flex: 1,
      minHeight: 46,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.bgElevated,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      opacity: 0.68,
    },
    socialMark: { color: theme.text, fontSize: sf(14), fontWeight: '900' },
    socialLabel: { color: theme.textDim, fontSize: sf(11), fontWeight: '800' },
    socialHint: { fontSize: sf(12), color: theme.textDim, lineHeight: sf(17), textAlign: 'center' },
    termsRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, paddingVertical: 2 },
    checkBox: {
      width: 20,
      height: 20,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.bgElevated,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 1,
    },
    checkBoxActive: { borderColor: theme.greenBorder, backgroundColor: theme.greenDim },
    checkText: { color: theme.green, fontSize: sf(12), fontWeight: '900' },
    termsText: { flex: 1, color: theme.textMuted, fontSize: sf(11), lineHeight: sf(17) },
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
