import * as AppleAuthentication from 'expo-apple-authentication';
import * as AuthSession from 'expo-auth-session';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { NativeModules, Platform } from 'react-native';

import type { SignalSocialCatalog, SocialProviderKey } from '@/integrations/signal-api/socialAuth';
import { isIosAppleSignInNativeEnabled } from '@/services/env';

WebBrowser.maybeCompleteAuthSession();

export class SocialAuthCancelledError extends Error {
  override name = 'SocialAuthCancelledError';
}

export class SocialAuthFlowError extends Error {
  override name = 'SocialAuthFlowError';
}

/** `/web` static export: baseUrl may be missing from runtime config; infer from current path. */
function webBasePathForRedirect(): string {
  const configured = String(Constants.expoConfig?.experiments?.baseUrl ?? '').replace(/\/+$/, '');
  if (configured) return configured;
  if (typeof window === 'undefined') return '';
  const path = window.location.pathname;
  if (path === '/web' || path.startsWith('/web/')) return '/web';
  return '';
}

function redirectUriFor(path: string) {
  const schemeMatch = path.trim().match(/^[A-Za-z][A-Za-z0-9+.-]*:\/\/([^/?#]+)([^?#]*)?/);
  const p =
    (schemeMatch ? `${schemeMatch[1]}${schemeMatch[2] || ''}` : path)
      .replace(/^\/+/, '')
      .replace(/[?#].*$/, '')
      .trim() || 'oauth';
  const scheme = 'signalapp';

  // Web OAuth (Kakao/Naver/Google) needs an https/http redirect, not signalapp://.
  // makeRedirectUri() can emit a custom scheme on static web export; use the current origin instead.
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.location?.origin) {
      const basePath = webBasePathForRedirect();
      return `${window.location.origin}${basePath}/${p}`;
    }
    return AuthSession.makeRedirectUri({ scheme, path: p });
  }

  const nativeRedirect = `${scheme}://${p}`;
  if (
    Constants.executionEnvironment === ExecutionEnvironment.Bare ||
    Constants.executionEnvironment === ExecutionEnvironment.Standalone
  ) {
    return AuthSession.makeRedirectUri({
      scheme,
      path: p,
      native: nativeRedirect,
    });
  }
  return AuthSession.makeRedirectUri({ scheme, path: p });
}

/** `@react-native-seoul/kakao-login` 네이티브 브리지. Expo Go에는 없으며 dev build + prebuild 후에만 존재 */
function kakaoNativeBridgeAvailable(): boolean {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return false;
  const mod = NativeModules.RNKakaoLogins as { login?: unknown } | null | undefined;
  return !!(mod && typeof mod.login === 'function');
}

function isKakaoCancelMessage(message: string) {
  return /cancel|취소|canceled|cancelled|dismissed/ui.test(message);
}

function kakaoAccessTokenFrom(token: { accessToken?: string | null } | null | undefined) {
  const accessToken = token?.accessToken ? String(token.accessToken) : '';
  if (!accessToken) throw new SocialAuthFlowError('kakao_failed');
  return accessToken;
}

function fullNameFromAppleCredential(cred: AppleAuthentication.AppleAuthenticationCredential) {
  const parts = [cred.fullName?.familyName, cred.fullName?.givenName].filter(Boolean);
  return parts.join(' ').trim();
}

export async function obtainSocialCredential(
  provider: SocialProviderKey,
  catalog: SignalSocialCatalog,
): Promise<Record<string, string>> {
  const path = catalog.socialLoginRedirectPath || catalog.oauthRedirectPath || 'oauth';
  const redirectUri = redirectUriFor(path);
  const providers = catalog.providers;

  if (provider === 'google') {
    const g = providers.google;
    if (!g?.enabled) throw new SocialAuthFlowError('disabled');
    const clientId =
      Platform.OS === 'android'
        ? g.androidClientId || g.webClientId || ''
        : Platform.OS === 'ios'
          ? g.iosClientId || g.webClientId || ''
          : g.webClientId || '';
    if (!clientId) throw new SocialAuthFlowError('not_configured');
    const request = new AuthSession.AuthRequest({
      clientId,
      scopes: ['openid', 'profile', 'email'],
      redirectUri,
      responseType: AuthSession.ResponseType.IdToken,
      usePKCE: false,
      extraParams: { prompt: 'select_account' },
    });
    const discovery = await AuthSession.fetchDiscoveryAsync('https://accounts.google.com/.well-known/openid-configuration');
    const result = await request.promptAsync(discovery);
    if (result.type === 'cancel' || result.type === 'dismiss') throw new SocialAuthCancelledError();
    if (result.type !== 'success') throw new SocialAuthFlowError('google_failed');
    const idToken = result.params.id_token ? String(result.params.id_token) : '';
    if (!idToken) throw new SocialAuthFlowError('no_id_token');
    return { idToken };
  }

  if (provider === 'apple') {
    if (Platform.OS !== 'ios') throw new SocialAuthFlowError('apple_ios_only');
    if (!isIosAppleSignInNativeEnabled()) throw new SocialAuthFlowError('apple_unavailable');
    const g = providers.apple;
    if (!g?.enabled) throw new SocialAuthFlowError('disabled');
    const available = await AppleAuthentication.isAvailableAsync();
    if (!available) throw new SocialAuthFlowError('apple_unavailable');
    const cred = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    const idToken = cred.identityToken ? String(cred.identityToken) : '';
    if (!idToken) throw new SocialAuthFlowError('no_id_token');
    return { idToken, displayName: fullNameFromAppleCredential(cred) };
  }

  if (provider === 'kakao') {
    const k = providers.kakao;
    if (!k?.enabled) throw new SocialAuthFlowError('disabled');
    const clientId = k.clientId ? String(k.clientId) : '';
    if (!clientId) throw new SocialAuthFlowError('not_configured');

    /** Expo Go 카카오용 네이티브 브리지 없음 · OAuth 는 exp:// 로만 나가 콘솔 등록 불가 → 아예 차단 */
    if (
      Platform.OS !== 'web' &&
      Constants.executionEnvironment === ExecutionEnvironment.StoreClient
    ) {
      throw new SocialAuthFlowError('kakao_expo_go_unsupported');
    }

    if (Platform.OS !== 'web') {
      if (!kakaoNativeBridgeAvailable()) {
        throw new SocialAuthFlowError('kakao_native_missing');
      }
      try {
        const { login } = await import('@react-native-seoul/kakao-login');
        const accessToken = kakaoAccessTokenFrom(await login());
        return { accessToken };
      } catch (e) {
        if (e instanceof SocialAuthCancelledError || e instanceof SocialAuthFlowError) throw e;
        const msg = e instanceof Error ? e.message : String(e || '');
        if (isKakaoCancelMessage(msg)) throw new SocialAuthCancelledError();
        if (__DEV__) console.debug('[Kakao native login]', msg, e);
        const detail = msg.trim().slice(0, 240);
        throw new SocialAuthFlowError(detail ? `kakao_failed:${detail}` : 'kakao_failed');
      }
    }

    const request = new AuthSession.AuthRequest({
      clientId,
      redirectUri,
      responseType: AuthSession.ResponseType.Code,
      usePKCE: false,
      state: Crypto.randomUUID(),
    });
    const kakaoDiscovery = {
      authorizationEndpoint: 'https://kauth.kakao.com/oauth/authorize',
      tokenEndpoint: 'https://kauth.kakao.com/oauth/token',
    };
    if (__DEV__) console.info('[Kakao web OAuth] redirectUri=', redirectUri);
    const result = await request.promptAsync(kakaoDiscovery as AuthSession.DiscoveryDocument);
    if (result.type === 'cancel' || result.type === 'dismiss') throw new SocialAuthCancelledError();
    if (result.type !== 'success') {
      const kakaoErr = String(result.params?.error || result.errorCode || '');
      if (/KOE006/i.test(kakaoErr)) {
        throw new SocialAuthFlowError(`kakao_redirect_uri:${redirectUri}`);
      }
      throw new SocialAuthFlowError('kakao_failed');
    }
    const code = result.params.code ? String(result.params.code) : '';
    if (!code) throw new SocialAuthFlowError('no_code');
    return { code, redirectUri };
  }

  if (provider === 'naver') {
    const n = providers.naver;
    if (!n?.enabled) throw new SocialAuthFlowError('disabled');
    const clientId = n.clientId ? String(n.clientId) : '';
    if (!clientId) throw new SocialAuthFlowError('not_configured');
    const request = new AuthSession.AuthRequest({
      clientId,
      redirectUri,
      responseType: AuthSession.ResponseType.Code,
      usePKCE: false,
      state: Crypto.randomUUID(),
    });
    const naverDiscovery = {
      authorizationEndpoint: 'https://nid.naver.com/oauth2.0/authorize',
      tokenEndpoint: 'https://nid.naver.com/oauth2.0/token',
    };
    const result = await request.promptAsync(naverDiscovery as AuthSession.DiscoveryDocument);
    if (result.type === 'cancel' || result.type === 'dismiss') throw new SocialAuthCancelledError();
    if (result.type !== 'success') throw new SocialAuthFlowError('naver_failed');
    const code = result.params.code ? String(result.params.code) : '';
    const state = result.params.state ? String(result.params.state) : '';
    if (!code || !state) throw new SocialAuthFlowError('no_code');
    return { code, state, redirectUri };
  }

  throw new SocialAuthFlowError('unsupported');
}
