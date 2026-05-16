/**
 * 무료 Apple Developer(Personal Team)는 Sign In with Apple entitlement가 있으면
 * 기기용 개발 프로비저닝을 만들 수 없습니다.
 *
 * Apple Developer Program(유료) + App ID에 Sign In with Apple capability 설정 후
 * SIGNAL_IOS_APPLE_SIGN_IN_ENABLED=1 로 app.config.js가 이 플러그인을 제외하게 한 뒤 prebuild/rebuild합니다.
 */
const fs = require('fs');
const { globSync } = require('glob');

/** @expo/plist는 default export — require 시 .default에서 parse/build 사용 */
const plistModule = require('@expo/plist');
const plist = plistModule.default ?? plistModule;
const {
  withEntitlementsPlist,
  withFinalizedMod,
  IOSConfig,
} = require('expo/config-plugins');

const APPLE_SIGN_IN_KEY = 'com.apple.developer.applesignin';

function stripAppleSignInFromPlistFile(entitlementsPath) {
  if (!entitlementsPath || !fs.existsSync(entitlementsPath)) return false;
  const raw = fs.readFileSync(entitlementsPath, 'utf8');
  const parsed = plist.parse(raw);
  if (!parsed[APPLE_SIGN_IN_KEY]) return false;
  delete parsed[APPLE_SIGN_IN_KEY];
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

module.exports = function withRemoveIosAppleSignInEntitlement(config) {
  config = withEntitlementsPlist(config, (mod) => {
    delete mod.modResults[APPLE_SIGN_IN_KEY];
    return mod;
  });

  return withFinalizedMod(config, [
    'ios',
    async (cfg) => {
      const projectRoot = cfg.modRequest.projectRoot;
      for (const p of findEntitlementsFiles(projectRoot)) {
        stripAppleSignInFromPlistFile(p);
      }
      return cfg;
    },
  ]);
};
