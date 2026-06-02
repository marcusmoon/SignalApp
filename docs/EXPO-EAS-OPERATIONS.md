# SIGNAL — Expo / EAS Operations

SIGNAL 앱의 EAS Build, EAS Update(OTA), Submit 운영 기준입니다.

## 기준

- EAS 환경은 `development`, `preview`, `production` 세 가지를 기본으로 쓴다.
- EAS Update 채널도 같은 이름으로 맞춘다.
- 앱 설정은 `app.config.js`가 최종 출처다. `app.json`은 기본값이고, 환경별 값은 `.env` 또는 EAS environment variables로 주입한다.
- JS 런타임에 노출되는 값만 `EXPO_PUBLIC_*`를 사용한다. 네이티브 키와 서버 비밀값은 `EXPO_PUBLIC_*`로 만들지 않는다.

참고 문서:

- Expo eas.json: https://docs.expo.dev/build/eas-json/
- EAS environment variables: https://docs.expo.dev/eas/environment-variables/
- EAS Update runtime version: https://docs.expo.dev/eas-update/runtime-versions/
- EAS Update channels/branches: https://docs.expo.dev/eas-update/eas-cli/

## 현재 구성

`eas.json`

- `development`
  - `developmentClient: true`
  - `distribution: internal`
  - `environment: development`
  - `channel: development`
- `preview`
  - `distribution: internal`
  - `environment: preview`
  - `channel: preview`
- `production`
  - `autoIncrement: true`
  - `environment: production`
  - `channel: production`

`app.json`

- `runtimeVersion.policy = appVersion`
- `updates.checkAutomatically = NEVER`
- `updates.fallbackToCacheTimeout = 0`

`app.config.js`

- `EAS_PROJECT_ID` 또는 `EXPO_PROJECT_ID`가 있으면 `extra.eas.projectId`와 `updates.url = https://u.expo.dev/<projectId>`를 설정한다.
- `SIGNAL_IOS_REMOTE_PUSH_ENABLED=1`인 빌드에서만 iOS remote push entitlement와 공식 `expo-notifications` plugin을 켠다.
- `SIGNAL_IOS_APPLE_SIGN_IN_ENABLED=1`인 빌드에서만 Apple Sign In entitlement를 유지한다.
- `KAKAO_NATIVE_APP_KEY`가 있으면 Kakao native SDK 설정을 주입한다.

## 필수 EAS 변수

EAS dashboard 또는 CLI에서 환경별로 설정한다.

공통:

- `EAS_PROJECT_ID`
- `EXPO_PUBLIC_SIGNAL_API_BASE_URL`

iOS 운영 빌드:

- `SIGNAL_IOS_REMOTE_PUSH_ENABLED=1`
- `SIGNAL_IOS_APPLE_SIGN_IN_ENABLED=1`
- `KAKAO_NATIVE_APP_KEY`

선택:

- `EXPO_PUBLIC_ADMOB_NATIVE_UNIT_ID`
- `EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID`

권장 visibility:

- `EXPO_PUBLIC_*`: plaintext 또는 sensitive. 클라이언트 번들에 포함되므로 비밀값으로 취급하지 않는다.
- `KAKAO_NATIVE_APP_KEY`: sensitive. 네이티브 앱 키는 앱 번들에 들어가지만 JS public env로 노출하지 않는다.
- 서버 key/JWT/private key: 앱 EAS 환경에 넣지 않는다. Railway/서버 환경에만 둔다.

## 환경 변수 관리 명령

```bash
eas env:create --environment preview --name EXPO_PUBLIC_SIGNAL_API_BASE_URL --value https://your-preview-api.example.com --visibility plaintext
eas env:create --environment production --name EXPO_PUBLIC_SIGNAL_API_BASE_URL --value https://your-api.example.com --visibility plaintext
eas env:create --environment production --name EAS_PROJECT_ID --value <project-id> --visibility plaintext
eas env:create --environment production --name KAKAO_NATIVE_APP_KEY --value <kakao-native-key> --visibility sensitive
```

로컬에 EAS 환경을 내려받을 때:

```bash
eas env:pull --environment development
eas env:pull --environment preview
eas env:pull --environment production
```

`.env` / `.env.local`은 커밋하지 않는다.

## 빌드

개발 클라이언트:

```bash
eas build --profile development --platform ios
eas build --profile development --platform android
```

내부 테스트:

```bash
eas build --profile preview --platform ios
eas build --profile preview --platform android
```

## 서버 동시 배포용 Web Export

API 서버와 같은 Railway 서비스에서 웹 클라이언트도 `/web`으로 제공할 수 있다.

```bash
npm run web:export
```

- 출력 경로: `server/src/public/web`
- 서버 노출 경로: `/web`
- Expo asset 경로: `/_expo/*`
- build artifact이므로 `server/src/public/web/`은 git에 커밋하지 않는다.

배포 build command 예시:

```bash
npm install
npm run web:export
npm --prefix server install
```

start command는 기존과 동일하다.

```bash
npm --prefix server run start
```

웹 bundle에 들어가는 API 기본 주소는 `EXPO_PUBLIC_SIGNAL_API_BASE_URL`을 사용한다. 같은 서버의 `/v1/*`를 호출하려면 이 값을 배포 origin에 맞춰 설정한다.

스토어/운영:

```bash
eas build --profile production --platform ios
eas build --profile production --platform android
```

운영 빌드 전 확인:

- `app.json`의 `version`이 의도한 앱 버전인지 확인한다.
- `ios.buildNumber`와 `android.versionCode`는 `production.autoIncrement`가 처리하지만, 심사 빌드 기준을 확인한다.
- native dependency, plugin, Info.plist, entitlements, app icon, splash, push capability가 바뀌면 OTA가 아니라 새 build가 필요하다.

## OTA 업데이트

현재 `runtimeVersion.policy = appVersion`이다. 즉 앱 `version`이 같은 빌드끼리만 OTA update가 호환된다.

Preview OTA:

```bash
eas update --channel preview --environment preview --message "Preview update"
```

Production OTA:

```bash
eas update --channel production --environment production --message "Production update"
```

OTA로 처리 가능한 변경:

- JS/TS 화면 로직
- 스타일
- 문자열
- 이미지 asset 변경

새 빌드가 필요한 변경:

- native module 추가/삭제/업데이트
- Expo plugin 변경
- `app.json`의 iOS/Android native 설정 변경
- icon/splash native asset catalog 변경
- push/Sign in with Apple/Kakao native 설정 변경
- `runtimeVersion`이 달라지는 앱 버전 변경

## 업데이트 확인 UX

앱은 `updates.checkAutomatically = NEVER`로 자동 업데이트 적용을 하지 않는다. 현재 OTA 배너/컨텍스트를 통해 사용자가 명시적으로 업데이트 확인/적용하는 흐름을 사용한다.

운영 기준:

- 앱 시작 시 무조건 reload하지 않는다.
- 업데이트가 있으면 배너로 알리고, 사용자가 선택하면 fetch 후 reload한다.
- 장애 update가 배포되면 EAS Update dashboard에서 channel/branch 연결을 되돌리거나 새 update를 배포한다.

## Submit

```bash
eas submit --platform ios --profile production
eas submit --platform android --profile production
```

Submit 전 확인:

- App Store Connect / Play Console 앱 정보
- 개인정보 처리방침 URL
- 광고 사용 여부
- 알림 권한 문구
- 소셜 로그인 심사 정보

## 장애 대응

OTA가 안 내려올 때:

- 빌드의 `channel`과 `eas update --channel`이 같은지 확인
- 빌드의 `runtimeVersion`과 update의 runtime version이 같은지 확인
- `EAS_PROJECT_ID`가 빌드에 들어가 `updates.url`이 설정됐는지 확인
- EAS dashboard의 Updates 페이지에서 배포 branch/channel 연결 확인

빌드에서 env가 비어 있을 때:

- `eas.json` profile의 `environment` 값 확인
- EAS dashboard 환경별 변수 확인
- secret visibility 값은 app config 해석 시 읽을 수 없는 경우가 있으므로, app config에 필요한 값은 secret 대신 sensitive/plaintext 사용

푸시가 안 될 때:

- iOS production build에 `SIGNAL_IOS_REMOTE_PUSH_ENABLED=1` 적용 여부 확인
- Apple Developer App ID push capability 확인
- `EAS_PROJECT_ID`가 들어가 Expo push token이 정상 발급되는지 확인
- 서버 `/v1/auth/devices`에 token이 등록되는지 확인
