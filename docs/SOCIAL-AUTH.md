# 소셜 로그인

SIGNAL 앱 세션은 모든 로그인 방식에서 Signal Server가 발급한 JWT access token과 refresh session을 사용한다. Kakao/Naver/Google/Apple 토큰은 외부 계정 확인과 `app_user_identities` 연결에만 사용한다.

## 공통

- 앱 scheme: `signalapp`
- 기본 복귀 경로: `signalapp://oauth`
- 앱 세션 저장: `services/appAuthSession.ts`
- 소셜 로그인 앱 흐름: `integrations/signal-api/socialAuthFlow.ts`
- 서버 인증 API: `server/src/http/public/v1/auth.mjs`
- 서버 프로필 검증: `server/src/auth/socialProfile.mjs`

## Kakao

앱은 Kakao Native SDK를 사용한다. KakaoTalk 로그인을 우선 시도하고, 불가능하면 카카오계정 로그인으로 전환한다.

설정:

- Kakao Developers iOS Bundle ID: `com.marcus.signal`
- Android package: `com.marcus.signal`
- `.env` 또는 EAS Secret: `KAKAO_NATIVE_APP_KEY`
- Admin 소셜 로그인 설정: REST API key, client secret 필요 시 입력

주의:

- Kakao REST redirect에 `signalapp://oauth`를 넣지 않는다.
- `KOE101`은 native key, URL scheme, bundle/package 등록 불일치가 주된 원인이다.
- Xcode 직접 빌드 전 `node scripts/syncKakaoNativeConfig.mjs` 또는 `npm run ios` 흐름을 사용한다.

## Naver

Expo AuthSession으로 인증 코드를 받고 서버가 token 교환과 프로필 조회를 수행한다.

Admin 설정:

- client id
- client secret
- redirect uri 허용: `signalapp://oauth`

## Google

앱은 Google id token을 서버로 보내고, 서버가 issuer/audience를 검증한다.

Admin 설정:

- iOS client id
- Android client id
- Web client id

## Apple

Sign in with Apple은 유료 Apple Developer Program과 capability 설정이 필요하다. 개인 Team 빌드에서는 entitlement를 제거하는 plugin을 사용한다. 운영 빌드에서만 `SIGNAL_IOS_APPLE_SIGN_IN_ENABLED=1`로 켠다.
