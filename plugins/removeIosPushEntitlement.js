/**
 * 무료 Apple Developer(Personal Team)는 Push Notifications entitlement가 있으면
 * 기기용 개발 프로비저닝을 만들 수 없습니다.
 *
 * 원격 푸시(APNs)가 필요하면 Apple Developer Program(유료) 가입 후
 * app.json에서 이 플러그인 항목을 제거하고 `npx expo prebuild`를 다시 실행하세요.
 */
const { withEntitlementsPlist } = require('expo/config-plugins');

module.exports = function withRemoveIosPushEntitlement(config) {
  return withEntitlementsPlist(config, (mod) => {
    delete mod.modResults['aps-environment'];
    return mod;
  });
};
