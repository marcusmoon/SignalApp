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
  confirmSignalMyEmailChange,
  loginSignalSocial,
  linkSignalSocial,
  previewSignalSocialSignup,
  requestSignalMyEmailChange,
  requestSignalPushTest,
  type SignalLegalTerm,
  type SignalAppUser,
  type SignalUserIdentity,
  type SignalSocialCatalog,
  type SocialProviderKey,
} from '@/integrations/signal-api';
import { SignalApiError } from '@/integrations/signal-api/httpClient';
import {
  obtainSocialCredential,
  SocialAuthCancelledError,
  SocialAuthFlowError,
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

type Mode = 'login' | 'register';
type AccountTab = 'home' | 'profile' | 'security';
type RegisterStep = 'terms' | 'method' | 'info';

type SocialSignupDraft = {
  provider: SocialProviderKey;
  signupToken: string;
  email: string;
  nickname: string;
  profileImageUrl: string;
};

function socialApiCodeMessage(code: string | undefined): MessageId | null {
  switch (code) {
    case 'APP_USER_SOCIAL_EMAIL_CONFLICT':
      return 'accountSocialEmailConflict';
    case 'APP_USER_SOCIAL_IDENTITY_TAKEN':
      return 'accountSocialIdentityTaken';
    case 'APP_USER_TERMS_REQUIRED':
      return 'accountSocialSignupRequired';
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
    case 'kakao_native_missing':
      return translate('accountSocialKakaoNativeMissing');
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
  if (e instanceof SocialAuthFlowError) {
    const base = mapSocialFlowErrorMessage(e.message, translate);
    return __DEV__ ? `${base}\n\n[debug] flow=${e.message}` : base;
  }
  if (e instanceof SignalApiError) {
    const mid = socialApiCodeMessage(e.message);
    const base = mid ? translate(mid) : formatSignalApiError(e, translate, apiFallbackId);
    return __DEV__ ? `${base}\n\n[debug] api=${e.message}` : base;
  }
  const base = formatSignalApiError(e, translate, apiFallbackId);
  if (!__DEV__) return base;
  const raw = e instanceof Error ? `${e.name}: ${e.message}` : String(e ?? '');
  return `${base}\n\n[debug] ${raw}`;
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
  const [emailAuthExpanded, setEmailAuthExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const user: SignalAppUser | null = session?.user ?? null;
  const isRegister = mode === 'register';
  const allTermsAccepted = serviceTermsAccepted && privacyTermsAccepted;
  const serviceTerm = legalTerms.find((term) => term.type === 'service');
  const privacyTerm = legalTerms.find((term) => term.type === 'privacy');
  const copyrightYear = new Date().getFullYear();
  const localeTag = locale === 'ko' ? 'ko-KR' : locale === 'ja' ? 'ja-JP' : 'en-US';
  const joinedAtLabel = useMemo(() => {
    if (!user?.createdAt) return t('accountStatusJoinedUnknown');
    const date = new Date(user.createdAt);
    if (Number.isNaN(date.getTime())) return t('accountStatusJoinedUnknown');
    return new Intl.DateTimeFormat(localeTag, { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
  }, [localeTag, t, user?.createdAt]);
  const signInMethodLabel = useMemo(() => {
    const socialCount = linkedIdentities.length;
    if (user?.hasPassword && socialCount > 0) {
      return t('accountStatusSignInPasswordAndSocial').replace('{{count}}', String(socialCount));
    }
    if (user?.hasPassword) return t('accountStatusSignInPasswordOnly');
    if (socialCount > 0) return t('accountStatusSignInSocialOnly').replace('{{count}}', String(socialCount));
    return t('accountStatusSignInNone');
  }, [linkedIdentities.length, t, user?.hasPassword]);

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
        const draftEmail = preview.profile.email || '';
        const fallbackNickname = draftEmail.includes('@') ? draftEmail.split('@')[0] : provider;
        const draftNickname = preview.profile.displayName || fallbackNickname;
        setSocialSignupDraft({
          provider,
          signupToken: preview.signupToken,
          email: draftEmail,
          nickname: draftNickname,
          profileImageUrl: preview.profile.profileImageUrl || '',
        });
        setEmail(draftEmail);
        setNickname(draftNickname);
        setProfileImageUrl(preview.profile.profileImageUrl || '');
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

  const sendPushTest = useCallback(async () => {
    const access = getSessionAccessToken(session);
    if (!access) return;
    setSaving(true);
    setError(null);
    try {
      await requestSignalPushTest(access);
      setEmailChangeNotice(t('accountPushTestQueued'));
    } catch (e) {
      setError(formatSignalApiError(e, t, 'accountPushTestError'));
    } finally {
      setSaving(false);
    }
  }, [session, t]);

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
    ],
    [router, t],
  );

  const accountTabs = useMemo(
    () =>
      [
        { key: 'home', label: t('accountTabHome') },
        { key: 'profile', label: t('accountProfileSectionTitle') },
        { key: 'security', label: t('accountTabSecurity') },
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

  const renderSocialButton = useCallback(
    (provider: SocialProviderKey, action: 'login' | 'signup' = 'login') => {
      const enabled = socialCatalog ? socialCatalog.providers[provider]?.enabled === true : true;
      const label = socialProviderLabel(provider);
      const brandStyle =
        provider === 'kakao'
          ? styles.socialBrandKakao
          : provider === 'naver'
            ? styles.socialBrandNaver
            : provider === 'google'
              ? styles.socialBrandGoogle
              : styles.socialBrandApple;
      const buttonStyle =
        provider === 'kakao'
          ? styles.socialButtonKakao
          : provider === 'naver'
            ? styles.socialButtonNaver
            : provider === 'google'
              ? styles.socialButtonGoogle
              : styles.socialButtonApple;
      const labelStyle =
        provider === 'kakao' ? styles.socialLabelDark : provider === 'naver' ? styles.socialLabelLight : null;
      return (
        <Pressable
          key={provider}
          disabled={saving || !enabled}
          onPress={() => void (action === 'signup' ? startSocialSignup(provider) : startSocialLogin(provider))}
          accessibilityRole="button"
          accessibilityLabel={label}
          style={({ pressed }) => [
            styles.socialButton,
            buttonStyle,
            !enabled && styles.socialButtonDisabled,
            pressed && styles.socialButtonPressed,
          ]}>
          <View style={[styles.socialBrand, brandStyle]}>
            {provider === 'naver' ? (
              <Text style={styles.socialBrandLetter}>N</Text>
            ) : (
              <FontAwesome5
                name={provider === 'apple' ? 'apple' : provider === 'google' ? 'google' : 'comment'}
                size={provider === 'apple' ? 16 : 14}
                color={provider === 'kakao' ? '#191600' : provider === 'google' ? '#4285F4' : theme.bg}
              />
            )}
          </View>
          <Text style={[styles.socialLabel, labelStyle]}>{label}</Text>
        </Pressable>
      );
    },
    [saving, socialCatalog, socialProviderLabel, startSocialLogin, startSocialSignup, styles, theme.bg],
  );

  const renderSocialButtons = useCallback(
    (action: 'login' | 'signup' = 'login') => (
      <View style={styles.socialStack}>{socialProviders.map((provider) => renderSocialButton(provider, action))}</View>
    ),
    [renderSocialButton, socialProviders, styles.socialStack],
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
            <View style={styles.accountTabs} accessibilityRole="tablist">
              {accountTabs.map((tab) => {
                const selected = accountTab === tab.key;
                return (
                  <Pressable
                    key={tab.key}
                    onPress={() => setAccountTab(tab.key)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected }}
                    style={[styles.accountTab, selected && styles.accountTabActive]}>
                    <Text style={[styles.accountTabText, selected && styles.accountTabTextActive]}>{tab.label}</Text>
                  </Pressable>
                );
              })}
            </View>

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
              <View style={styles.accountMetaRow}>
                <View style={styles.accountMetaPill}>
                  <FontAwesome5 name={user.hasPassword ? 'lock' : 'unlock'} size={10} color={theme.green} />
                  <Text style={styles.accountMetaText}>
                    {user.hasPassword ? t('accountPasswordEnabled') : t('accountPasswordNotSet')}
                  </Text>
                </View>
                <View style={styles.accountMetaPill}>
                  <FontAwesome5 name="link" size={10} color={theme.green} />
                  <Text style={styles.accountMetaText}>
                    {t('accountSocialLinkedCount').replace('{{count}}', String(linkedIdentities.length))}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>{t('accountStatusTitle')}</Text>
              <Text style={styles.sectionLead}>{t('accountStatusLead')}</Text>
              <View style={styles.statusStack}>
                <View style={styles.statusRow}>
                  <View style={styles.statusIcon}>
                    <FontAwesome5 name="calendar-check" size={13} color={theme.green} />
                  </View>
                  <Text style={styles.statusLabel}>{t('accountStatusJoined')}</Text>
                  <Text style={styles.statusValue} numberOfLines={1}>{joinedAtLabel}</Text>
                </View>
                <View style={styles.statusRow}>
                  <View style={styles.statusIcon}>
                    <FontAwesome5 name="key" size={13} color={theme.green} />
                  </View>
                  <Text style={styles.statusLabel}>{t('accountStatusSignIn')}</Text>
                  <Text style={styles.statusValue} numberOfLines={1}>{signInMethodLabel}</Text>
                </View>
                <Pressable
                  onPress={() => router.push('/settings?tab=notifications')}
                  style={({ pressed }) => [styles.statusRow, pressed && styles.activityRowPressed]}
                  accessibilityRole="button"
                  accessibilityLabel={t('accountStatusPush')}>
                  <View style={styles.statusIcon}>
                    <FontAwesome5 name="bell" size={13} color={theme.green} />
                  </View>
                  <Text style={styles.statusLabel}>{t('accountStatusPush')}</Text>
                  <Text style={styles.statusValue} numberOfLines={1}>
                    {notificationPrefs?.pushEnabled ? t('accountStatusPushOn') : t('accountStatusPushOff')}
                  </Text>
                </Pressable>
              </View>
              <Pressable disabled={saving} onPress={() => void sendPushTest()} style={styles.secondaryBtn}>
                <Text style={styles.secondaryText}>{saving ? t('commonLoading') : t('accountPushTestButton')}</Text>
              </Pressable>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>{t('accountActivityTitle')}</Text>
              <Text style={styles.sectionLead}>{t('accountActivityLead')}</Text>
              <View style={styles.quickGrid}>
                {activityLinks.map((item) => (
                  <Pressable
                    key={item.key}
                    onPress={item.onPress}
                    style={({ pressed }) => [styles.quickTile, pressed && styles.activityRowPressed]}
                    accessibilityRole="button"
                    accessibilityLabel={item.title}>
                    <View style={styles.quickIcon}>
                      <FontAwesome5 name={item.icon} size={15} color={theme.green} />
                    </View>
                    <Text style={styles.quickTitle} numberOfLines={1}>{item.title}</Text>
                    <Text style={styles.quickDesc} numberOfLines={2}>{item.body}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.accountFooter}>
              <View style={styles.legalLinkRow}>
                <Pressable onPress={() => openTerms('service')} hitSlop={8}>
                  <Text style={styles.legalLinkText}>{t('termsServiceTitle')}</Text>
                </Pressable>
                <Text style={styles.legalLinkSep}>·</Text>
                <Pressable onPress={() => openTerms('privacy')} hitSlop={8}>
                  <Text style={styles.legalLinkText}>{t('termsPrivacyTitle')}</Text>
                </Pressable>
                <Text style={styles.legalLinkSep}>·</Text>
                <Pressable onPress={() => router.push('/terms-history' as never)} hitSlop={8}>
                  <Text style={styles.legalLinkText}>{t('accountActivityTermsHistory')}</Text>
                </Pressable>
              </View>
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
              <Text style={styles.sectionLead}>{t('accountProfileEditLead')}</Text>
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
              <Text style={styles.sectionLead}>{t('accountSecurityLead')}</Text>

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
                  {renderSocialButtons('signup')}
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
                  {!isRegister ? renderSocialButtons('login') : null}
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
    profileHeroCard: {
      borderColor: theme.greenBorder,
      backgroundColor: theme.bgElevated,
    },
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
    errBox: { borderRadius: 14, borderWidth: 1, borderColor: '#FFD6DA', backgroundColor: theme.dangerDim, padding: 12 },
    errText: { color: theme.danger, fontSize: sf(12), lineHeight: sf(18) },
    noticeText: { color: theme.green, fontSize: sf(12), lineHeight: sf(18), fontWeight: '800' },
    accountTabs: {
      minHeight: 44,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      flexDirection: 'row',
      padding: 4,
      gap: 4,
    },
    accountTab: {
      flex: 1,
      minHeight: 34,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    accountTabActive: { backgroundColor: theme.greenDim, borderWidth: 1, borderColor: theme.greenBorder },
    accountTabText: { color: theme.textMuted, fontSize: sf(12), fontWeight: '900' },
    accountTabTextActive: { color: theme.green },
    sectionTitle: { color: theme.text, fontSize: sf(16), fontWeight: '900' },
    sectionLead: { color: theme.textMuted, fontSize: sf(12), lineHeight: sf(18), marginTop: -4 },
    authCardTitle: { color: theme.text, fontSize: sf(17), fontWeight: '900', textAlign: 'center' },
    authCardLead: { color: theme.textMuted, fontSize: sf(12), lineHeight: sf(18), textAlign: 'center' },
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
    socialButtonDisabled: { opacity: 0.45 },
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
    emailToggle: {
      minHeight: 42,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.bgElevated,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingHorizontal: 12,
    },
    emailToggleText: { color: theme.green, fontSize: sf(13), fontWeight: '900' },
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
    termsConfirmedRow: {
      minHeight: 34,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.greenBorder,
      backgroundColor: theme.greenDim,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      paddingHorizontal: 10,
      alignSelf: 'stretch',
    },
    termsConfirmedText: { flex: 1, color: theme.green, fontSize: sf(11), fontWeight: '900' },
    termsEditText: { color: theme.green, fontSize: sf(11), fontWeight: '900' },
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
    accountMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    accountMetaPill: {
      minHeight: 30,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.greenBorder,
      backgroundColor: theme.greenDim,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
    },
    accountMetaText: { color: theme.green, fontSize: sf(11), fontWeight: '900' },
    statusStack: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.bgElevated,
      overflow: 'hidden',
    },
    statusRow: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    statusIcon: {
      width: 26,
      height: 26,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.greenDim,
      borderWidth: 1,
      borderColor: theme.greenBorder,
    },
    statusLabel: { flex: 1, minWidth: 0, color: theme.textMuted, fontSize: sf(12), fontWeight: '800' },
    statusValue: { maxWidth: '48%', color: theme.text, fontSize: sf(12), fontWeight: '900', textAlign: 'right' },
    quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    quickTile: {
      flexBasis: '48%',
      flexGrow: 1,
      minHeight: 104,
      borderRadius: 13,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.bgElevated,
      padding: 12,
      gap: 7,
    },
    quickIcon: {
      width: 32,
      height: 32,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.greenDim,
      borderWidth: 1,
      borderColor: theme.greenBorder,
    },
    quickTitle: { color: theme.text, fontSize: sf(13), fontWeight: '900' },
    quickDesc: { color: theme.textMuted, fontSize: sf(10), lineHeight: sf(15), fontWeight: '700' },
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
    subSection: {
      borderRadius: 13,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.bgElevated,
      padding: 12,
      gap: 10,
    },
    subSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
    subSectionTitle: { flex: 1, color: theme.text, fontSize: sf(13), fontWeight: '900' },
    subSectionMeta: { color: theme.green, fontSize: sf(11), fontWeight: '900' },
    subSectionLead: { color: theme.textMuted, fontSize: sf(11), lineHeight: sf(16), fontWeight: '700', marginTop: -2 },
    socialLinkStack: { gap: 8, marginTop: 0 },
    linkChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    linkChip: {
      minHeight: 32,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.greenBorder,
      backgroundColor: theme.greenDim,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 11,
    },
    linkChipText: { color: theme.green, fontSize: sf(11), fontWeight: '900' },
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
    secondaryBtn: {
      minHeight: 40,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.greenBorder,
      backgroundColor: theme.greenDim,
    },
    secondaryText: { color: theme.green, fontSize: sf(13), fontWeight: '900' },
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
    withdrawBtn: { borderColor: '#FFD6DA', backgroundColor: theme.dangerDim },
    withdrawText: { color: theme.danger },
    legalLinkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, flexWrap: 'wrap' },
    legalLinkText: { color: theme.green, fontSize: sf(11), fontWeight: '900' },
    legalLinkSep: { color: theme.textDim, fontSize: sf(11), fontWeight: '800' },
    copyrightText: { color: theme.textDim, fontSize: sf(10), fontWeight: '700' },
  });
}
