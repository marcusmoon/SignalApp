/**
 * app.json을 그대로 쓰되, 미리보기 플래그는 manifest extra에 넣어
 * Constants.expoConfig.extra 에서 런타임으로 읽습니다.
 *
 * 셸에 EXPO_PUBLIC_PREVIEW_OTA_BANNER=1 이 남아 있으면 Expo/dotenv가 .env 를 덮어쓰지 않아
 * .env 에 0 을 넣어도 1 로 남을 수 있어, .env / .env.local 파일에서만 이 키를 읽습니다.
 */
const fs = require('fs');
const path = require('path');

const appJson = require('./app.json');

/** @returns {string | undefined} .env.local 이 .env 를 덮음; 한 파일 안에서는 마지막 줄이 우선 */
function readEnvValueFromFiles(key) {
  const root = __dirname;
  const files = ['.env', '.env.local'];
  let value;
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const lineRe = new RegExp(`^\\s*${escaped}\\s*=\\s*([^\\r\\n#]*)`, 'gm');
  for (const name of files) {
    const p = path.join(root, name);
    if (!fs.existsSync(p)) continue;
    const text = fs.readFileSync(p, 'utf8');
    let m;
    while ((m = lineRe.exec(text)) !== null) {
      value = m[1].trim().replace(/^["']|["']$/g, '');
    }
    lineRe.lastIndex = 0;
  }
  return value;
}

module.exports = () => {
  const fromFile = readEnvValueFromFiles('EXPO_PUBLIC_PREVIEW_OTA_BANNER');
  const previewOtaBanner =
    fromFile !== undefined ? fromFile : process.env.EXPO_PUBLIC_PREVIEW_OTA_BANNER;

  // 네이티브 앱 번들에 카카오 SDK 를 심으려면 prebuild 시점에만 키가 필요합니다(NOT EXPO_PUBLIC — JS 번들에 안 들어감).
  // Kakao 개발자 콘솔의 네이티브 앱 키와 동일 값을 EAS Secret 또는 로컬 .env 의 `KAKAO_NATIVE_APP_KEY` 로 주입합니다.
  const kakaoNativeKeyFromFile = readEnvValueFromFiles('KAKAO_NATIVE_APP_KEY');
  const kakaoNativeKey =
    kakaoNativeKeyFromFile !== undefined
      ? kakaoNativeKeyFromFile
      : typeof process.env.KAKAO_NATIVE_APP_KEY === 'string'
        ? process.env.KAKAO_NATIVE_APP_KEY.trim()
        : '';

  const basePlugins = Array.isArray(appJson.expo.plugins) ? [...appJson.expo.plugins] : [];
  const plugins = [...basePlugins];
  if (kakaoNativeKey) {
    plugins.push([
      'expo-build-properties',
      {
        android: {
          extraMavenRepos: ['https://devrepo.kakao.com/nexus/content/groups/public/'],
        },
      },
    ]);
    plugins.push(['@react-native-seoul/kakao-login', { kakaoAppKey: kakaoNativeKey }]);
  }

  return {
    expo: {
      ...appJson.expo,
      plugins,
      extra: {
        ...(appJson.expo.extra ?? {}),
        previewOtaBanner,
      },
    },
  };
};
