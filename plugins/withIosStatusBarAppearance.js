const fs = require('fs');
const path = require('path');

const { withInfoPlist, withXcodeProject, withFinalizedMod, IOSConfig } = require('expo/config-plugins');

const PLIST_KEY = 'UIViewControllerBasedStatusBarAppearance';
const XCODE_KEY = 'INFOPLIST_KEY_UIViewControllerBasedStatusBarAppearance';

function patchPbxprojBuildSettings(projectRoot) {
  const iosDir = path.join(projectRoot, 'ios');
  if (!fs.existsSync(iosDir)) return;

  const entries = fs.readdirSync(iosDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.endsWith('.xcodeproj')) continue;
    const pbxPath = path.join(iosDir, entry.name, 'project.pbxproj');
    if (!fs.existsSync(pbxPath)) continue;

    let raw = fs.readFileSync(pbxPath, 'utf8');
    if (raw.includes(XCODE_KEY)) continue;

    raw = raw.replace(
      /(INFOPLIST_FILE = SIGNAL\/Info\.plist;\n)/g,
      `$1\t\t\t\t${XCODE_KEY} = YES;\n`,
    );
    fs.writeFileSync(pbxPath, raw, 'utf8');
  }
}

function patchInfoPlistFile(projectRoot) {
  const plistPath = path.join(projectRoot, 'ios', 'SIGNAL', 'Info.plist');
  if (!fs.existsSync(plistPath)) return;

  let raw = fs.readFileSync(plistPath, 'utf8');
  if (raw.includes(`<key>${PLIST_KEY}</key>`)) {
    raw = raw.replace(
      new RegExp(`<key>${PLIST_KEY}</key>\\s*<false\\s*/>`, 'm'),
      `<key>${PLIST_KEY}</key>\n    <true/>`,
    );
    raw = raw.replace(
      new RegExp(`<key>${PLIST_KEY}</key>\\s*<false/>`, 'm'),
      `<key>${PLIST_KEY}</key>\n    <true/>`,
    );
  } else {
    raw = raw.replace(
      '</dict>\n</plist>',
      `    <key>${PLIST_KEY}</key>\n    <true/>\n  </dict>\n</plist>`,
    );
  }
  fs.writeFileSync(plistPath, raw, 'utf8');
}

/**
 * iOS 상태바: react-native-screens `statusBarStyle` → plist YES 필수.
 * expo-status-bar / RN `StatusBar` 는 plist NO 가 필요해 iOS 에서는 쓰지 않음 (`ThemedStatusBar` 참고).
 */
module.exports = function withIosStatusBarAppearance(config) {
  config = withInfoPlist(config, (mod) => {
    mod.modResults[PLIST_KEY] = true;
    return mod;
  });

  config = withXcodeProject(config, (mod) => {
    const configurations = mod.modResults.pbxXCBuildConfigurationSection();
    for (const key of Object.keys(configurations)) {
      const item = configurations[key];
      if (typeof item !== 'object' || !item.buildSettings) continue;
      const plistFile = item.buildSettings.INFOPLIST_FILE;
      if (plistFile !== 'SIGNAL/Info.plist' && plistFile !== '"SIGNAL/Info.plist"') continue;
      item.buildSettings[XCODE_KEY] = 'YES';
    }
    return mod;
  });

  return withFinalizedMod(config, [
    'ios',
    async (cfg) => {
      const projectRoot = cfg.modRequest.projectRoot;
      patchInfoPlistFile(projectRoot);
      patchPbxprojBuildSettings(projectRoot);
      const entitlementsPath = IOSConfig.Entitlements.getEntitlementsPath(projectRoot);
      if (entitlementsPath) {
        // no-op: keep hook point if other mods run after entitlements
      }
      return cfg;
    },
  ]);
};
