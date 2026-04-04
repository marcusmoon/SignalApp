/**
 * 무료 Apple Developer(Personal Team)는 Push Notifications entitlement가 있으면
 * 기기용 개발 프로비저닝을 만들 수 없습니다.
 *
 * 원격 푸시(APNs)가 필요하면 Apple Developer Program(유료) 가입 후
 * app.json에서 이 플러그인 항목을 제거하고 `npx expo prebuild`를 다시 실행하세요.
 */
const fs = require('fs');
const { globSync } = require('glob');

const plist = require('@expo/plist');
const {
  withEntitlementsPlist,
  withFinalizedMod,
  IOSConfig,
} = require('expo/config-plugins');

function stripApsFromPlistFile(entitlementsPath) {
  if (!entitlementsPath || !fs.existsSync(entitlementsPath)) return false;
  const raw = fs.readFileSync(entitlementsPath, 'utf8');
  const parsed = plist.parse(raw);
  if (!parsed['aps-environment']) return false;
  delete parsed['aps-environment'];
  const out =
    Object.keys(parsed).length === 0
      ? `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict/>
</plist>
`
      : plist.build(parsed);
  fs.writeFileSync(entitlementsPath, out, 'utf8');
  return true;
}

function findEntitlementsFiles(projectRoot) {
  const fromXcode = IOSConfig.Entitlements.getEntitlementsPath(projectRoot);
  const paths = new Set();
  if (fromXcode) paths.add(fromXcode);
  try {
    for (const p of globSync('ios/**/*.entitlements', {
      cwd: projectRoot,
      absolute: true,
      ignore: ['**/Pods/**', '**/build/**'],
    })) {
      paths.add(p);
    }
  } catch {
    // ignore
  }
  return [...paths];
}

module.exports = function withRemoveIosPushEntitlement(config) {
  config = withEntitlementsPlist(config, (mod) => {
    delete mod.modResults['aps-environment'];
    return mod;
  });

  // entitlements mod가 파일에 쓴 뒤에도, 다른 단계가 다시 넣는 경우를 막기 위해 마지막에 파일에서 제거
  return withFinalizedMod(config, [
    'ios',
    async (cfg) => {
      const projectRoot = cfg.modRequest.projectRoot;
      for (const p of findEntitlementsFiles(projectRoot)) {
        stripApsFromPlistFile(p);
      }
      return cfg;
    },
  ]);
};
