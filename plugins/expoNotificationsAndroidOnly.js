/**
 * expo-notifications 기본 플러그인은 iOS에 aps-environment(푸시)를 넣어
 * Personal Team(무료)에서는 프로비저닝이 실패합니다.
 * Android 알림 아이콘/색/매니페스트만 적용하고 iOS 푸시 entitlement는 넣지 않습니다.
 *
 * TestFlight/App Store에서 원격 푸시를 쓰는 빌드는 app.config.js에서
 * SIGNAL_IOS_REMOTE_PUSH_ENABLED=1일 때 이 플러그인을 공식 "expo-notifications"로 대체합니다.
 */
const { createRunOncePlugin } = require('expo/config-plugins');
const {
  withNotificationsAndroid,
} = require('expo-notifications/plugin/build/withNotificationsAndroid');

module.exports = createRunOncePlugin(
  (config, props) => withNotificationsAndroid(config, props || {}),
  'signal-expo-notifications-android-only',
  '1.0.0'
);
