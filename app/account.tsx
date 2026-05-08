import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import type { AppTheme } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';
import type { MessageId } from '@/locales/messages';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import {
  fetchSignalMe,
  deleteSignalMe,
  disconnectSignalMyIdentity,
  fetchSignalMyIdentities,
  fetchSignalLegalTerms,
  formatSignalApiError,
  loginSignalUser,
  logoutSignalUser,
  registerSignalUser,
  setSignalMyPassword,
  updateSignalMe,
  fetchSignalSocialProviders,
  loginSignalSocial,
  linkSignalSocial,
  type SignalLegalTerm,
  type SignalAppUser,
  type SignalUserIdentity,
  type SignalSocialCatalog,
  type SocialProviderKey,
} from '@/integrations/signal-api';
import { SignalApiError } from '@/integrations/signal-api/client';
import {
  obtainSocialCredential,
  SocialAuthCancelledError,
  SocialAuthFlowError,
} from '@/integrations/signal-api/socialAuthFlow';
import { hasSignalApi } from '@/services/env';
import {
  clearAppAuthSession,
  getSessionAccessToken,
  loadAppAuthSession,
  saveAppAuthSession,
  type StoredAppAuthSession,
} from '@/services/appAuthSession';

type Mode = 'login' | 'register';

function socialApiCodeMessage(code: string | undefined): MessageId | null {
  switch (code) {
    case 'APP_USER_SOCIAL_EMAIL_CONFLICT':
      return 'accountSocialEmailConflict';
    case 'APP_USER_SOCIAL_IDENTITY_TAKEN':
      return 'accountSocialIdentityTaken';
    case 'APP_USER_SOCIAL_NOT_CONFIGURED':
    case 'APP_USER_JWT_NOT_CONFIGURED':
      return 'accountSocialDisabled';
    case 'APP_USER_SOCIAL_KAKAO_UPSTREAM':
      return 'accountSocialKakaoUpstream';
    case 'APP_USER_SOCIAL_INVALID_TOKEN':
    case 'APP_USER_SOCIAL_INVALID_PROFILE':
    case 'APP_USER_SOCIAL_UNSUPPORTED':
      return 'accountSocialInvalid';
    default:
      return null;
  }
}

function mapSocialFlowErrorMessage(flowCode: string, translate: (id: MessageId) => string): string {
  switch (flowCode) {
    case 'disabled':
      return translate('accountSocialDisabled');
    case 'not_configured':
      return translate('accountSocialFlowNotConfigured');
    case 'kakao_expo_go_unsupported':
      return translate('accountSocialKakaoExpoGo');
    case 'apple_ios_only':
      return translate('accountSocialAppleIosOnly');
    case 'apple_unavailable':
      return translate('accountSocialAppleUnavailable');
    default:
      return translate('accountSocialInvalid');
  }
}

function formatSocialAuthFailure(
  e: unknown,
  translate: (id: MessageId) => string,
  apiFallbackId: MessageId,
): string | null {
  if (e instanceof SocialAuthCancelledError) return null;
  if (e instanceof SocialAuthFlowError) return mapSocialFlowErrorMessage(e.message, translate);
  if (e instanceof SignalApiError) {
    const mid = socialApiCodeMessage(e.message);
    return mid ? translate(mid) : formatSignalApiError(e, translate, apiFallbackId);
  }
  return formatSignalApiError(e, translate, apiFallbackId);
}

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
  const [newPassword, setNewPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [profileImageUrl, setProfileImageUrl] = useState('');
  const [serviceTermsAccepted, setServiceTermsAccepted] = useState(false);
  const [privacyTermsAccepted, setPrivacyTermsAccepted] = useState(false);
  const [legalTerms, setLegalTerms] = useState<SignalLegalTerm[]>([]);
  const [linkedIdentities, setLinkedIdentities] = useState<SignalUserIdentity[]>([]);
  const [socialCatalog, setSocialCatalog] = useState<SignalSocialCatalog | null>(null);
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

  useEffect(() => {
    let cancelled = false;
    if (!hasSignalApi()) {
      setSocialCatalog(null);
      return () => {
        cancelled = true;
      };
    }
    fetchSignalSocialProviders()
      .then((c) => {
        if (!cancelled) setSocialCatalog(c);
      })
      .catch(() => {
        if (!cancelled) setSocialCatalog(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const startSocialLogin = useCallback(
    async (provider: SocialProviderKey) => {
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
      let catalog = socialCatalog;
      if (!catalog) {
        try {
          catalog = await fetchSignalSocialProviders();
          setSocialCatalog(catalog);
        } catch {
          setError(t('accountSocialDisabled'));
          return;
        }
      }
      if (!catalog.providers[provider]?.enabled) {
        setError(t('accountSocialDisabled'));
        return;
      }
      setSaving(true);
      setError(null);
      try {
        const cred = await obtainSocialCredential(provider, catalog);
        const acceptedTerms =
          mode === 'register'
            ? [serviceTerm, privacyTerm]
                .filter((term): term is SignalLegalTerm => !!term)
                .map((term) => ({ type: term.type, locale: term.locale, version: term.version }))
            : [];
        const next = await loginSignalSocial({
          provider,
          ...cred,
          locale,
          acceptedTerms: mode === 'register' ? acceptedTerms : undefined,
        });
        await saveAppAuthSession(next);
        setSession(next);
      } catch (e) {
        const msg = formatSocialAuthFailure(e, t, 'accountAuthError');
        if (msg) setError(msg);
      } finally {
        setSaving(false);
      }
    },
    [allTermsAccepted, locale, mode, privacyTerm, registerStep, serviceTerm, socialCatalog, t],
  );

  const linkSocialAccount = useCallback(
    async (provider: SocialProviderKey) => {
      const access = getSessionAccessToken(session);
      if (!access || !hasSignalApi()) return;
      let catalog = socialCatalog;
      if (!catalog) {
        try {
          catalog = await fetchSignalSocialProviders();
          setSocialCatalog(catalog);
        } catch {
          setError(t('accountSocialDisabled'));
          return;
        }
      }
      if (!catalog.providers[provider]?.enabled) {
        setError(t('accountSocialDisabled'));
        return;
      }
      setSaving(true);
      setError(null);
      try {
        const cred = await obtainSocialCredential(provider, catalog);
        const { user: nextUser } = await linkSignalSocial(access, { provider, ...cred });
        const rows = await fetchSignalMyIdentities(access);
        setLinkedIdentities(rows);
        const next = { ...session!, user: nextUser } as StoredAppAuthSession;
        await saveAppAuthSession(next);
        setSession(next);
      } catch (e) {
        const msg = formatSocialAuthFailure(e, t, 'accountAuthError');
        if (msg) setError(msg);
      } finally {
        setSaving(false);
      }
    },
    [session, socialCatalog, t],
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
    const access = getSessionAccessToken(saved);
    if (!access || !hasSignalApi()) return;
    try {
      const fresh = await fetchSignalMe(access);
      const next = { ...saved!, user: fresh } as StoredAppAuthSession;
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

  useEffect(() => {
    let cancelled = false;
    const access = getSessionAccessToken(session);
    if (!access || !hasSignalApi()) {
      setLinkedIdentities([]);
      return () => {
        cancelled = true;
      };
    }
    fetchSignalMyIdentities(access)
      .then((rows: SignalUserIdentity[]) => {
        if (!cancelled) setLinkedIdentities(rows);
      })
      .catch(() => {
        if (!cancelled) setLinkedIdentities([]);
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

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
    const access = getSessionAccessToken(session);
    if (!access) return;
    setSaving(true);
    setError(null);
    try {
      const nextUser = await updateSignalMe(access, { nickname, profileImageUrl });
      const next = { ...session!, user: nextUser } as StoredAppAuthSession;
      await saveAppAuthSession(next);
      setSession(next);
    } catch (e) {
      setError(formatSignalApiError(e, t, 'accountProfileError'));
    } finally {
      setSaving(false);
    }
  }, [nickname, profileImageUrl, session, t]);

  const logout = useCallback(async () => {
    const access = getSessionAccessToken(session);
    setSaving(true);
    try {
      if (access) await logoutSignalUser(access).catch(() => {});
      await clearAppAuthSession();
      setSession(null);
      setPassword('');
    } finally {
      setSaving(false);
    }
  }, [session]);

  const withdraw = useCallback(() => {
    const access = getSessionAccessToken(session);
    if (!access) return;
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
              await deleteSignalMe(access);
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
  }, [session, t]);

  const disconnectIdentity = useCallback(
    async (identity: SignalUserIdentity) => {
      const access = getSessionAccessToken(session);
      if (!access) return;
      setSaving(true);
      setError(null);
      try {
        await disconnectSignalMyIdentity(access, identity.id);
        setLinkedIdentities((items) => items.filter((item) => item.id !== identity.id));
      } catch (e) {
        setError(formatSignalApiError(e, t, 'accountIdentityDisconnectError'));
      } finally {
        setSaving(false);
      }
    },
    [session, t],
  );

  const savePassword = useCallback(async () => {
    const access = getSessionAccessToken(session);
    if (!access) return;
    setSaving(true);
    setError(null);
    try {
      const nextUser = await setSignalMyPassword(access, newPassword);
      const next = { ...session!, user: nextUser } as StoredAppAuthSession;
      await saveAppAuthSession(next);
      setSession(next);
      setNewPassword('');
    } catch (e) {
      setError(formatSignalApiError(e, t, 'accountPasswordSaveError'));
    } finally {
      setSaving(false);
    }
  }, [newPassword, session, t]);

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
      {
        key: 'termsHistory',
        icon: 'file-signature',
        title: t('accountActivityTermsHistory'),
        body: t('accountActivityTermsHistoryDesc'),
        onPress: () => router.push('/terms-history' as never),
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

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>{t('accountSocialLinkedTitle')}</Text>
              <Text style={styles.sectionLead}>{t('accountSocialLinkedDesc')}</Text>
              {linkedIdentities.length === 0 ? (
                <Text style={styles.mutedText}>{t('accountSocialLinkedEmpty')}</Text>
              ) : (
                <View style={styles.identityStack}>
                  {linkedIdentities.map((identity) => (
                    <View key={identity.id} style={styles.identityRow}>
                      <View style={styles.activityIcon}>
                        <FontAwesome5
                          name={
                            identity.provider === 'apple'
                              ? 'apple'
                              : identity.provider === 'google'
                                ? 'google'
                                : identity.provider === 'kakao'
                                  ? 'comment'
                                  : 'link'
                          }
                          size={15}
                          color={theme.green}
                        />
                      </View>
                      <View style={styles.activityText}>
                        <Text style={styles.activityTitle}>{identity.provider}</Text>
                        <Text style={styles.activityDesc} numberOfLines={1}>
                          {identity.email || identity.displayName || identity.providerUserId}
                        </Text>
                      </View>
                      <Pressable disabled={saving} onPress={() => void disconnectIdentity(identity)} style={styles.smallOutlineBtn}>
                        <Text style={styles.smallOutlineText}>{t('accountSocialDisconnect')}</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>{t('accountSocialLinkTitle')}</Text>
              <Text style={styles.sectionLead}>{t('accountSocialLinkHint')}</Text>
              <View style={styles.socialLinkStack}>
                {(['kakao', 'naver', 'google', 'apple'] as const).some(
                  (prov) =>
                    socialCatalog?.providers[prov]?.enabled &&
                    !linkedIdentities.some((i) => i.provider === prov) &&
                    !(prov === 'apple' && Platform.OS !== 'ios'),
                ) ? (
                  (['kakao', 'naver', 'google', 'apple'] as const).map((prov) => {
                    const cfg = socialCatalog?.providers[prov];
                    const linked = linkedIdentities.some((i) => i.provider === prov);
                    if (linked || !cfg?.enabled) return null;
                    if (prov === 'apple' && Platform.OS !== 'ios') return null;
                    const label =
                      prov === 'kakao'
                        ? t('accountSocialKakao')
                        : prov === 'naver'
                          ? t('accountSocialNaver')
                          : prov === 'google'
                            ? t('accountSocialGoogle')
                            : t('accountSocialApple');
                    return (
                      <Pressable
                        key={prov}
                        disabled={saving}
                        onPress={() => void linkSocialAccount(prov)}
                        style={({ pressed }) => [styles.socialLinkRow, pressed && styles.activityRowPressed]}
                        accessibilityRole="button"
                        accessibilityLabel={`${label} ${t('accountSocialLinkMore')}`}>
                        <Text style={styles.socialLinkText}>
                          {label} · {t('accountSocialLinkMore')}
                        </Text>
                        <FontAwesome5 name="chevron-right" size={12} color={theme.textDim} />
                      </Pressable>
                    );
                  })
                ) : socialCatalog ? (
                  <Text style={styles.mutedText}>{t('accountSocialLinkNone')}</Text>
                ) : null}
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>{t('accountPasswordSectionTitle')}</Text>
              <Text style={styles.sectionLead}>
                {user.hasPassword ? t('accountPasswordSectionDesc') : t('accountPasswordRequiredForUnlink')}
              </Text>
              <TextInput
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder={t('accountNewPasswordPlaceholder')}
                placeholderTextColor={theme.textDim}
                secureTextEntry
                style={styles.input}
              />
              <Pressable disabled={saving || newPassword.length < 8} onPress={() => void savePassword()} style={styles.primaryBtn}>
                <Text style={styles.primaryText}>{saving ? t('commonLoading') : t('accountPasswordSaveButton')}</Text>
              </Pressable>
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
                  disabled={saving || (!!socialCatalog && socialCatalog.providers.kakao?.enabled !== true)}
                  onPress={() => void startSocialLogin('kakao')}
                  accessibilityRole="button"
                  accessibilityLabel={t('accountSocialKakao')}
                  style={({ pressed }) => [styles.socialButton, styles.socialButtonKakao, pressed && styles.socialButtonPressed]}>
                  <View style={[styles.socialBrand, styles.socialBrandKakao]}>
                    <FontAwesome5 name="comment" size={14} color="#191600" />
                  </View>
                  <Text style={[styles.socialLabel, styles.socialLabelDark]}>{t('accountSocialKakao')}</Text>
                </Pressable>
                <Pressable
                  disabled={saving || (!!socialCatalog && socialCatalog.providers.naver?.enabled !== true)}
                  onPress={() => void startSocialLogin('naver')}
                  accessibilityRole="button"
                  accessibilityLabel={t('accountSocialNaver')}
                  style={({ pressed }) => [styles.socialButton, styles.socialButtonNaver, pressed && styles.socialButtonPressed]}>
                  <View style={[styles.socialBrand, styles.socialBrandNaver]}>
                    <Text style={styles.socialBrandLetter}>N</Text>
                  </View>
                  <Text style={[styles.socialLabel, styles.socialLabelLight]}>{t('accountSocialNaver')}</Text>
                </Pressable>
                <Pressable
                  disabled={saving || (!!socialCatalog && socialCatalog.providers.google?.enabled !== true)}
                  onPress={() => void startSocialLogin('google')}
                  accessibilityRole="button"
                  accessibilityLabel={t('accountSocialGoogle')}
                  style={({ pressed }) => [styles.socialButton, styles.socialButtonGoogle, pressed && styles.socialButtonPressed]}>
                  <View style={[styles.socialBrand, styles.socialBrandGoogle]}>
                    <FontAwesome5 name="google" size={14} color="#4285F4" />
                  </View>
                  <Text style={styles.socialLabel}>{t('accountSocialGoogle')}</Text>
                </Pressable>
                <Pressable
                  disabled={
                    saving ||
                    Platform.OS !== 'ios' ||
                    (!!socialCatalog && socialCatalog.providers.apple?.enabled !== true)
                  }
                  onPress={() => void startSocialLogin('apple')}
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
    mutedText: { color: theme.textMuted, fontSize: sf(12), lineHeight: sf(18), fontWeight: '700' },
    identityStack: { gap: 8 },
    socialLinkStack: { gap: 8, marginTop: 4 },
    socialLinkRow: {
      minHeight: 48,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.bgElevated,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 10,
      gap: 8,
    },
    socialLinkText: { flex: 1, color: theme.text, fontSize: sf(13), fontWeight: '800' },
    identityRow: {
      minHeight: 54,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.bgElevated,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    smallOutlineBtn: {
      minHeight: 28,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    smallOutlineText: { color: theme.textMuted, fontSize: sf(10), fontWeight: '900' },
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
