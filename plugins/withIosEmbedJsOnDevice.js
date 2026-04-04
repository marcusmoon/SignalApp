/**
 * 실기기 Debug 빌드에 JS 번들을 넣어 "No script URL provided"를 방지합니다.
 * - `ios/.xcode.env.updates`: 실기기에서 SKIP_BUNDLING 해제
 * - `project.pbxproj`: Debug+시뮬레이터일 때만 SKIP_BUNDLING (prebuild가 되돌린 경우 대비)
 */
const fs = require('fs');
const path = require('path');

const { withDangerousMod } = require('expo/config-plugins');

const XCODE_ENV_UPDATES = `# 실기기(iPhone) Debug: Metro 없이 실행하려면 JS가 앱에 포함되어야 함.
# Debug에서 SKIP_BUNDLING=1이면 "No script URL provided"가 납니다.
# 시뮬레이터는 Metro를 쓰므로 번들 생략 유지.
if [[ "\${PLATFORM_NAME:-}" != *simulator* ]]; then
  unset SKIP_BUNDLING
fi
`;

function findProjectPbxproj(iosDir) {
  if (!fs.existsSync(iosDir)) return null;
  const entries = fs.readdirSync(iosDir, { withFileTypes: true });
  for (const e of entries) {
    if (e.isDirectory() && e.name.endsWith('.xcodeproj')) {
      const p = path.join(iosDir, e.name, 'project.pbxproj');
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
}

module.exports = function withIosEmbedJsOnDevice(config) {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const projectRoot = cfg.modRequest.projectRoot;
      const iosDir = path.join(projectRoot, 'ios');
      fs.mkdirSync(iosDir, { recursive: true });
      fs.writeFileSync(path.join(iosDir, '.xcode.env.updates'), XCODE_ENV_UPDATES, 'utf8');

      const pbx = findProjectPbxproj(iosDir);
      if (pbx) {
        let c = fs.readFileSync(pbx, 'utf8');
        const bad =
          'if [[ \\"$CONFIGURATION\\" = *Debug* ]]; then\\n  export SKIP_BUNDLING=1\\nfi\\n';
        const good =
          'if [[ \\"$CONFIGURATION\\" = *Debug* && \\"$PLATFORM_NAME\\" == *simulator* ]]; then\\n  export SKIP_BUNDLING=1\\nfi\\n';
        if (c.includes(bad)) {
          c = c.replace(bad, good);
          fs.writeFileSync(pbx, c, 'utf8');
        }
      }
      return cfg;
    },
  ]);
};
