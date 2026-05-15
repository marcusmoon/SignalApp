# SIGNAL 소셜 로그인 설정

SIGNAL 앱 세션은 모든 로그인 방식에서 **SIGNAL 서버가 발급한 JWT access token + refresh session**을 사용한다. Kakao/Naver/Google/Apple 토큰은 외부 계정 확인과 `app_user_identities` 연결에만 사용하고, 앱 세션 토큰으로 저장하지 않는다.

## 공통

- 앱 scheme: `signalapp`
- 기본 앱 복귀 경로: `oauth`
- 앱 복귀 URI: `signalapp://oauth`
- Admin 설정 위치: **Admin > 설정 > 앱 · 소셜(외부 계정) 로그인**
- 서버 JWT: `server/.env`에 `SIGNAL_JWT_PRIVATE_KEY` 또는 `SIGNAL_JWT_PRIVATE_KEY_B64`가 필요하다.
- 앱 세션 저장: `services/appAuthSession.ts`
- provider credential 획득: `integrations/signal-api/socialAuthFlow.ts`
- 서버 세션/가입/연결 API: `integrations/signal-api/auth.ts`

`signalapp://oauth`는 Expo AuthSession 계열 provider가 앱으로 돌아오기 위한 경로다. Kakao 네이티브 SDK 로그인은 이 REST redirect 경로에 의존하지 않는다.

## Kakao

앱에서는 Kakao Native SDK를 사용한다. SDK의 `login()`이 카카오톡 앱 로그인을 먼저 시도하고, 카카오톡을 사용할 수 없는 경우 카카오계정 로그인으로 전환한다. 앱 코드에서 별도 타임아웃 후 재시도하지 않는다(중복 로그인 프롬프트 방지). 서버는 SDK access token으로 Kakao `/v2/user/me`를 조회해 identity를 확인한다.

설정:

- Kakao Developers > 앱 설정 > 플랫폼
  - iOS Bundle ID: `com.marcus.signal`
  - Android package: `com.marcus.signal`
  - Android key hash 등록
- Kakao Developers > 제품 설정 > 카카오 로그인: 활성화
- `.env` 또는 EAS Secret
  - `KAKAO_NATIVE_APP_KEY=<Kakao Native App Key>`
- Admin > 소셜 로그인 > Kakao
  - 사용: ON
  - REST API 키: Kakao REST API key
  - Client Secret: Kakao 콘솔에서 Client Secret을 ON으로 둔 경우에만 입력

주의:

- Kakao REST Redirect URI에는 `signalapp://oauth`를 등록하지 않는다. Kakao 콘솔 REST redirect는 HTTPS 운영 콜백용으로 보고, 네이티브 앱은 SDK 경로를 사용한다.
- `KAKAO_NATIVE_APP_KEY`는 `EXPO_PUBLIC_*`가 아니며 JS 번들에 넣지 않는다. 로컬에서 `npm run ios` / `npm run android`를 쓰면 `scripts/syncKakaoNativeConfig.mjs`가 빌드 전에 `.env` 값을 생성된 네이티브 프로젝트로 동기화한다. `npx expo run:ios`를 직접 실행하거나 Xcode에서 바로 빌드했다면 먼저 `node scripts/syncKakaoNativeConfig.mjs`를 실행한다.
- iOS에서 로그인 후 `KakaoSDKCommon.SdkError error 0`처럼 끝나면 생성된 `ios/.../AppDelegate.swift`에 `kakao_login.RNKakaoLogins.handleOpen(url)` 콜백이 들어갔는지 확인한다. `KAKAO_NATIVE_APP_KEY` 추가 후에는 `npx expo prebuild -p ios` 또는 `npx expo run:ios`로 네이티브 프로젝트를 다시 생성/빌드해야 한다.
- `KOE101`은 SDK에 들어간 네이티브 앱 키 또는 `kakao{Native App Key}` URL scheme이 Kakao Developers의 현재 앱과 다를 때 주로 발생한다. 이 경우 `.env`의 `KAKAO_NATIVE_APP_KEY`, iOS Bundle ID, Android package/key hash가 같은 Kakao 앱에 등록되어 있는지 확인한다.

## Naver

현재 구현은 Expo AuthSession으로 네이버 OAuth 인증 화면을 열고, `code` / `state` / `redirectUri`를 서버로 보내 서버가 access token을 교환한 뒤 프로필을 조회한다.

설정:

- Naver Developers > 내 애플리케이션
  - 네이버 로그인 API 사용
  - Client ID 확인
  - Client Secret 확인
  - 서비스 환경의 Callback URL 또는 URL Scheme에 앱 복귀 URI `signalapp://oauth`를 등록
- Admin > 소셜 로그인 > Naver
  - 사용: ON
  - Naver client_id: Client ID
  - Naver client_secret: Client Secret

서버 토큰 교환에는 `client_id`, `client_secret`, `code`, `state`, `redirect_uri`가 함께 사용된다.

## Google

현재 구현은 Expo AuthSession의 Google id_token 흐름을 사용한다. 앱은 Google에서 받은 `id_token`만 서버로 보내고, 서버는 Google JWKS로 issuer/audience를 검증한다.

설정:

- Google Cloud Console > APIs & Services > OAuth consent screen
  - 앱 이름, 지원 이메일, 필요한 테스트 사용자 또는 게시 상태 설정
  - `openid`, `profile`, `email` 범위 사용
- Google Cloud Console > Credentials
  - iOS OAuth Client: Bundle ID `com.marcus.signal`
  - Android OAuth Client: package `com.marcus.signal` + SHA-1
  - Web OAuth Client: 웹/개발 브라우저 로그인이 필요할 때만 추가
- Admin > 소셜 로그인 > Google
  - 사용: ON
  - `iosClientId`: iOS OAuth Client ID
  - `androidClientId`: Android OAuth Client ID
  - `webClientId`: Web OAuth Client ID(웹 또는 fallback용)

서버는 위 client ID 중 하나를 `aud`로 가진 Google ID token만 허용한다.

## Apple

현재 구현은 `expo-apple-authentication`을 사용한다. iOS에서만 표시되고, Apple이 내려준 identity token을 서버가 Apple JWKS로 검증한다.

설정:

- Apple Developer
  - App ID `com.marcus.signal`에 Sign in with Apple capability 활성화
  - provisioning profile 갱신 후 iOS rebuild
- `app.json`
  - `expo-apple-authentication` config plugin 포함 유지
- Admin > 소셜 로그인 > Apple
  - 사용: ON
  - Bundle ID / audience: `com.marcus.signal`

Apple은 이메일과 이름을 최초 동의 시에만 내려줄 수 있다. 앱은 최초 응답의 이름을 서버 identity display name에 함께 보낸다.

## 앱 사용자 플로우

- 로그인 화면은 소셜 로그인을 기본 동선으로 보여주고, 이메일 로그인은 보조 동선으로 접어 둔다.
- 가입은 필수 약관 동의 후 소셜 가입 또는 이메일 가입을 선택한다.
- 소셜 가입은 provider credential을 먼저 검증하고, 서버가 내려준 signup token으로 이메일/닉네임/프로필 이미지를 확인한 뒤 완료한다.
- 내정보에서는 연결된 소셜 계정을 보여주고 연결 해제를 지원한다.
- 마지막 로그인 수단을 해제하려면 이메일/비밀번호를 먼저 설정해야 한다.
- 탈퇴는 사용자 상태를 비활성화하고 세션·디바이스를 해제한다. 이메일과 provider id는 tombstone 처리해 같은 이메일/소셜 계정으로 재가입할 수 있게 한다.

## 패키지 기준

- Kakao: `@react-native-seoul/kakao-login`
- Naver/Google OAuth 화면: `expo-auth-session`, `expo-web-browser`, `expo-crypto`
- Apple: `expo-apple-authentication`
- 서버 JWT/JWKS 검증: `jose`

Expo AuthSession은 provider 공통 OAuth에 적합하다. 다만 Google/Naver도 카카오처럼 완전한 네이티브 앱 UX가 필요해지면 각 provider의 네이티브 SDK 패키지로 분리하는 것이 다음 단계다.
