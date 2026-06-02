# Expo / EAS 운영

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
eas update --branch preview --message "update message"
eas update --branch production --message "update message"
```

## iOS Xcode 빌드

```bash
open /Users/marcusmoon/SignalApp/ios/SIGNAL.xcworkspace
```

문제가 생기면 Xcode 종료 후 `~/Library/Developer/Xcode/DerivedData/SIGNAL-*`만 삭제한다.
