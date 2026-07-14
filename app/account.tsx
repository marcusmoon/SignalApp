import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentProps } from 'react';
import { Alert, BackHandler, Image, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { Stack, useGlobalSearchParams, useLocalSearchParams, useRouter, useNavigation, type Href } from 'expo-router';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import Constants from 'expo-constants';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { SocialAuthButtons } from '@/components/account/SocialAuthButtons';
import { SocialProviderFavicon } from '@/components/account/SocialProviderFavicon';
import { WideOverlayRouteRedirect } from '@/components/layout/WideOverlayRouteRedirect';
import { PhoneHeaderBackButton } from '@/components/layout/PhoneHeaderBackButton';
import { WideSubpaneHeader } from '@/components/layout/WideSubpaneHeader';
import { WebWheelScrollView } from '@/components/layout/WebWheelScrollView';
import { makeAccountStyles } from '@/components/account/accountStyles';
import { stackScreenScrollBottomPadding } from '@/constants/screenLayout';
import { SETTINGS_TAB_ORDER, type SettingsTab } from '@/constants/settingsTabs';
import { useLocale } from '@/contexts/LocaleContext';
import { useIpadSidebarNav } from '@/contexts/IpadSidebarNavContext';
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
import { useSafeSetRouteParams } from '@/utils/safeRouteParams';

type AccountPane = 'hub' | 'profile' | 'social' | 'password';

const ACCOUNT_PANES: ReadonlyArray<AccountPane> = ['hub', 'profile', 'social', 'password'];

function parseAccountPaneParam(raw: string | string[] | undefined): AccountPane {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return ACCOUNT_PANES.includes(value as AccountPane) ? (value as AccountPane) : 'hub';
}

function firstParam(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  const text = String(raw || '').trim();
  return text || undefined;
}
type Mode = 'login' | 'register';
type RegisterStep = 'terms' | 'method' | 'info';

type HubMenuItem = {
  key: string;
  icon: ComponentProps<typeof FontAwesome5>['name'];
  title: string;
  body?: string;
  trailing?: string;
  onPress: () => void;
};

type HubMenuSection = {
  id: string;
  title: string;
  items: HubMenuItem[];
};

type AccountScreenProps = {
  /** iPad 사이드바 우측 패널에 그대로 삽입 */
  embedded?: boolean;
};

const SETTINGS_TAB_LABEL: Record<SettingsTab, MessageId> = {
  display: 'settingsTabDisplay',
  notifications: 'settingsTabNotifications',
  news: 'settingsTabNews',
  quotes: 'settingsTabQuotes',
  server: 'settingsTabDevMode',
};

const SETTINGS_HUB_META: Record<
  SettingsTab,
  { icon: ComponentProps<typeof FontAwesome5>['name']; descId: MessageId }
> = {
  display: { icon: 'palette', descId: 'accountHubDisplaySettingsDesc' },
  news: { icon: 'newspaper', descId: 'accountHubSettingsNewsDesc' },
  quotes: { icon: 'chart-line', descId: 'accountHubSettingsQuotesDesc' },
  notifications: { icon: 'bell', descId: 'accountHubSettingsNotificationsDesc' },
  server: { icon: 'server', descId: 'accountHubSettingsServerDesc' },
};

export default function AccountScreen({ embedded = false }: AccountScreenProps) {
  const router = useRouter();
  const navigation = useNavigation();
  const { theme, scaleFont } = useSignalTheme();
  const { t, locale } = useLocale();
  const insets = useSafeAreaInsets();
  const { useTwoPane } = useResponsiveLayout();
  const ipadNav = useIpadSidebarNav();
  const params = useLocalSearchParams<{ from?: string; pane?: string | string[] }>();
  const globalParams = useGlobalSearchParams<{ overlay?: string | string[]; pane?: string | string[] }>();
  const setRouteParams = useSafeSetRouteParams();
  const useIpadSidebar = useTwoPane && !embedded;
  const paneFromRoute =
    embedded && useTwoPane && firstParam(globalParams.overlay) === 'account'
      ? parseAccountPaneParam(globalParams.pane)
      : parseAccountPaneParam(params.pane);
  const showStackHeader = !embedded && !useIpadSidebar;
  /** wide 스택·임베디드 모두 본문 제목 (IpadSidebarScreen topBar 없음) */
  const showPaneTitleInContent = embedded || useIpadSidebar;
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
  const [accountPane, setAccountPaneState] = useState<AccountPane>(() => paneFromRoute);
  const accountPaneRef = useRef(accountPane);
  accountPaneRef.current = accountPane;
  const setAccountPane = useCallback(
    (pane: AccountPane) => {
      if (accountPaneRef.current === pane) return;
      setAccountPaneState(pane);
      setRouteParams({ pane });
    },
    [setRouteParams],
  );

  useEffect(() => {
    setAccountPaneState((prev) => (prev === paneFromRoute ? prev : paneFromRoute));
  }, [paneFromRoute]);
  const { ref: accountScrollRef } = useScrollToTopOnChange([accountPane]);
  const scrollResetKey = accountPane;
  const [emailAuthExpanded, setEmailAuthExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const user: SignalAppUser | null = session?.user ?? null;
  const isRegister = mode === 'register';
  const allTermsAccepted = serviceTermsAccepted && privacyTermsAccepted;
  const serviceTerm = legalTerms.find((term) => term.type === 'service');
  const privacyTerm = legalTerms.find((term) => term.type === 'privacy');
  const copyrightYear = new Date().getFullYear();
  const appVersion = Constants.expoConfig?.version?.trim() || '—';
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
      if (ipadNav.isAvailable) {
        ipadNav.showTerms(type, { drillFrom: 'account' });
        return;
      }
      router.push({ pathname: '/terms', params: { type } });
    },
    [ipadNav, router],
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

  const performDisconnectIdentity = useCallback(
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

  const settingsHubSection = useMemo((): HubMenuSection => {
    const pushLabel = notificationPrefs?.pushEnabled
      ? t('accountStatusPushOn')
      : t('accountStatusPushOff');
    return {
      id: 'settings',
      title: t('accountHubSettingsSection'),
      items: SETTINGS_TAB_ORDER.map((tab) => ({
        key: tab,
        icon: SETTINGS_HUB_META[tab].icon,
        title: t(SETTINGS_TAB_LABEL[tab]),
        body: t(SETTINGS_HUB_META[tab].descId),
        trailing: tab === 'notifications' ? pushLabel : undefined,
        onPress: () => {
          if (ipadNav.isAvailable) {
            ipadNav.showSettings(tab, { drillFrom: 'account' });
            return;
          }
          router.push({ pathname: '/settings', params: { tab, from: 'account' } });
        },
      })),
    };
  }, [ipadNav, notificationPrefs?.pushEnabled, router, t]);

  const hubSections = useMemo((): HubMenuSection[] => {
    return [
      settingsHubSection,
      {
        id: 'activity',
        title: t('accountActivityTitle'),
        items: [
          {
            key: 'alerts',
            icon: 'bell',
            title: t('accountActivityAlerts'),
            body: t('accountActivityAlertsDesc'),
            onPress: () => {
              if (ipadNav.isAvailable) {
                ipadNav.showAlerts({ from: 'account', drillFrom: 'account' });
                return;
              }
              router.push({ pathname: '/alerts', params: { from: 'account' } });
            },
          },
        ],
      },
      {
        id: 'account',
        title: t('accountHubAccountSection'),
        items: [
          {
            key: 'profile',
            icon: 'user-edit',
            title: t('accountProfileSectionTitle'),
            body: t('accountProfileEditLead'),
            onPress: () => setAccountPane('profile'),
          },
          {
            key: 'password',
            icon: 'key',
            title: t('accountPasswordMenuTitle'),
            body: t('accountPasswordMenuDesc'),
            trailing: user?.hasPassword ? t('accountPasswordEnabled') : t('accountPasswordNotSet'),
            onPress: () => setAccountPane('password'),
          },
          {
            key: 'social',
            icon: 'link',
            title: t('accountSocialLinkMenuTitle'),
            body: t('accountSocialLinkMenuDesc'),
            trailing:
              linkedIdentities.length > 0
                ? t('accountSocialLinkedCount').replace('{{count}}', String(linkedIdentities.length))
                : undefined,
            onPress: () => setAccountPane('social'),
          },
          {
            key: 'terms',
            icon: 'file-alt',
            title: t('accountHubTermsTitle'),
            body: t('accountHubTermsDesc'),
            onPress: () => {
              if (ipadNav.isAvailable) {
                ipadNav.showTermsHistory({ drillFrom: 'account' });
                return;
              }
              router.push('/terms-history' as never);
            },
          },
        ],
      },
    ];
  }, [linkedIdentities.length, router, settingsHubSection, t, user?.hasPassword]);

  const socialProviders = useMemo<SocialProviderKey[]>(() => {
    const base: SocialProviderKey[] = ['kakao', 'naver', 'google'];
    if (Platform.OS === 'ios' && isIosAppleSignInNativeEnabled()) {
      return [...base, 'apple'];
    }
    return base;
  }, []);

  const isSocialProviderEnabled = useCallback(
    (provider: SocialProviderKey) => socialCatalog?.providers[provider]?.enabled === true,
    [socialCatalog],
  );

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

  const promptDisconnectIdentity = useCallback(
    (identity: SignalUserIdentity) => {
      if (!user?.hasPassword && linkedIdentities.length <= 1) {
        Alert.alert(t('commonNotice'), t('accountPasswordRequiredForUnlink'));
        return;
      }
      const providerLabel = socialProviderLabel(identity.provider as SocialProviderKey);
      Alert.alert(
        t('accountSocialDisconnectConfirmTitle'),
        t('accountSocialDisconnectConfirmBody').replace('{{provider}}', providerLabel),
        [
          { text: t('commonCancel'), style: 'cancel' },
          {
            text: t('accountSocialDisconnect'),
            style: 'destructive',
            onPress: () => {
              void performDisconnectIdentity(identity);
            },
          },
        ],
      );
    },
    [linkedIdentities.length, performDisconnectIdentity, socialProviderLabel, t, user?.hasPassword],
  );

  const onSocialAuthPress = useCallback(
    (provider: SocialProviderKey, action: 'login' | 'signup') => {
      void (action === 'signup' ? startSocialSignup(provider) : startSocialLogin(provider));
    },
    [startSocialLogin, startSocialSignup],
  );

  const returnToAccountHub = useCallback(() => {
    setAccountPane('hub');
  }, []);

  const accountHeaderTitle = useMemo(() => {
    if (accountPane === 'profile') return t('accountProfileSectionTitle');
    if (accountPane === 'social') return t('accountSocialLinkMenuTitle');
    if (accountPane === 'password') return t('accountPasswordMenuTitle');
    return t('screenAccount');
  }, [accountPane, t]);

  useLayoutEffect(() => {
    if (!showStackHeader || !user) return;

    if (accountPane === 'hub') {
      navigation.setOptions({
        title: accountHeaderTitle,
        headerBackVisible: false,
        headerLeft: navigation.canGoBack()
          ? () => <PhoneHeaderBackButton onPress={() => router.back()} />
          : undefined,
      });
      return;
    }

    navigation.setOptions({
      title: accountHeaderTitle,
      headerBackVisible: false,
      headerLeft: () => <PhoneHeaderBackButton onPress={returnToAccountHub} />,
    });
  }, [accountHeaderTitle, accountPane, navigation, returnToAccountHub, router, showStackHeader, user]);

  useEffect(() => {
    if (!user || accountPane === 'hub') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      returnToAccountHub();
      return true;
    });
    return () => subscription.remove();
  }, [accountPane, returnToAccountHub, user]);

  const screen = (
    <SafeAreaView style={styles.safe} edges={embedded ? [] : ['bottom']}>
      {!embedded ? (
        <Stack.Screen options={{ title: accountHeaderTitle, headerShown: showStackHeader }} />
      ) : null}
      <WebWheelScrollView
        ref={accountScrollRef as never}
        scrollResetKey={scrollResetKey}
        style={styles.scrollFlex}
        contentContainerStyle={[
          styles.content,
          (embedded || useTwoPane) && styles.contentEmbedded,
          !user && styles.contentAuth,
          user && accountPane !== 'hub' && ((embedded || useTwoPane) ? styles.contentSubPaneWide : styles.contentSubPane),
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
            {showPaneTitleInContent && accountPane !== 'hub' ? (
              <WideSubpaneHeader title={accountHeaderTitle} onBack={returnToAccountHub} />
            ) : null}

            {accountPane === 'hub' ? (
              <>
                <View style={styles.profileHub}>
                  {profileImageUrl ? (
                    <Image source={{ uri: profileImageUrl }} style={styles.profileHubAvatar} />
                  ) : (
                    <View style={styles.profileHubAvatarFallback}>
                      <Text style={styles.profileHubAvatarText}>{user.nickname.slice(0, 1).toUpperCase()}</Text>
                    </View>
                  )}
                  <View style={styles.profileHubNameRow}>
                    <Text style={styles.profileHubName}>{user.nickname}</Text>
                    <Pressable
                      onPress={() => setAccountPane('profile')}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={t('accountProfileSectionTitle')}
                      style={({ pressed }) => [styles.profileEditBtn, pressed && styles.activityRowPressed]}>
                      <FontAwesome5 name="pen" size={11} color={theme.green} />
                    </Pressable>
                  </View>
                  <Text style={styles.profileHubEmail} numberOfLines={1}>
                    {user.email}
                  </Text>
                  <View style={styles.profileHubMetaRow}>
                    <View style={styles.profileHubMetaPill}>
                      <Text style={styles.profileHubMetaText} numberOfLines={1}>
                        {signInMethodLabel}
                      </Text>
                    </View>
                    <View style={styles.profileHubMetaPill}>
                      <Text style={styles.profileHubMetaText} numberOfLines={1}>
                        {t('accountStatusJoined')}: {joinedAtLabel}
                      </Text>
                    </View>
                  </View>
                </View>

                {hubSections.map((section) => (
                  <View key={section.id} style={styles.hubSection}>
                    <Text style={styles.hubSectionKicker}>{section.title}</Text>
                    <View style={styles.hubMenuStack}>
                      {section.items.map((item, index) => (
                        <Pressable
                          key={item.key}
                          onPress={item.onPress}
                          style={({ pressed }) => [
                            styles.hubMenuRow,
                            index === section.items.length - 1 && styles.hubMenuRowLast,
                            pressed && styles.activityRowPressed,
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel={item.title}>
                          <View style={styles.hubMenuIcon}>
                            <FontAwesome5 name={item.icon} size={14} color={theme.green} />
                          </View>
                          <View style={styles.hubMenuText}>
                            <Text style={styles.hubMenuTitle} numberOfLines={1}>
                              {item.title}
                            </Text>
                            {item.body ? (
                              <Text style={styles.hubMenuBody} numberOfLines={2}>
                                {item.body}
                              </Text>
                            ) : null}
                          </View>
                          {item.trailing ? (
                            <Text style={styles.hubMenuTrailing} numberOfLines={1}>
                              {item.trailing}
                            </Text>
                          ) : null}
                          <FontAwesome5 name="chevron-right" size={10} color={theme.textDim} />
                        </Pressable>
                      ))}
                    </View>
                  </View>
                ))}

                <View style={styles.hubFooter}>
                  <View style={styles.hubFooterActions}>
                    <Pressable
                      disabled={saving}
                      onPress={() => void logout()}
                      hitSlop={6}
                      accessibilityRole="button">
                      <Text style={styles.hubFooterLink}>{t('accountLogout')}</Text>
                    </Pressable>
                    <Text style={styles.hubFooterSep}>|</Text>
                    <Pressable
                      disabled={saving}
                      onPress={withdraw}
                      hitSlop={6}
                      accessibilityRole="button">
                      <Text style={styles.hubFooterLink}>{t('accountWithdraw')}</Text>
                    </Pressable>
                  </View>
                  <Text style={styles.hubVersionText}>
                    {t('accountHubVersion', { version: appVersion })}
                  </Text>
                  <Text style={styles.copyrightText}>
                    {t('accountFooterCopyright').replace('{{year}}', String(copyrightYear))}
                  </Text>
                </View>
              </>
            ) : null}

            {accountPane === 'profile' ? (
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

            {accountPane === 'social' ? (
              <View style={styles.card}>
                <Text style={styles.sectionLead}>{t('accountSocialLinkHint')}</Text>
                {!socialCatalog ? (
                  <Text style={styles.mutedText}>{t('commonLoading')}</Text>
                ) : socialProviders.length === 0 ? (
                  <Text style={styles.mutedText}>{t('accountSocialLinkNone')}</Text>
                ) : (
                  <View style={styles.providerList}>
                    {socialProviders.map((prov, index) => {
                      const identity = linkedIdentities.find((item) => item.provider === prov);
                      const label = socialProviderLabel(prov);
                      const enabled = isSocialProviderEnabled(prov);
                      return (
                        <View
                          key={prov}
                          style={[
                            styles.providerRow,
                            index === socialProviders.length - 1 && styles.providerRowLast,
                            !enabled && styles.providerRowDisabled,
                          ]}>
                          <SocialProviderFavicon provider={prov} dimmed={!enabled} theme={theme} />
                          <View style={styles.activityText}>
                            <Text style={styles.activityTitle}>{label}</Text>
                            <Text style={styles.activityDesc} numberOfLines={1}>
                              {identity
                                ? identity.email || identity.displayName || identity.providerUserId
                                : enabled
                                  ? t('accountSocialNotLinked')
                                  : t('commonComingSoon')}
                            </Text>
                          </View>
                          {identity ? (
                            <Pressable
                              disabled={saving}
                              onPress={() => promptDisconnectIdentity(identity)}
                              style={styles.smallOutlineBtn}>
                              <Text style={styles.smallOutlineText}>{t('accountSocialDisconnect')}</Text>
                            </Pressable>
                          ) : enabled ? (
                            <Pressable
                              disabled={saving}
                              onPress={() => void linkSocialAccount(prov)}
                              style={styles.smallPrimaryBtn}>
                              <Text style={styles.smallPrimaryText}>{t('accountSocialLinkMore')}</Text>
                            </Pressable>
                          ) : (
                            <View style={styles.smallDisabledBtn}>
                              <Text style={styles.smallDisabledText}>{t('commonComingSoon')}</Text>
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            ) : null}

            {accountPane === 'password' ? (
            <View style={styles.card}>
              <View style={styles.subSectionHeader}>
                <Text style={styles.subSectionTitle}>{t('accountPasswordSectionTitle')}</Text>
                <Text style={styles.subSectionMeta}>
                  {user.hasPassword ? t('accountPasswordEnabled') : t('accountPasswordNotSet')}
                </Text>
              </View>
              <Text style={styles.subSectionLead}>
                {user.hasPassword ? t('accountPasswordSectionDesc') : t('accountPasswordSetLead')}
              </Text>
              {!user.hasPassword ? (
                <Text style={styles.mutedText}>{t('accountPasswordRequiredForUnlink')}</Text>
              ) : null}
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
            <View style={styles.hubSection}>
              <Text style={styles.hubSectionKicker}>{settingsHubSection.title}</Text>
              <View style={styles.hubMenuStack}>
                {settingsHubSection.items.map((item, index) => (
                  <Pressable
                    key={item.key}
                    onPress={item.onPress}
                    style={({ pressed }) => [
                      styles.hubMenuRow,
                      index === settingsHubSection.items.length - 1 && styles.hubMenuRowLast,
                      pressed && styles.activityRowPressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={item.title}>
                    <View style={styles.hubMenuIcon}>
                      <FontAwesome5 name={item.icon} size={14} color={theme.green} />
                    </View>
                    <View style={styles.hubMenuText}>
                      <Text style={styles.hubMenuTitle} numberOfLines={1}>
                        {item.title}
                      </Text>
                      {item.body ? (
                        <Text style={styles.hubMenuBody} numberOfLines={2}>
                          {item.body}
                        </Text>
                      ) : null}
                    </View>
                    {item.trailing ? (
                      <Text style={styles.hubMenuTrailing} numberOfLines={1}>
                        {item.trailing}
                      </Text>
                    ) : null}
                    <FontAwesome5 name="chevron-right" size={10} color={theme.textDim} />
                  </Pressable>
                ))}
              </View>
            </View>
          </>
        )}
      </WebWheelScrollView>
    </SafeAreaView>
  );

  if (useTwoPane && !embedded) {
    return (
      <WideOverlayRouteRedirect
        kind="account"
        params={{ pane: parseAccountPaneParam(params.pane) }}
      />
    );
  }

  return screen;
}
