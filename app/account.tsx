import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import type { AppTheme } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import {
  fetchSignalMe,
  deleteSignalMe,
  fetchSignalLegalTerms,
  formatSignalApiError,
  loginSignalUser,
  logoutSignalUser,
  registerSignalUser,
  updateSignalMe,
  type SignalLegalTerm,
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
type SocialProvider = 'kakao' | 'naver' | 'google' | 'apple';

export default function AccountScreen() {
  const router = useRouter();
  const { theme, scaleFont } = useSignalTheme();
  const { t, locale } = useLocale();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(theme, scaleFont), [theme, scaleFont]);
  const [session, setSession] = useState<StoredAppAuthSession | null>(null);
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [profileImageUrl, setProfileImageUrl] = useState('');
  const [serviceTermsAccepted, setServiceTermsAccepted] = useState(false);
  const [privacyTermsAccepted, setPrivacyTermsAccepted] = useState(false);
  const [legalTerms, setLegalTerms] = useState<SignalLegalTerm[]>([]);
  const [registerStep, setRegisterStep] = useState<'terms' | 'info'>('terms');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const user: SignalAppUser | null = session?.user ?? null;
  const isRegister = mode === 'register';
  const allTermsAccepted = serviceTermsAccepted && privacyTermsAccepted;
  const serviceTerm = legalTerms.find((term) => term.type === 'service');
  const privacyTerm = legalTerms.find((term) => term.type === 'privacy');
  const copyrightYear = new Date().getFullYear();

  const fallbackLegalTerms = useMemo<SignalLegalTerm[]>(
    () => [
      {
        id: `service:${locale}`,
        type: 'service',
        locale,
        version: '2026.05.07',
        title: t('termsServiceTitle'),
        body: t('termsServiceBody'),
        required: true,
        active: true,
      },
      {
        id: `privacy:${locale}`,
        type: 'privacy',
        locale,
        version: '2026.05.07',
        title: t('termsPrivacyTitle'),
        body: t('termsPrivacyBody'),
        required: true,
        active: true,
      },
    ],
    [locale, t],
  );

  const startSocialLogin = useCallback(
    (_provider: SocialProvider) => {
      setError(t('accountSocialComingSoon'));
    },
    [t],
  );

  const switchMode = useCallback((next: Mode) => {
    setMode(next);
    setError(null);
    setPassword('');
    setRegisterStep('terms');
  }, []);

  const toggleAllTerms = useCallback(() => {
    const next = !allTermsAccepted;
    setServiceTermsAccepted(next);
    setPrivacyTermsAccepted(next);
  }, [allTermsAccepted]);

  const continueRegisterInfo = useCallback(() => {
    if (!allTermsAccepted) {
      setError(t('accountTermsRequired'));
      return;
    }
    setError(null);
    setRegisterStep('info');
  }, [allTermsAccepted, t]);

  const openTerms = useCallback(
    (type: 'service' | 'privacy') => {
      router.push({ pathname: '/terms', params: { type } });
    },
    [router],
  );

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
    let cancelled = false;
    if (!hasSignalApi()) {
      setLegalTerms(fallbackLegalTerms);
      return () => {
        cancelled = true;
      };
    }
    fetchSignalLegalTerms(locale)
      .then((rows) => {
        if (!cancelled) setLegalTerms(rows.length > 0 ? rows : fallbackLegalTerms);
      })
      .catch(() => {
        if (!cancelled) setLegalTerms(fallbackLegalTerms);
      });
    return () => {
      cancelled = true;
    };
  }, [fallbackLegalTerms, locale]);

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
    if (mode === 'register' && !allTermsAccepted) {
      setError(t('accountTermsRequired'));
      return;
    }
    if (mode === 'register' && registerStep !== 'info') {
      setRegisterStep('info');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const next =
        mode === 'register'
          ? await registerSignalUser({
              email,
              password,
              nickname,
              profileImageUrl,
              locale,
              acceptedTerms: [serviceTerm, privacyTerm]
                .filter((term): term is SignalLegalTerm => !!term)
                .map((term) => ({ type: term.type, locale: term.locale, version: term.version })),
            })
          : await loginSignalUser({ email, password });
      await saveAppAuthSession(next);
      setSession(next);
      setPassword('');
    } catch (e) {
      setError(formatSignalApiError(e, t, 'accountAuthError'));
    } finally {
      setSaving(false);
    }
  }, [allTermsAccepted, email, locale, mode, nickname, password, privacyTerm, profileImageUrl, registerStep, serviceTerm, t]);

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

  const withdraw = useCallback(() => {
    if (!session?.token) return;
    Alert.alert(t('accountWithdrawConfirmTitle'), t('accountWithdrawConfirmBody'), [
      { text: t('commonCancel'), style: 'cancel' },
      {
        text: t('accountWithdrawConfirmButton'),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setSaving(true);
            setError(null);
            try {
              await deleteSignalMe(session.token);
              await clearAppAuthSession();
              setSession(null);
              setPassword('');
            } catch (e) {
              setError(formatSignalApiError(e, t, 'accountWithdrawError'));
            } finally {
              setSaving(false);
            }
          })();
        },
      },
    ]);
  }, [session?.token, t]);

  const activityLinks = useMemo(
    () => [
      {
        key: 'alerts',
        icon: 'bell',
        title: t('accountActivityAlerts'),
        body: t('accountActivityAlertsDesc'),
        onPress: () => router.push('/alerts'),
      },
      {
        key: 'signals',
        icon: 'bolt',
        title: t('accountActivitySignals'),
        body: t('accountActivitySignalsDesc'),
        onPress: () => router.push('/insights'),
      },
      {
        key: 'briefing',
        icon: 'briefcase',
        title: t('accountActivityBriefing'),
        body: t('accountActivityBriefingDesc'),
        onPress: () => router.push('/briefing'),
      },
      {
        key: 'notificationSettings',
        icon: 'cog',
        title: t('accountActivityNotificationSettings'),
        body: t('accountActivityNotificationSettingsDesc'),
        onPress: () => router.push('/settings?tab=notifications'),
      },
    ],
    [router, t],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <Stack.Screen options={{ title: t('screenAccount') }} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 28 + insets.bottom }]}>
        {!user ? (
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
            <Text style={styles.title}>{t('accountAuthTitle')}</Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errBox}>
            <Text style={styles.errText}>{error}</Text>
          </View>
        ) : null}

        {user ? (
          <>
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>{t('accountProfileSectionTitle')}</Text>
              <View style={styles.profileRow}>
                {profileImageUrl ? (
                  <Image source={{ uri: profileImageUrl }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Text style={styles.avatarText}>{user.nickname.slice(0, 1).toUpperCase()}</Text>
                  </View>
                )}
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
              <Pressable disabled={saving} onPress={() => void saveProfile()} style={styles.primaryBtn}>
                <Text style={styles.primaryText}>{saving ? t('commonLoading') : t('accountSaveProfile')}</Text>
              </Pressable>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>{t('accountActivityTitle')}</Text>
              <Text style={styles.sectionLead}>{t('accountActivityLead')}</Text>
              <View style={styles.activityStack}>
                {activityLinks.map((item) => (
                  <Pressable
                    key={item.key}
                    onPress={item.onPress}
                    style={({ pressed }) => [styles.activityRow, pressed && styles.activityRowPressed]}
                    accessibilityRole="button"
                    accessibilityLabel={item.title}>
                    <View style={styles.activityIcon}>
                      <FontAwesome5 name={item.icon} size={15} color={theme.green} />
                    </View>
                    <View style={styles.activityText}>
                      <Text style={styles.activityTitle}>{item.title}</Text>
                      <Text style={styles.activityDesc} numberOfLines={1}>{item.body}</Text>
                    </View>
                    <FontAwesome5 name="chevron-right" size={12} color={theme.textDim} />
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.accountFooter}>
              <View style={styles.footerActionRow}>
                <Pressable disabled={saving} onPress={() => void logout()} style={styles.footerActionBtn}>
                  <Text style={styles.footerActionText}>{t('accountLogout')}</Text>
                </Pressable>
                <Pressable disabled={saving} onPress={withdraw} style={[styles.footerActionBtn, styles.withdrawBtn]}>
                  <Text style={[styles.footerActionText, styles.withdrawText]}>{t('accountWithdraw')}</Text>
                </Pressable>
              </View>
              <View style={styles.legalLinkRow}>
                <Pressable onPress={() => openTerms('service')} hitSlop={8}>
                  <Text style={styles.legalLinkText}>{t('termsServiceTitle')}</Text>
                </Pressable>
                <Text style={styles.legalLinkSep}>·</Text>
                <Pressable onPress={() => openTerms('privacy')} hitSlop={8}>
                  <Text style={styles.legalLinkText}>{t('termsPrivacyTitle')}</Text>
                </Pressable>
              </View>
              <Text style={styles.copyrightText}>
                {t('accountFooterCopyright').replace('{{year}}', String(copyrightYear))}
              </Text>
            </View>
          </>
        ) : (
          <View style={styles.card}>
            <View style={styles.socialBox}>
              <Text style={styles.authCardTitle}>{t(isRegister ? 'accountModeRegister' : 'accountSocialTitle')}</Text>
              <View style={styles.socialStack}>
                <Pressable
                  onPress={() => startSocialLogin('kakao')}
                  accessibilityRole="button"
                  accessibilityLabel={t('accountSocialKakao')}
                  style={({ pressed }) => [styles.socialButton, styles.socialButtonKakao, pressed && styles.socialButtonPressed]}>
                  <View style={[styles.socialBrand, styles.socialBrandKakao]}>
                    <FontAwesome5 name="comment" size={14} color="#191600" />
                  </View>
                  <Text style={[styles.socialLabel, styles.socialLabelDark]}>{t('accountSocialKakao')}</Text>
                </Pressable>
                <Pressable
                  onPress={() => startSocialLogin('naver')}
                  accessibilityRole="button"
                  accessibilityLabel={t('accountSocialNaver')}
                  style={({ pressed }) => [styles.socialButton, styles.socialButtonNaver, pressed && styles.socialButtonPressed]}>
                  <View style={[styles.socialBrand, styles.socialBrandNaver]}>
                    <Text style={styles.socialBrandLetter}>N</Text>
                  </View>
                  <Text style={[styles.socialLabel, styles.socialLabelLight]}>{t('accountSocialNaver')}</Text>
                </Pressable>
                <Pressable
                  onPress={() => startSocialLogin('google')}
                  accessibilityRole="button"
                  accessibilityLabel={t('accountSocialGoogle')}
                  style={({ pressed }) => [styles.socialButton, styles.socialButtonGoogle, pressed && styles.socialButtonPressed]}>
                  <View style={[styles.socialBrand, styles.socialBrandGoogle]}>
                    <FontAwesome5 name="google" size={14} color="#4285F4" />
                  </View>
                  <Text style={styles.socialLabel}>{t('accountSocialGoogle')}</Text>
                </Pressable>
                <Pressable
                  onPress={() => startSocialLogin('apple')}
                  accessibilityRole="button"
                  accessibilityLabel={t('accountSocialApple')}
                  style={({ pressed }) => [styles.socialButton, styles.socialButtonApple, pressed && styles.socialButtonPressed]}>
                  <View style={[styles.socialBrand, styles.socialBrandApple]}>
                    <FontAwesome5 name="apple" size={16} color={theme.bg} />
                  </View>
                  <Text style={styles.socialLabel}>{t('accountSocialApple')}</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>{t('accountEmailDivider')}</Text>
              <View style={styles.dividerLine} />
            </View>

            {isRegister ? (
              <View style={styles.termsBox}>
                <Pressable
                  onPress={toggleAllTerms}
                  style={[styles.termsRow, styles.termsAllRow]}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: allTermsAccepted }}>
                  <View style={[styles.checkBox, allTermsAccepted && styles.checkBoxActive]}>
                    <Text style={styles.checkText}>{allTermsAccepted ? '✓' : ''}</Text>
                  </View>
                  <Text style={styles.termsAllText}>{t('accountTermsAll')}</Text>
                </Pressable>
                <View style={styles.termsDivider} />
                <View style={styles.termsItem}>
                  <Pressable
                    onPress={() => setServiceTermsAccepted((value) => !value)}
                    style={styles.termsRow}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: serviceTermsAccepted }}>
                    <View style={[styles.checkBox, serviceTermsAccepted && styles.checkBoxActive]}>
                      <Text style={styles.checkText}>{serviceTermsAccepted ? '✓' : ''}</Text>
                    </View>
                    <Text style={styles.termsText} numberOfLines={1}>
                      {serviceTerm?.title || t('termsServiceTitle')}
                      {serviceTerm?.version ? ` v${serviceTerm.version}` : ''}
                    </Text>
                    {serviceTerm?.required !== false ? (
                      <View style={styles.requiredBadge}>
                        <Text style={styles.requiredBadgeText}>{t('accountTermsRequiredBadge')}</Text>
                      </View>
                    ) : null}
                  </Pressable>
                  <Pressable
                    onPress={() => openTerms('service')}
                    style={styles.termsOpenBtn}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={t('termsServiceTitle')}>
                    <FontAwesome5 name="chevron-right" size={12} color={theme.green} />
                  </Pressable>
                </View>
                <View style={styles.termsItem}>
                  <Pressable
                    onPress={() => setPrivacyTermsAccepted((value) => !value)}
                    style={styles.termsRow}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: privacyTermsAccepted }}>
                    <View style={[styles.checkBox, privacyTermsAccepted && styles.checkBoxActive]}>
                      <Text style={styles.checkText}>{privacyTermsAccepted ? '✓' : ''}</Text>
                    </View>
                    <Text style={styles.termsText} numberOfLines={1}>
                      {privacyTerm?.title || t('termsPrivacyTitle')}
                      {privacyTerm?.version ? ` v${privacyTerm.version}` : ''}
                    </Text>
                    {privacyTerm?.required !== false ? (
                      <View style={styles.requiredBadge}>
                        <Text style={styles.requiredBadgeText}>{t('accountTermsRequiredBadge')}</Text>
                      </View>
                    ) : null}
                  </Pressable>
                  <Pressable
                    onPress={() => openTerms('privacy')}
                    style={styles.termsOpenBtn}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={t('termsPrivacyTitle')}>
                    <FontAwesome5 name="chevron-right" size={12} color={theme.green} />
                  </Pressable>
                </View>
              </View>
            ) : null}

            {!isRegister || registerStep === 'info' ? (
              <>
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
                {isRegister ? (
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
              </>
            ) : null}

            <Pressable
              disabled={saving || (isRegister && registerStep === 'terms' && !allTermsAccepted)}
              onPress={() => (isRegister && registerStep === 'terms' ? continueRegisterInfo() : void submitAuth())}
              style={[
                styles.primaryBtn,
                isRegister && registerStep === 'terms' && !allTermsAccepted ? styles.primaryBtnDisabled : null,
              ]}>
              <Text
                style={[
                  styles.primaryText,
                  isRegister && registerStep === 'terms' && !allTermsAccepted ? styles.primaryTextDisabled : null,
                ]}>
                {saving
                  ? t('commonLoading')
                  : t(isRegister && registerStep === 'terms' ? 'accountTermsNextButton' : isRegister ? 'accountRegisterButton' : 'accountLoginButton')}
              </Text>
            </Pressable>
            <View style={styles.authSwitchRow}>
              <Text style={styles.authSwitchText}>{t(isRegister ? 'accountLoginPrompt' : 'accountSignupPrompt')}</Text>
              <Pressable onPress={() => switchMode(isRegister ? 'login' : 'register')} hitSlop={8}>
                <Text style={styles.authSwitchBtn}>{t(isRegister ? 'accountLoginButton' : 'accountSignupButton')}</Text>
              </Pressable>
            </View>
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
    errBox: { borderRadius: 12, borderWidth: 1, borderColor: '#553333', backgroundColor: '#2A1515', padding: 12 },
    errText: { color: '#E0A0A0', fontSize: sf(12), lineHeight: sf(18) },
    sectionTitle: { color: theme.text, fontSize: sf(16), fontWeight: '900' },
    sectionLead: { color: theme.textMuted, fontSize: sf(12), lineHeight: sf(18), marginTop: -4 },
    authCardTitle: { color: theme.text, fontSize: sf(17), fontWeight: '900', textAlign: 'center' },
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
    primaryBtnDisabled: { backgroundColor: theme.bgElevated, borderWidth: 1, borderColor: theme.border },
    primaryText: { color: '#06100B', fontSize: sf(14), fontWeight: '900' },
    primaryTextDisabled: { color: theme.textDim },
    socialBox: { gap: 12 },
    socialStack: { gap: 8 },
    socialButton: {
      minHeight: 48,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.bgElevated,
      alignItems: 'center',
      justifyContent: 'flex-start',
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: 12,
    },
    socialButtonPressed: { opacity: 0.78 },
    socialButtonKakao: { backgroundColor: '#FEE500', borderColor: '#FEE500' },
    socialButtonNaver: { backgroundColor: '#03C75A', borderColor: '#03C75A' },
    socialButtonGoogle: { backgroundColor: theme.bgElevated, borderColor: theme.border },
    socialButtonApple: { backgroundColor: theme.bgElevated, borderColor: theme.border },
    socialBrand: {
      width: 28,
      height: 28,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
    },
    socialBrandKakao: { backgroundColor: '#FEE500', borderColor: 'rgba(0,0,0,0.12)' },
    socialBrandNaver: { backgroundColor: '#03C75A', borderColor: 'rgba(255,255,255,0.2)' },
    socialBrandGoogle: { backgroundColor: '#FFFFFF', borderColor: '#E2E6EA' },
    socialBrandApple: { backgroundColor: theme.text, borderColor: theme.text },
    socialBrandLetter: { color: '#FFFFFF', fontSize: sf(15), fontWeight: '900' },
    socialLabel: { color: theme.text, fontSize: sf(14), fontWeight: '900' },
    socialLabelDark: { color: '#191600' },
    socialLabelLight: { color: '#FFFFFF' },
    dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 2 },
    dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: theme.border },
    dividerText: { color: theme.textDim, fontSize: sf(11), fontWeight: '800' },
    authSwitchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingTop: 2 },
    authSwitchText: { color: theme.textMuted, fontSize: sf(12), fontWeight: '700' },
    authSwitchBtn: { color: theme.green, fontSize: sf(13), fontWeight: '900' },
    termsBox: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.bgElevated,
      padding: 12,
      gap: 10,
    },
    termsAllRow: { alignItems: 'center' },
    termsAllText: { flex: 1, color: theme.text, fontSize: sf(13), lineHeight: sf(18), fontWeight: '900' },
    termsDivider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.border },
    termsItem: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 },
    termsRow: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 2 },
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
    termsText: { flex: 1, minWidth: 0, color: theme.textMuted, fontSize: sf(11), lineHeight: sf(17) },
    requiredBadge: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.greenBorder,
      backgroundColor: theme.greenDim,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    requiredBadgeText: { color: theme.green, fontSize: sf(9), lineHeight: sf(12), fontWeight: '900' },
    termsOpenBtn: {
      width: 28,
      height: 28,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.greenBorder,
      backgroundColor: theme.greenDim,
      flexShrink: 0,
    },
    profileRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    avatar: { width: 56, height: 56, borderRadius: 18, backgroundColor: theme.bgElevated },
    avatarFallback: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.greenDim, borderWidth: 1, borderColor: theme.greenBorder },
    avatarText: { color: theme.green, fontSize: sf(22), fontWeight: '900' },
    profileText: { flex: 1, minWidth: 0 },
    profileName: { color: theme.text, fontSize: sf(17), fontWeight: '900' },
    profileEmail: { color: theme.textMuted, fontSize: sf(12), marginTop: 3 },
    activityStack: { gap: 8 },
    activityRow: {
      minHeight: 58,
      borderRadius: 13,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.bgElevated,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 9,
    },
    activityRowPressed: { opacity: 0.78 },
    activityIcon: {
      width: 34,
      height: 34,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.greenDim,
      borderWidth: 1,
      borderColor: theme.greenBorder,
    },
    activityText: { flex: 1, minWidth: 0 },
    activityTitle: { color: theme.text, fontSize: sf(13), fontWeight: '900' },
    activityDesc: { color: theme.textMuted, fontSize: sf(11), lineHeight: sf(16), marginTop: 2 },
    accountFooter: { gap: 10, paddingTop: 4, paddingHorizontal: 4, alignItems: 'center' },
    footerActionRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, flexWrap: 'wrap' },
    footerActionBtn: {
      minHeight: 28,
      minWidth: 70,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.bgElevated,
      paddingHorizontal: 11,
    },
    footerActionText: { color: theme.textMuted, fontSize: sf(11), fontWeight: '900' },
    withdrawBtn: { borderColor: '#553333', backgroundColor: '#2A1515' },
    withdrawText: { color: '#E0A0A0' },
    legalLinkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, flexWrap: 'wrap' },
    legalLinkText: { color: theme.green, fontSize: sf(11), fontWeight: '900' },
    legalLinkSep: { color: theme.textDim, fontSize: sf(11), fontWeight: '800' },
    copyrightText: { color: theme.textDim, fontSize: sf(10), fontWeight: '700' },
  });
}
