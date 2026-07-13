import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Image, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { SocialAuthButtons } from '@/components/account/SocialAuthButtons';
import { IpadSidebarScreen } from '@/components/layout/IpadSidebarScreen';
import { WebWheelScrollView } from '@/components/layout/WebWheelScrollView';
import { makeAccountStyles } from '@/components/account/accountStyles';
import { stackScreenScrollBottomPadding } from '@/constants/screenLayout';
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
  confirmSignalMyEmailChange,
  loginSignalSocial,
  linkSignalSocial,
  previewSignalSocialSignup,
  requestSignalMyEmailChange,
  type SignalLegalTerm,
  type SignalAppUser,
  type SignalUserIdentity,
  type SignalSocialCatalog,
  type SocialProviderKey,
} from '@/integrations/signal-api';
import {
  createFallbackLegalTerms,
  formatJoinedAtLabel,
  signInMethodLabel as formatSignInMethodLabel,
  socialSignupDraftFromPreview,
  type SocialSignupDraft,
} from '@/domain/account/display';
import { formatSocialAuthFailure } from '@/domain/account/authErrors';
import { SignalApiError } from '@/integrations/signal-api/httpClient';
import {
  obtainSocialCredential,
} from '@/integrations/signal-api/socialAuthFlow';
import { hasSignalApi, isIosAppleSignInNativeEnabled } from '@/services/env';
import {
  clearAppAuthSession,
  getSessionAccessToken,
  loadAppAuthSession,
  saveAppAuthSession,
  type StoredAppAuthSession,
} from '@/services/appAuthSession';
import { loadNotificationPrefs, type NotificationPrefs } from '@/services/notificationPreferences';
import { APP_CONTENT_MAX_WIDTH, wideContentFill } from '@/constants/responsiveLayout';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { useScrollToTopOnChange } from '@/hooks/useScrollToTopOnChange';

type AccountTab = 'home' | 'profile' | 'security' | 'info';
type Mode = 'login' | 'register';
type RegisterStep = 'terms' | 'method' | 'info';

type AccountScreenProps = {
  /** iPad 사이드바 우측 패널에 그대로 삽입 */
  embedded?: boolean;
};

export default function AccountScreen({ embedded = false }: AccountScreenProps) {
  const router = useRouter();
  const { theme, scaleFont } = useSignalTheme();
  const { t, locale } = useLocale();
  const insets = useSafeAreaInsets();
  const { useTwoPane } = useResponsiveLayout();
  const params = useLocalSearchParams<{ from?: string }>();
  const useIpadSidebar = useTwoPane && !embedded;
  const styles = useMemo(() => makeAccountStyles(theme, scaleFont), [theme, scaleFont]);
  const [session, setSession] = useState<StoredAppAuthSession | null>(null);
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [emailChangeCode, setEmailChangeCode] = useState('');
  const [emailChangeRequestId, setEmailChangeRequestId] = useState('');
  const [emailChangeMasked, setEmailChangeMasked] = useState('');
  const [emailChangeNotice, setEmailChangeNotice] = useState<string | null>(null);
  const [nickname, setNickname] = useState('');
  const [profileImageUrl, setProfileImageUrl] = useState('');
  const [serviceTermsAccepted, setServiceTermsAccepted] = useState(false);
  const [privacyTermsAccepted, setPrivacyTermsAccepted] = useState(false);
  const [legalTerms, setLegalTerms] = useState<SignalLegalTerm[]>([]);
  const [linkedIdentities, setLinkedIdentities] = useState<SignalUserIdentity[]>([]);
  const [socialCatalog, setSocialCatalog] = useState<SignalSocialCatalog | null>(null);
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPrefs | null>(null);
  const [registerStep, setRegisterStep] = useState<RegisterStep>('terms');
  const [pendingSocialProvider, setPendingSocialProvider] = useState<SocialProviderKey | null>(null);
  const [socialSignupDraft, setSocialSignupDraft] = useState<SocialSignupDraft | null>(null);
  const [accountTab, setAccountTab] = useState<AccountTab>('home');
  const { ref: accountScrollRef } = useScrollToTopOnChange([accountTab]);
  const scrollResetKey = accountTab;
  const [emailAuthExpanded, setEmailAuthExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const user: SignalAppUser | null = session?.user ?? null;
  const isRegister = mode === 'register';
  const allTermsAccepted = serviceTermsAccepted && privacyTermsAccepted;
  const serviceTerm = legalTerms.find((term) => term.type === 'service');
  const privacyTerm = legalTerms.find((term) => term.type === 'privacy');
  const copyrightYear = new Date().getFullYear();
  const joinedAtLabel = useMemo(() => {
    return formatJoinedAtLabel(user, locale, t);
  }, [locale, t, user]);
  const signInMethodLabel = useMemo(() => {
    return formatSignInMethodLabel(user, linkedIdentities, t);
  }, [linkedIdentities, t, user]);

  const fallbackLegalTerms = useMemo<SignalLegalTerm[]>(
    () => createFallbackLegalTerms(locale, t),
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
        if (e instanceof SignalApiError && e.message === 'APP_USER_TERMS_REQUIRED') {
          setMode('register');
          setRegisterStep('terms');
          setPendingSocialProvider(provider);
          setError(t('accountSocialSignupRequired'));
          return;
        }
        const msg = formatSocialAuthFailure(e, t, 'accountAuthError');
        if (msg) setError(msg);
      } finally {
        setSaving(false);
      }
    },
    [allTermsAccepted, locale, mode, privacyTerm, serviceTerm, socialCatalog, t],
  );

  const startSocialSignup = useCallback(
    async (provider: SocialProviderKey) => {
      if (!hasSignalApi()) {
        setError(t('errorSignalApiShort'));
        return;
      }
      if (!allTermsAccepted) {
        setError(t('accountTermsRequired'));
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
        const preview = await previewSignalSocialSignup({ provider, ...cred });
        const draft = socialSignupDraftFromPreview({
          provider,
          signupToken: preview.signupToken,
          email: preview.profile.email,
          displayName: preview.profile.displayName,
          profileImageUrl: preview.profile.profileImageUrl,
        });
        setSocialSignupDraft(draft);
        setEmail(draft.email);
        setNickname(draft.nickname);
        setProfileImageUrl(draft.profileImageUrl);
        setRegisterStep('info');
      } catch (e) {
        const msg = formatSocialAuthFailure(e, t, 'accountAuthError');
        if (msg) setError(msg);
      } finally {
        setSaving(false);
      }
    },
    [allTermsAccepted, socialCatalog, t],
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
    setPendingSocialProvider(null);
    setSocialSignupDraft(null);
    setEmailAuthExpanded(false);
  }, []);

  const toggleAllTerms = useCallback(() => {
    const next = !allTermsAccepted;
    setServiceTermsAccepted(next);
    setPrivacyTermsAccepted(next);
  }, [allTermsAccepted]);

  const continueRegisterInfo = useCallback(async () => {
    if (!allTermsAccepted) {
      setError(t('accountTermsRequired'));
      return;
    }
    setError(null);
    if (pendingSocialProvider) {
      const provider = pendingSocialProvider;
      setPendingSocialProvider(null);
      await startSocialSignup(provider);
      return;
    }
    setEmailAuthExpanded(false);
    setRegisterStep('method');
  }, [allTermsAccepted, pendingSocialProvider, startSocialSignup, t]);

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
    loadNotificationPrefs()
      .then((prefs) => {
        if (!cancelled) setNotificationPrefs(prefs);
      })
      .catch(() => {
        if (!cancelled) setNotificationPrefs(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
    setNewEmail(user.email || '');
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
    if (mode === 'register' && socialSignupDraft) {
      setSaving(true);
      setError(null);
      try {
        const next = await loginSignalSocial({
          provider: socialSignupDraft.provider,
          signupToken: socialSignupDraft.signupToken,
          locale,
          acceptedTerms: [serviceTerm, privacyTerm]
            .filter((term): term is SignalLegalTerm => !!term)
            .map((term) => ({ type: term.type, locale: term.locale, version: term.version })),
          signupProfile: {
            email,
            nickname,
            profileImageUrl,
          },
        });
        await saveAppAuthSession(next);
        setSession(next);
        setSocialSignupDraft(null);
        setPassword('');
      } catch (e) {
        setError(formatSignalApiError(e, t, 'accountAuthError'));
      } finally {
        setSaving(false);
      }
      return;
    }
    if (mode === 'register' && registerStep !== 'info') {
      setRegisterStep('method');
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
  }, [
    allTermsAccepted,
    email,
    locale,
    mode,
    nickname,
    password,
    privacyTerm,
    profileImageUrl,
    registerStep,
    serviceTerm,
    socialSignupDraft,
    t,
  ]);

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

  const requestEmailChange = useCallback(async () => {
    const access = getSessionAccessToken(session);
    if (!access) return;
    setSaving(true);
    setError(null);
    setEmailChangeNotice(null);
    try {
      const result = await requestSignalMyEmailChange(access, newEmail);
      setEmailChangeRequestId(result.requestId);
      setEmailChangeMasked(result.maskedEmail || result.email);
      setEmailChangeCode('');
      setEmailChangeNotice(
        t('accountEmailChangeCodeSent').replace('{{email}}', result.maskedEmail || result.email),
      );
      if (__DEV__ && result.debug?.code) {
        setEmailChangeNotice(
          `${t('accountEmailChangeCodeSent').replace('{{email}}', result.maskedEmail || result.email)}\n${t(
            'accountEmailChangeDebugCode',
          ).replace('{{code}}', result.debug.code)}`,
        );
      }
    } catch (e) {
      setError(formatSignalApiError(e, t, 'accountEmailChangeError'));
    } finally {
      setSaving(false);
    }
  }, [newEmail, session, t]);

  const confirmEmailChange = useCallback(async () => {
    const access = getSessionAccessToken(session);
    if (!access || !emailChangeRequestId) return;
    setSaving(true);
    setError(null);
    try {
      const nextUser = await confirmSignalMyEmailChange(access, {
        requestId: emailChangeRequestId,
        code: emailChangeCode,
      });
      const next = { ...session!, user: nextUser } as StoredAppAuthSession;
      await saveAppAuthSession(next);
      setSession(next);
      setNewEmail(nextUser.email);
      setEmailChangeRequestId('');
      setEmailChangeCode('');
      setEmailChangeMasked('');
      setEmailChangeNotice(t('accountEmailChangeComplete'));
    } catch (e) {
      setError(formatSignalApiError(e, t, 'accountEmailChangeError'));
    } finally {
      setSaving(false);
    }
  }, [emailChangeCode, emailChangeRequestId, session, t]);

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
        onPress: () => router.push('/alerts'),
      },
      {
        key: 'signals',
        icon: 'bolt',
        title: t('accountActivitySignals'),
        onPress: () => router.push('/signal' as Href),
      },
      {
        key: 'notificationSettings',
        icon: 'cog',
        title: t('accountActivityNotificationSettings'),
        onPress: () => router.push('/settings?tab=notifications'),
      },
    ],
    [router, t],
  );

  const accountTabs = useMemo(
    () =>
      [
        { key: 'home', label: t('accountTabHome') },
        { key: 'profile', label: t('accountProfileSectionTitle') },
        { key: 'security', label: t('accountTabSecurity') },
        { key: 'info', label: t('accountTabInfo') },
      ] as const,
    [t],
  );

  const socialProviders = useMemo(() => {
    const base = ['kakao', 'naver', 'google'] as const;
    if (Platform.OS === 'ios' && isIosAppleSignInNativeEnabled()) {
      return [...base, 'apple'] as const;
    }
    return base;
  }, []);

  const socialProviderLabel = useCallback(
    (provider: SocialProviderKey) =>
      provider === 'kakao'
        ? t('accountSocialKakao')
        : provider === 'naver'
          ? t('accountSocialNaver')
          : provider === 'google'
            ? t('accountSocialGoogle')
            : t('accountSocialApple'),
    [t],
  );

  const onSocialAuthPress = useCallback(
    (provider: SocialProviderKey, action: 'login' | 'signup') => {
      void (action === 'signup' ? startSocialSignup(provider) : startSocialLogin(provider));
    },
    [startSocialLogin, startSocialSignup],
  );

  const screen = (
    <SafeAreaView style={styles.safe} edges={embedded ? [] : ['bottom']}>
      {!embedded ? (
        <Stack.Screen options={{ title: t('screenAccount'), headerShown: !useIpadSidebar }} />
      ) : null}
      {user ? (
        <View style={styles.topFixed}>
          <View style={[styles.tabBar, embedded && styles.tabBarEmbedded]} accessibilityRole="tablist">
          {accountTabs.map((tab) => {
            const selected = accountTab === tab.key;
            return (
              <Pressable
                key={tab.key}
                onPress={() => setAccountTab(tab.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                style={[styles.tabBtn, selected && styles.tabBtnActive]}>
                <Text style={[styles.tabText, selected && styles.tabTextActive]} numberOfLines={1}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
          </View>
        </View>
      ) : null}
      <WebWheelScrollView
        ref={accountScrollRef as never}
        scrollResetKey={scrollResetKey}
        style={styles.scrollFlex}
        contentContainerStyle={[
          styles.content,
          (embedded || useTwoPane) && styles.contentEmbedded,
          !user && styles.contentAuth,
          { paddingBottom: stackScreenScrollBottomPadding(insets.bottom) },
        ]}>
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
            {accountTab === 'home' ? (
              <>
            <View style={[styles.card, styles.profileHeroCard]}>
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
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>{t('accountStatusTitle')}</Text>
              <View style={styles.statusStack}>
                <View style={styles.statusRow}>
                  <View style={styles.statusIcon}>
                    <FontAwesome5 name="calendar-check" size={12} color={theme.green} />
                  </View>
                  <Text style={styles.statusLabel}>{t('accountStatusJoined')}</Text>
                  <Text style={styles.statusValue} numberOfLines={1}>{joinedAtLabel}</Text>
                </View>
                <View style={styles.statusRow}>
                  <View style={styles.statusIcon}>
                    <FontAwesome5 name="key" size={12} color={theme.green} />
                  </View>
                  <Text style={styles.statusLabel}>{t('accountStatusSignIn')}</Text>
                  <Text style={styles.statusValue} numberOfLines={1}>{signInMethodLabel}</Text>
                </View>
                <Pressable
                  onPress={() => router.push('/settings?tab=notifications')}
                  style={({ pressed }) => [styles.statusRow, styles.statusRowLast, pressed && styles.activityRowPressed]}
                  accessibilityRole="button"
                  accessibilityLabel={t('accountStatusPush')}>
                  <View style={styles.statusIcon}>
                    <FontAwesome5 name="bell" size={12} color={theme.green} />
                  </View>
                  <Text style={styles.statusLabel}>{t('accountStatusPush')}</Text>
                  <View style={styles.statusValueRow}>
                    <Text style={styles.statusValue} numberOfLines={1}>
                      {notificationPrefs?.pushEnabled ? t('accountStatusPushOn') : t('accountStatusPushOff')}
                    </Text>
                    <FontAwesome5 name="chevron-right" size={10} color={theme.textDim} />
                  </View>
                </Pressable>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>{t('accountActivityTitle')}</Text>
              <View style={styles.activityLinkStack}>
                {activityLinks.map((item, index) => (
                  <Pressable
                    key={item.key}
                    onPress={item.onPress}
                    style={({ pressed }) => [
                      styles.activityLinkRow,
                      index === activityLinks.length - 1 && styles.activityLinkRowLast,
                      pressed && styles.activityRowPressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={item.title}>
                    <View style={styles.activityIcon}>
                      <FontAwesome5 name={item.icon} size={14} color={theme.green} />
                    </View>
                    <Text style={styles.activityTitle} numberOfLines={1}>{item.title}</Text>
                    <FontAwesome5 name="chevron-right" size={10} color={theme.textDim} />
                  </Pressable>
                ))}
              </View>
            </View>

              </>
            ) : null}

            {accountTab === 'profile' ? (
              <>
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>{t('accountEmailChangeTitle')}</Text>
              <Text style={styles.sectionLead}>{t('accountEmailChangeLead')}</Text>
              {emailChangeNotice ? <Text style={styles.noticeText}>{emailChangeNotice}</Text> : null}
              <TextInput
                value={newEmail}
                onChangeText={setNewEmail}
                placeholder={t('accountEmailPlaceholder')}
                placeholderTextColor={theme.textDim}
                autoCapitalize="none"
                keyboardType="email-address"
                style={styles.input}
              />
              <Pressable disabled={saving || !newEmail} onPress={() => void requestEmailChange()} style={styles.secondaryBtn}>
                <Text style={styles.secondaryText}>{saving ? t('commonLoading') : t('accountEmailChangeRequestButton')}</Text>
              </Pressable>
              {emailChangeRequestId ? (
                <>
                  <Text style={styles.subSectionLead}>
                    {t('accountEmailChangeCodeLead').replace('{{email}}', emailChangeMasked || newEmail)}
                  </Text>
                  <TextInput
                    value={emailChangeCode}
                    onChangeText={setEmailChangeCode}
                    placeholder={t('accountEmailChangeCodePlaceholder')}
                    placeholderTextColor={theme.textDim}
                    keyboardType="number-pad"
                    maxLength={6}
                    style={styles.input}
                  />
                  <Pressable
                    disabled={saving || emailChangeCode.length < 6}
                    onPress={() => void confirmEmailChange()}
                    style={styles.primaryBtn}>
                    <Text style={styles.primaryText}>
                      {saving ? t('commonLoading') : t('accountEmailChangeConfirmButton')}
                    </Text>
                  </Pressable>
                </>
              ) : null}
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>{t('accountProfileSectionTitle')}</Text>
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
              </>
            ) : null}

            {accountTab === 'security' ? (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>{t('accountSecurityTitle')}</Text>
              <View style={styles.subSection}>
                <View style={styles.subSectionHeader}>
                  <Text style={styles.subSectionTitle}>{t('accountSocialLinkedTitle')}</Text>
                  <Text style={styles.subSectionMeta}>
                    {t('accountSocialLinkedCount').replace('{{count}}', String(linkedIdentities.length))}
                  </Text>
                </View>
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
                <View style={styles.socialLinkStack}>
                  {socialProviders.some(
                    (prov) =>
                      socialCatalog?.providers[prov]?.enabled &&
                      !linkedIdentities.some((i) => i.provider === prov),
                  ) ? (
                    <View style={styles.linkChipRow}>
                      {socialProviders.map((prov) => {
                        const cfg = socialCatalog?.providers[prov];
                        const linked = linkedIdentities.some((i) => i.provider === prov);
                        if (linked || !cfg?.enabled) return null;
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
                            style={({ pressed }) => [styles.linkChip, pressed && styles.activityRowPressed]}
                            accessibilityRole="button"
                            accessibilityLabel={`${label} ${t('accountSocialLinkMore')}`}>
                            <Text style={styles.linkChipText}>
                              {label} {t('accountSocialLinkMore')}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : socialCatalog ? (
                    <Text style={styles.mutedText}>{t('accountSocialLinkNone')}</Text>
                  ) : null}
                </View>
              </View>

              <View style={styles.subSection}>
                <View style={styles.subSectionHeader}>
                  <Text style={styles.subSectionTitle}>{t('accountPasswordSectionTitle')}</Text>
                  <Text style={styles.subSectionMeta}>
                    {user.hasPassword ? t('accountPasswordEnabled') : t('accountPasswordNotSet')}
                  </Text>
                </View>
                <Text style={styles.subSectionLead}>
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
                <Pressable disabled={saving || newPassword.length < 8} onPress={() => void savePassword()} style={styles.secondaryBtn}>
                  <Text style={styles.secondaryText}>{saving ? t('commonLoading') : t('accountPasswordSaveButton')}</Text>
                </Pressable>
              </View>
            </View>
            ) : null}

            {accountTab === 'info' ? (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>{t('accountServiceInfoTitle')}</Text>
                <View style={styles.legalActionStack}>
                  <Pressable
                    onPress={() => openTerms('service')}
                    style={({ pressed }) => [styles.legalActionRow, pressed && styles.activityRowPressed]}
                    accessibilityRole="button">
                    <Text style={styles.legalActionTitle}>{t('termsServiceTitle')}</Text>
                    <FontAwesome5 name="chevron-right" size={12} color={theme.textDim} />
                  </Pressable>
                  <Pressable
                    onPress={() => openTerms('privacy')}
                    style={({ pressed }) => [styles.legalActionRow, pressed && styles.activityRowPressed]}
                    accessibilityRole="button">
                    <Text style={styles.legalActionTitle}>{t('termsPrivacyTitle')}</Text>
                    <FontAwesome5 name="chevron-right" size={12} color={theme.textDim} />
                  </Pressable>
                  <Pressable
                    onPress={() => router.push('/terms-history' as never)}
                    style={({ pressed }) => [styles.legalActionRow, styles.legalActionRowLast, pressed && styles.activityRowPressed]}
                    accessibilityRole="button">
                    <Text style={styles.legalActionTitle}>{t('accountActivityTermsHistory')}</Text>
                    <FontAwesome5 name="chevron-right" size={12} color={theme.textDim} />
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
                  <Text style={styles.copyrightText}>
                    {t('accountFooterCopyright').replace('{{year}}', String(copyrightYear))}
                  </Text>
                </View>
              </View>
            ) : null}

          </>
        ) : (
          <>
            {isRegister && registerStep === 'terms' ? (
              <View style={styles.card}>
                <Text style={styles.authCardTitle}>{t('accountTermsTitle')}</Text>
                <Text style={styles.authCardLead}>
                  {pendingSocialProvider
                    ? t('accountTermsSocialLead').replace('{{provider}}', socialProviderLabel(pendingSocialProvider))
                    : t('accountTermsLead')}
                </Text>
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
                <Pressable
                  disabled={saving || !allTermsAccepted}
                  onPress={() => void continueRegisterInfo()}
                  style={[styles.primaryBtn, !allTermsAccepted ? styles.primaryBtnDisabled : null]}>
                  <Text style={[styles.primaryText, !allTermsAccepted ? styles.primaryTextDisabled : null]}>
                    {saving
                      ? t('commonLoading')
                      : pendingSocialProvider
                        ? t('accountTermsContinueSocial').replace('{{provider}}', socialProviderLabel(pendingSocialProvider))
                        : t('accountTermsNextButton')}
                  </Text>
                </Pressable>
                <View style={styles.authSwitchRow}>
                  <Text style={styles.authSwitchText}>{t('accountLoginPrompt')}</Text>
                  <Pressable onPress={() => switchMode('login')} hitSlop={8}>
                    <Text style={styles.authSwitchBtn}>{t('accountLoginButton')}</Text>
                  </Pressable>
                </View>
              </View>
            ) : isRegister && registerStep === 'method' ? (
              <View style={styles.card}>
                <View style={styles.socialBox}>
                  <Text style={styles.authCardTitle}>{t('accountSignupMethodTitle')}</Text>
                  <Text style={styles.authCardLead}>{t('accountSignupMethodLead')}</Text>
                  <View style={styles.termsConfirmedRow}>
                    <FontAwesome5 name="check" size={11} color={theme.green} />
                    <Text style={styles.termsConfirmedText}>{t('accountTermsAcceptedNotice')}</Text>
                    <Pressable
                      onPress={() => {
                        setSocialSignupDraft(null);
                        setRegisterStep('terms');
                      }}
                      hitSlop={8}>
                      <Text style={styles.termsEditText}>{t('accountTermsEdit')}</Text>
                    </Pressable>
                  </View>
                  <SocialAuthButtons
                    providers={socialProviders}
                    catalog={socialCatalog}
                    saving={saving}
                    action="signup"
                    onPress={onSocialAuthPress}
                    labelForProvider={socialProviderLabel}
                    theme={theme}
                    scaleFont={scaleFont}
                  />
                </View>

                <Pressable
                  onPress={() => {
                    setSocialSignupDraft(null);
                    setEmailAuthExpanded(true);
                    setRegisterStep('info');
                  }}
                  style={({ pressed }) => [styles.emailToggle, pressed && styles.activityRowPressed]}
                  accessibilityRole="button">
                  <Text style={styles.emailToggleText}>{t('accountEmailSignupToggle')}</Text>
                  <FontAwesome5 name="chevron-right" size={11} color={theme.green} />
                </Pressable>

                <View style={styles.authSwitchRow}>
                  <Text style={styles.authSwitchText}>{t('accountLoginPrompt')}</Text>
                  <Pressable onPress={() => switchMode('login')} hitSlop={8}>
                    <Text style={styles.authSwitchBtn}>{t('accountLoginButton')}</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={styles.card}>
                <View style={styles.socialBox}>
                  <Text style={styles.authCardTitle}>
                    {isRegister
                      ? socialSignupDraft
                        ? t('accountSocialSignupInfoTitle')
                        : t('accountEmailSignupInfoTitle')
                      : t('accountSocialTitle')}
                  </Text>
                  {isRegister ? (
                    <>
                      <Text style={styles.authCardLead}>
                        {socialSignupDraft ? t('accountSocialSignupInfoLead') : t('accountEmailSignupInfoLead')}
                      </Text>
                      <View style={styles.termsConfirmedRow}>
                        <FontAwesome5 name="check" size={11} color={theme.green} />
                        <Text style={styles.termsConfirmedText}>{t('accountTermsAcceptedNotice')}</Text>
                        <Pressable
                          onPress={() => {
                            setSocialSignupDraft(null);
                            setRegisterStep('terms');
                          }}
                          hitSlop={8}>
                          <Text style={styles.termsEditText}>{t('accountTermsEdit')}</Text>
                        </Pressable>
                      </View>
                    </>
                  ) : null}
                  {!isRegister ? (
                    <SocialAuthButtons
                      providers={socialProviders}
                      catalog={socialCatalog}
                      saving={saving}
                      action="login"
                      onPress={onSocialAuthPress}
                      labelForProvider={socialProviderLabel}
                      theme={theme}
                      scaleFont={scaleFont}
                    />
                  ) : null}
                </View>

                {!isRegister ? (
                  <Pressable
                    onPress={() => setEmailAuthExpanded((value) => !value)}
                    style={({ pressed }) => [styles.emailToggle, pressed && styles.activityRowPressed]}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: emailAuthExpanded }}>
                    <Text style={styles.emailToggleText}>
                      {emailAuthExpanded ? t('accountEmailAuthHide') : t('accountEmailLoginToggle')}
                    </Text>
                    <FontAwesome5
                      name={emailAuthExpanded ? 'chevron-up' : 'chevron-down'}
                      size={11}
                      color={theme.green}
                    />
                  </Pressable>
                ) : null}

              {emailAuthExpanded || isRegister ? (
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
                {!socialSignupDraft ? (
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    placeholder={t('accountPasswordPlaceholder')}
                    placeholderTextColor={theme.textDim}
                    secureTextEntry
                    style={styles.input}
                  />
                ) : null}
                {isRegister && !socialSignupDraft ? (
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
                ) : isRegister && socialSignupDraft ? (
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

                {emailAuthExpanded || isRegister ? (
                  <Pressable disabled={saving} onPress={() => void submitAuth()} style={styles.primaryBtn}>
                    <Text style={styles.primaryText}>
                      {saving ? t('commonLoading') : t(isRegister ? 'accountRegisterButton' : 'accountLoginButton')}
                    </Text>
                  </Pressable>
                ) : null}
                <View style={styles.authSwitchRow}>
                  <Text style={styles.authSwitchText}>{t(isRegister ? 'accountLoginPrompt' : 'accountSignupPrompt')}</Text>
                  <Pressable onPress={() => switchMode(isRegister ? 'login' : 'register')} hitSlop={8}>
                    <Text style={styles.authSwitchBtn}>{t(isRegister ? 'accountLoginButton' : 'accountSignupButton')}</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </>
        )}
      </WebWheelScrollView>
    </SafeAreaView>
  );

  return useIpadSidebar ? (
    <IpadSidebarScreen title={t('screenAccount')} backHref="/(tabs)/news">
      {screen}
    </IpadSidebarScreen>
  ) : (
    screen
  );
}
