const fs = require('fs');
const path = require('path');

const { withDangerousMod } = require('expo/config-plugins');

const BACKGROUND_HELPER = `private enum SignalLaunchBackground {
  static var color: UIColor {
    UIColor(red: 9.0 / 255.0, green: 10.0 / 255.0, blue: 15.0 / 255.0, alpha: 1.0)
  }
}
`;

function patchAppDelegate(projectRoot) {
  const appDelegatePath = path.join(projectRoot, 'ios', 'SIGNAL', 'AppDelegate.swift');
  if (!fs.existsSync(appDelegatePath)) return;

  let raw = fs.readFileSync(appDelegatePath, 'utf8');
  if (!raw.includes('import UIKit')) {
    raw = raw.replace('import ReactAppDependencyProvider\n', 'import ReactAppDependencyProvider\nimport UIKit\n');
  }
  if (!raw.includes('private enum SignalLaunchBackground')) {
    raw = raw.replace(/(import UIKit\n+)/, `$1${BACKGROUND_HELPER}\n`);
  }
  if (!raw.includes('window?.backgroundColor = SignalLaunchBackground.color')) {
    raw = raw.replace(
      '    window = UIWindow(frame: UIScreen.main.bounds)\n',
      '    window = UIWindow(frame: UIScreen.main.bounds)\n    window?.backgroundColor = SignalLaunchBackground.color\n',
    );
  }
  fs.writeFileSync(appDelegatePath, raw, 'utf8');
}

module.exports = function withIosLaunchBackground(config) {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      patchAppDelegate(cfg.modRequest.projectRoot);
      return cfg;
    },
  ]);
};
