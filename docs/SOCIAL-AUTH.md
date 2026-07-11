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

### iOS / Android

네이티브 앱은 Kakao Native SDK를 사용한다. KakaoTalk 로그인을 우선 시도하고, 불가능하면 카카오계정 로그인으로 전환한다. 액세스 토큰은 서버 `verifyKakaoAccessToken`으로 검증한다.

설정:

- Kakao Developers iOS Bundle ID: `com.marcus.signal`
- Android package: `com.marcus.signal`
- `.env` 또는 EAS Secret: `KAKAO_NATIVE_APP_KEY`
- Admin 소셜 로그인 설정: REST API key, client secret 필요 시 입력

주의:

- 네이티브 흐름은 Redirect URI가 필요 없다.
- `KOE101`은 native key, URL scheme, bundle/package 등록 불일치가 주된 원인이다.
- Xcode 직접 빌드 전 `node scripts/syncKakaoNativeConfig.mjs` 또는 `npm run ios` 흐름을 사용한다.

### Web

웹은 Native SDK 대신 Kakao REST OAuth authorization code 흐름을 사용한다. 앱이 `code`와 `redirectUri`를 서버로 보내면 서버가 `exchangeKakaoCode`로 토큰 교환·프로필 조회를 한다.

Kakao Developers (동일 앱):

- **플랫폼 → Web** 추가
- **사이트 도메인**: 개발 `http://localhost:8081`, 운영 `https://<서비스 도메인>`
- **Redirect URI** (앱이 실제로 쓰는 값과 **완전히** 일치):
  - 로컬 `npm run web`: `http://localhost:8081/oauth`
  - 운영 (`SIGNAL_WEB_BASE_PATH=/web`): `https://<도메인>/web/oauth`

Admin:

- REST API key (네이티브 `KAKAO_NATIVE_APP_KEY`와 **같은 카카오 앱**)
- Kakao 콘솔에서 Client Secret 사용 ON이면 Admin에도 client secret 입력

주의:

- 웹 Redirect URI에 `signalapp://oauth`를 넣지 않는다.
- iOS만 설정해 두고 Web 플랫폼·Redirect URI를 빠뜨리면 웹에서만 실패한다.
- `KOE006` / `APP_USER_SOCIAL_KAKAO_UPSTREAM`은 Redirect URI 불일치 또는 REST key·client secret 불일치가 흔한 원인이다.

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
