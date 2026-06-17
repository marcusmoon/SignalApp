# Expo / EAS 운영

현재 앱은 **Expo SDK 56** (React Native 0.85) 기준이며, **로컬 iOS 빌드는 Xcode 27 + iOS 27 SDK**를 사용한다. 앱 최소 지원 OS(deployment target)는 **iOS 16.4**다.

## 로컬 개발

```bash
npm install
npm run start
npm run ios
npm run android
npm run web
```

`npm run ios`는 Xcode 27이 active인지 먼저 확인한다(`scripts/ensureIosXcode27.mjs`).

### Xcode 27 설정

```bash
sudo xcode-select -s /Applications/Xcode-27.app/Contents/Developer
sudo xcodebuild -license accept
xcodebuild -version   # Xcode 27.x 확인
xcrun simctl list runtimes | grep iOS   # iOS 27.0 시뮬레이터 확인
```

Xcode 26과 27이 같이 설치돼 있으면 `xcode-select`가 26을 가리키면 시뮬레이터/SDK 불일치로 빌드가 실패할 수 있다.

## 네이티브 환경 변경 후

```bash
npx patch-package
npx expo prebuild --platform ios --no-install
cd ios
pod install
open SIGNAL.xcworkspace
```

Kakao native key, URL scheme, status bar, push entitlement, splash, alternate icon처럼 native 설정이 바뀌면 prebuild 또는 EAS build가 필요하다.

### iOS 27 / UIScene

iOS 27 SDK로 빌드하면 UIKit scene lifecycle이 필수다(Apple TN3187). npm에 있는 Expo SDK 56 prebuild 템플릿에는 아직 `ExpoAppSceneDelegate`가 없어 `plugins/withIosSceneLifecycle.js`로 보완한다. Expo npm 템플릿이 scene delegate를 기본 제공하면 해당 플러그인을 제거한다.

`patches/expo-modules-jsi+56.0.10.patch`는 Xcode 27 Swift 컴파일 오류(host-object setter C function pointer)를 막는다. `npm install` 시 `postinstall`로 자동 적용된다.

## EAS Build

```bash
eas build --platform ios --profile preview
eas build --platform android --profile preview
eas build --platform ios --profile production
eas build --platform android --profile production
```

필수 secret:

- `EAS_PROJECT_ID`
- `KAKAO_NATIVE_APP_KEY`
- 운영 API URL 관련 `EXPO_PUBLIC_SIGNAL_API_BASE_URL`

EAS iOS 이미지(`sdk-56` / `latest`)는 현재 **Xcode 26.4**다. 로컬은 iOS 27 SDK, EAS는 iOS 26 SDK로 빌드되는 구성이며 App Store 최소 요건(iOS 26 SDK)에는 맞는다. EAS에 Xcode 27 이미지가 추가되면 `eas.json`의 `ios.image`로 맞출 수 있다.

## OTA Update

JS/asset 변경만 있을 때 사용한다. native module, Info.plist, entitlement, app icon, splash native 설정 변경은 OTA로 반영되지 않는다.

```bash
eas update --channel preview --message "update message"
eas update --channel production --message "update message"
```

- GitHub/Railway 배포는 앱 JS 번들을 갱신하지 않는다. 앱 반영에는 새 native 빌드 또는 EAS Update가 필요하다.
- Xcode Run 기본 설정인 `Debug` 빌드는 앱 코드에서 OTA 확인을 건너뛴다. OTA 검증은 Xcode `Release` 또는 EAS preview/production 빌드로 한다.
- Xcode로 직접 만든 Release 빌드도 `Expo.plist`의 `EXUpdatesRequestHeaders.expo-channel-name`이 `production`이어야 production OTA를 받는다.
- 현재 앱은 시작 지연을 줄이기 위해 `checkAutomatically=NEVER`를 사용하고, 앱 활성화 시 자체 업데이트 확인 UI로 다운로드/재시작한다.

## iOS Xcode 빌드

```bash
open ios/SIGNAL.xcworkspace
```

문제가 생기면 Xcode 종료 후 `~/Library/Developer/Xcode/DerivedData/SIGNAL-*`만 삭제한다.
