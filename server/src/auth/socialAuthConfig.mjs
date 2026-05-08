const PROVIDERS = ['google', 'apple', 'kakao', 'naver'];

function clean(v) {
  return String(v || '').trim();
}

function providerEnabled(adminBlock) {
  return !!(adminBlock && adminBlock.enabled === true);
}

function socialLoginRedirectSegment(appSettings) {
  const s = appSettings?.socialAuth && typeof appSettings.socialAuth === 'object' ? appSettings.socialAuth : {};
  return clean(s.socialLoginRedirectPath || s.oauthRedirectPath || '') || 'oauth';
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
      const hasSecret = !!clean(r.clientSecret);
      out.kakao = {
        enabled: !!r.enabled && !!r.clientId,
        flow: hasSecret ? 'authorizationCode' : 'accessToken',
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
