import type { MessageId } from '@/locales/messages';
import { formatSignalApiError } from '@/integrations/signal-api/httpClient';
import { SignalApiError } from '@/integrations/signal-api/httpClient';
import {
  SocialAuthCancelledError,
  SocialAuthFlowError,
} from '@/integrations/signal-api/socialAuthFlow';

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
  if (flowCode.startsWith('kakao_redirect_uri:')) {
    const uri = flowCode.slice('kakao_redirect_uri:'.length);
    return `${translate('accountSocialKakaoRedirectUri')}\n\n${uri}`;
  }
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

export function formatSocialAuthFailure(
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
