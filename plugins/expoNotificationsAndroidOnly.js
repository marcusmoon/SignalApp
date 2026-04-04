/**
 * expo-notifications 기본 플러그인은 iOS에 aps-environment(푸시)를 넣어
 * Personal Team(무료)에서는 프로비저닝이 실패합니다.
 * Android 알림 아이콘/색/매니페스트만 적용하고 iOS 푸시 entitlement는 넣지 않습니다.
 *
 * 유료 팀에서 원격 푸시를 쓰려면 이 플러그인 대신 app.json에
 * "expo-notifications" 플러그인을 다시 넣으세요.
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
