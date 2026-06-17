# Expo / EAS 운영

현재 앱은 **Expo SDK 56** (React Native 0.85, iOS deployment target 16.4) 기준이다.

## 로컬 개발

```bash
npm install
npm run start
npm run ios
npm run android
npm run web
```

## 네이티브 환경 변경 후

```bash
npx expo prebuild --platform ios --no-install
cd ios
pod install
open SIGNAL.xcworkspace
```

Kakao native key, URL scheme, status bar, push entitlement, splash, alternate icon처럼 native 설정이 바뀌면 prebuild 또는 EAS build가 필요하다.

iOS **Xcode 27 / iOS 27 SDK** 빌드는 UIScene lifecycle이 필요하다. SDK 56 prebuild 템플릿에 아직 SceneDelegate가 npm에 포함되지 않아 `plugins/withIosSceneLifecycle.js` config plugin으로 보완한다. Expo upstream 템플릿이 Scene을 기본 제공하면 해당 플러그인을 제거한다.

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
open /Users/marcusmoon/SignalApp/ios/SIGNAL.xcworkspace
```

문제가 생기면 Xcode 종료 후 `~/Library/Developer/Xcode/DerivedData/SIGNAL-*`만 삭제한다.
