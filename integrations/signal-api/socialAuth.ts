import { normalizeAuthSession, type SignalAppUser, type SignalAuthSession, type SignalUserIdentity } from '@/integrations/signal-api/auth';
import { signalApiRequest } from '@/integrations/signal-api/client';
import { getOrCreateAppDeviceId } from '@/services/appDeviceId';

export type SocialProviderKey = 'google' | 'apple' | 'kakao' | 'naver';

export type SignalSocialProviderPublic = {
  enabled: boolean;
  flow: 'idToken' | 'authorizationCode' | 'accessToken';
  webClientId?: string | null;
  iosClientId?: string | null;
  androidClientId?: string | null;
  clientId?: string | null;
};

export type SignalSocialCatalog = {
  providers: Partial<Record<SocialProviderKey, SignalSocialProviderPublic>>;
  /** Prefer this; same as legacy oauthRedirectPath */
  socialLoginRedirectPath?: string;
  /** @deprecated use socialLoginRedirectPath */
  oauthRedirectPath?: string;
};

export async function fetchSignalSocialProviders(): Promise<SignalSocialCatalog> {
  const json = await signalApiRequest<{ data: SignalSocialCatalog }>('/v1/auth/social/providers');
  return json.data;
}

export async function loginSignalSocial(params: {
  provider: SocialProviderKey;
  idToken?: string;
  nonce?: string;
  code?: string;
  redirectUri?: string;
  /** 카카오 네이티브 SDK 로그인 시 */
  accessToken?: string;
  state?: string;
  locale?: string;
  acceptedTerms?: Array<{ type: string; locale: string; version: string }>;
  deviceId?: string;
}): Promise<SignalAuthSession> {
  const deviceId = params.deviceId ?? (await getOrCreateAppDeviceId());
  const json = await signalApiRequest<{ data: SignalAuthSession & { token?: string; expiresAt?: string } }>(
    '/v1/auth/social/login',
    {
      method: 'POST',
      body: {
        provider: params.provider,
        idToken: params.idToken,
        nonce: params.nonce,
        code: params.code,
        redirectUri: params.redirectUri,
        accessToken: params.accessToken,
        state: params.state,
        locale: params.locale,
        acceptedTerms: params.acceptedTerms,
        deviceId,
      },
    },
  );
  return normalizeAuthSession(json.data, deviceId);
}

export async function linkSignalSocial(
  token: string,
  params: {
    provider: SocialProviderKey;
    idToken?: string;
    nonce?: string;
    code?: string;
    redirectUri?: string;
    accessToken?: string;
    state?: string;
  },
): Promise<{ user: SignalAppUser; identity: SignalUserIdentity }> {
  const json = await signalApiRequest<{ data: { user: SignalAppUser; identity: SignalUserIdentity } }>(
    '/v1/auth/social/link',
    {
      method: 'POST',
      token,
      body: params,
    },
  );
  return json.data;
}
