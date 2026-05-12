const PROVIDERS = ['google', 'apple', 'kakao', 'naver'];

function clean(v) {
  return String(v || '').trim();
}

export function normalizeSocialLoginRedirectPath(v) {
  const value = clean(v);
  const schemeMatch = value.match(/^[A-Za-z][A-Za-z0-9+.-]*:\/\/([^/?#]+)([^?#]*)?/);
  const raw = (schemeMatch ? `${schemeMatch[1]}${schemeMatch[2] || ''}` : value)
    .replace(/^\/+/, '')
    .replace(/[?#].*$/, '');
  if (!raw) return 'oauth';
  // This is a native deep-link route segment, not an arbitrary URL. Keep it stable and app-route-shaped.
  const safe = raw
    .split('/')
    .map((part) => part.trim())
    .filter((part) => part && part !== '.' && part !== '..')
    .map((part) => part.replace(/[^A-Za-z0-9._~-]/g, ''))
    .filter((part) => part && part !== '.' && part !== '..')
    .filter(Boolean)
    .join('/');
  return safe || 'oauth';
}

function providerEnabled(adminBlock) {
  return !!(adminBlock && adminBlock.enabled === true);
}

function socialLoginRedirectSegment(appSettings) {
  const s = appSettings?.socialAuth && typeof appSettings.socialAuth === 'object' ? appSettings.socialAuth : {};
  return normalizeSocialLoginRedirectPath(s.socialLoginRedirectPath || s.oauthRedirectPath || '');
}

/**
 * App social login flags and OAuth client ids/secrets live in Admin → SQLite `app_settings.socialAuth`.
 * Kakao native app key is injected at native prebuild (`KAKAO_NATIVE_APP_KEY`), not here.
 * Social flows use external IdP; SIGNAL still issues JWTs like email/password login.
 */
export function buildSocialAuthRuntime(appSettings) {
  const admin = appSettings?.socialAuth && typeof appSettings.socialAuth === 'object' ? appSettings.socialAuth : {};

  const googleAdmin = admin.google || {};
  const google = {
    enabled: providerEnabled(googleAdmin),
    webClientId: clean(googleAdmin.webClientId),
    iosClientId: clean(googleAdmin.iosClientId),
    androidClientId: clean(googleAdmin.androidClientId),
  };

  const appleAdmin = admin.apple || {};
  const apple = {
    enabled: providerEnabled(appleAdmin),
    clientId: clean(appleAdmin.bundleId || appleAdmin.clientId || appleAdmin.serviceId),
  };

  const kakaoAdmin = admin.kakao || {};
  const kakao = {
    enabled: providerEnabled(kakaoAdmin),
    clientId: clean(kakaoAdmin.restApiKey || kakaoAdmin.clientId),
    clientSecret: clean(kakaoAdmin.clientSecret),
  };

  const naverAdmin = admin.naver || {};
  const naver = {
    enabled: providerEnabled(naverAdmin),
    clientId: clean(naverAdmin.clientId),
    clientSecret: clean(naverAdmin.clientSecret),
  };

  return { google, apple, kakao, naver };
}

/**
 * 앱에 내려줄 비밀값 없는 설정
 */
export function publicSocialAuthCatalog(appSettings, runtime = buildSocialAuthRuntime(appSettings)) {
  const redirectSegment = socialLoginRedirectSegment(appSettings);
  const out = {};
  for (const key of PROVIDERS) {
    const r = runtime[key];
    if (!r) continue;
    if (key === 'google') {
      out.google = {
        enabled: !!r.enabled && !!(r.webClientId || r.iosClientId || r.androidClientId),
        flow: 'idToken',
        webClientId: r.webClientId || null,
        iosClientId: r.iosClientId || null,
        androidClientId: r.androidClientId || null,
      };
    } else if (key === 'apple') {
      out.apple = {
        enabled: !!r.enabled && !!r.clientId,
        flow: 'idToken',
        clientId: r.clientId || null,
      };
    } else if (key === 'kakao') {
      out.kakao = {
        enabled: !!r.enabled && !!r.clientId,
        // Native app sign-in uses Kakao SDK access tokens. REST authorization-code fallback is web-only.
        flow: 'accessToken',
        clientId: r.clientId || null,
      };
    } else if (key === 'naver') {
      out.naver = {
        enabled: !!r.enabled && !!r.clientId && !!r.clientSecret,
        flow: 'authorizationCode',
        clientId: r.clientId || null,
      };
    }
  }
  return {
    providers: out,
    /** @deprecated use socialLoginRedirectPath; same value kept for older app bundles */
    oauthRedirectPath: redirectSegment,
    socialLoginRedirectPath: redirectSegment,
  };
}

export function isSocialProviderConfigured(runtime, provider) {
  const p = String(provider || '').toLowerCase();
  const catalog = publicSocialAuthCatalog({}, runtime).providers;
  return !!(catalog[p] && catalog[p].enabled);
}
