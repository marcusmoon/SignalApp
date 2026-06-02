const fs = require('fs');
const path = require('path');

const { withDangerousMod, withInfoPlist, withXcodeProject } = require('expo/config-plugins');

const ICONS = [
  { key: 'SignalIconBlue', source: 'app-icon-blue.png' },
  { key: 'SignalIconGreen', source: 'app-icon-green.png' },
  { key: 'SignalIconDark', source: 'app-icon-dark.png' },
  { key: 'SignalIconMono', source: 'app-icon-mono.png' },
];

const SWIFT_SOURCE = `import React
import UIKit

@objc(SignalAppIcon)
class SignalAppIcon: NSObject {
  @objc static func requiresMainQueueSetup() -> Bool {
    true
  }

  @objc func isSupported(_ resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    resolve(UIApplication.shared.supportsAlternateIcons)
  }

  @objc func getAlternateIconName(_ resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    resolve(UIApplication.shared.alternateIconName)
  }

  @objc func setAlternateIconName(
    _ iconName: String?,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.main.async {
      guard UIApplication.shared.supportsAlternateIcons else {
        resolve(false)
        return
      }

      UIApplication.shared.setAlternateIconName(iconName) { error in
        if let error = error {
          reject("APP_ICON_CHANGE_FAILED", error.localizedDescription, error)
          return
        }
        resolve(true)
      }
    }
  }
}
`;

const BRIDGE_SOURCE = `#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(SignalAppIcon, NSObject)

RCT_EXTERN_METHOD(isSupported:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(getAlternateIconName:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(setAlternateIconName:(NSString * _Nullable)iconName resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)

@end
`;

function appIconContents(filename) {
  return JSON.stringify(
    {
      images: [
        {
          filename,
          idiom: 'universal',
          platform: 'ios',
          size: '1024x1024',
        },
      ],
      info: {
        version: 1,
        author: 'expo',
      },
    },
    null,
    2,
  );
}

function ensureIosFiles(projectRoot) {
  const iosRoot = path.join(projectRoot, 'ios', 'SIGNAL');
  const assetsRoot = path.join(iosRoot, 'Images.xcassets');
  if (!fs.existsSync(iosRoot) || !fs.existsSync(assetsRoot)) return;

  fs.writeFileSync(path.join(iosRoot, 'SignalAppIcon.swift'), SWIFT_SOURCE, 'utf8');
  fs.writeFileSync(path.join(iosRoot, 'SignalAppIconBridge.m'), BRIDGE_SOURCE, 'utf8');

  for (const icon of ICONS) {
    const sourcePath = path.join(projectRoot, 'assets', 'images', icon.source);
    if (!fs.existsSync(sourcePath)) continue;
    const setDir = path.join(assetsRoot, `${icon.key}.appiconset`);
    fs.mkdirSync(setDir, { recursive: true });
    fs.copyFileSync(sourcePath, path.join(setDir, icon.source));
    fs.writeFileSync(path.join(setDir, 'Contents.json'), appIconContents(icon.source), 'utf8');
  }
}

function configureAlternateIcons(plist) {
  plist.CFBundleIcons = plist.CFBundleIcons || {};
  plist.CFBundleIcons.CFBundleAlternateIcons = plist.CFBundleIcons.CFBundleAlternateIcons || {};
  for (const icon of ICONS) {
    plist.CFBundleIcons.CFBundleAlternateIcons[icon.key] = {
      CFBundleIconFiles: [icon.key],
      UIPrerenderedIcon: false,
    };
  }
  return plist;
}

function configureProject(project) {
  const target = project.getFirstTarget()?.uuid;
  if (!target) return;
  const mainGroup =
    project.findPBXGroupKey?.({ name: 'SIGNAL' }) ||
    project.pbxGroupByName?.('SIGNAL')?.uuid;

  for (const source of ['SignalAppIcon.swift', 'SignalAppIconBridge.m']) {
    const projectPath = `SIGNAL/${source}`;
    const fileRefs = project.pbxFileReferenceSection?.() || {};
    for (const key of Object.keys(fileRefs)) {
      const item = fileRefs[key];
      if (typeof item !== 'object') continue;
      if (item.name === source || item.path === source) {
        item.name = source;
        item.path = projectPath;
        item.sourceTree = '"<group>"';
      }
    }

    const already = String(project.writeSync()).includes(projectPath);
    if (!already && mainGroup) {
      project.addSourceFile(projectPath, { target }, mainGroup);
    }
  }

  const names = ICONS.map((icon) => icon.key).join(' ');
  const configurations = project.pbxXCBuildConfigurationSection();
  for (const key of Object.keys(configurations)) {
    const item = configurations[key];
    if (typeof item !== 'object' || !item.buildSettings) continue;
    const plistFile = item.buildSettings.INFOPLIST_FILE;
    if (plistFile !== 'SIGNAL/Info.plist' && plistFile !== '"SIGNAL/Info.plist"') continue;
    item.buildSettings.ASSETCATALOG_COMPILER_ALTERNATE_APPICON_NAMES = `"${names}"`;
  }
}

module.exports = function withIosAlternateAppIcons(config) {
  config = withInfoPlist(config, (mod) => {
    mod.modResults = configureAlternateIcons(mod.modResults);
    return mod;
  });

  config = withDangerousMod(config, [
    'ios',
    async (cfg) => {
      ensureIosFiles(cfg.modRequest.projectRoot);
      return cfg;
    },
  ]);

  return withXcodeProject(config, (mod) => {
    configureProject(mod.modResults);
    return mod;
  });
};
