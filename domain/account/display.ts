import type { SignalAppUser, SignalLegalTerm, SignalUserIdentity } from '@/integrations/signal-api';
import type { AppLocale, MessageId } from '@/locales/messages';

type T = (id: MessageId, params?: Record<string, string | number>) => string;

export type SocialSignupDraft = {
  provider: 'kakao' | 'naver' | 'google' | 'apple';
  signupToken: string;
  email: string;
  nickname: string;
  profileImageUrl: string;
};

export function createFallbackLegalTerms(locale: AppLocale, t: T): SignalLegalTerm[] {
  return [
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
  ];
}

export function accountLocaleTag(locale: AppLocale): string {
  if (locale === 'ko') return 'ko-KR';
  if (locale === 'ja') return 'ja-JP';
  return 'en-US';
}

export function formatJoinedAtLabel(user: SignalAppUser | null, locale: AppLocale, t: T): string {
  if (!user?.createdAt) return t('accountStatusJoinedUnknown');
  const date = new Date(user.createdAt);
  if (Number.isNaN(date.getTime())) return t('accountStatusJoinedUnknown');
  return new Intl.DateTimeFormat(accountLocaleTag(locale), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

export function signInMethodLabel(user: SignalAppUser | null, identities: SignalUserIdentity[], t: T): string {
  const socialCount = identities.length;
  if (user?.hasPassword && socialCount > 0) {
    return t('accountStatusSignInPasswordAndSocial').replace('{{count}}', String(socialCount));
  }
  if (user?.hasPassword) return t('accountStatusSignInPasswordOnly');
  if (socialCount > 0) return t('accountStatusSignInSocialOnly').replace('{{count}}', String(socialCount));
  return t('accountStatusSignInNone');
}

export function socialSignupDraftFromPreview(params: {
  provider: SocialSignupDraft['provider'];
  signupToken: string;
  email?: string | null;
  displayName?: string | null;
  profileImageUrl?: string | null;
}): SocialSignupDraft {
  const email = params.email || '';
  const fallbackNickname = email.includes('@') ? email.split('@')[0] : params.provider;
  const nickname = params.displayName || fallbackNickname;
  return {
    provider: params.provider,
    signupToken: params.signupToken,
    email,
    nickname,
    profileImageUrl: params.profileImageUrl || '',
  };
}
