const fs = require('fs');
const path = require('path');

const { withDangerousMod } = require('expo/config-plugins');

const IOS_DEPLOYMENT_TARGET = '16.4';
const MARKER = '# SIGNAL: align CocoaPods deployment targets';

const PODFILE_SNIPPET = `    ${MARKER}
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        deployment_target = config.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
        if deployment_target.to_f < ${IOS_DEPLOYMENT_TARGET}
          config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '${IOS_DEPLOYMENT_TARGET}'
        end
      end
    end`;

function patchPodfile(podfilePath) {
  if (!fs.existsSync(podfilePath)) return;
  let contents = fs.readFileSync(podfilePath, 'utf8');
  if (contents.includes(MARKER)) return;

  const anchor = /react_native_post_install\([\s\S]*?\)\n/m;
  if (!anchor.test(contents)) return;

  contents = contents.replace(anchor, (block) => `${block}${PODFILE_SNIPPET}\n`);
  fs.writeFileSync(podfilePath, contents, 'utf8');
}

/** CocoaPods 일부 타깃이 13.4 등 구버전을 유지해 최신 Xcode에서 경고/오류가 납니다. */
module.exports = function withIosPodsDeploymentTarget(config) {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      patchPodfile(path.join(cfg.modRequest.platformProjectRoot, 'Podfile'));
      return cfg;
    },
  ]);
};
