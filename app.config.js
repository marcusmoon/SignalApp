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

function readEnvValue(key) {
  const fromFile = readEnvValueFromFiles(key);
  if (fromFile !== undefined) return fromFile;
  return typeof process.env[key] === 'string' ? process.env[key].trim() : undefined;
}

function envFlag(value) {
  return /^(1|true|yes|on)$/i.test(String(value ?? '').trim());
}

function pluginName(plugin) {
  return Array.isArray(plugin) ? plugin[0] : plugin;
}

function withoutPlugin(plugins, names) {
  const drop = new Set(names);
  return plugins.filter((plugin) => !drop.has(pluginName(plugin)));
}

function hasPlugin(plugins, name) {
  return plugins.some((plugin) => pluginName(plugin) === name);
}

module.exports = () => {
  const previewOtaBanner = readEnvValue('EXPO_PUBLIC_PREVIEW_OTA_BANNER');
  const easProjectId = readEnvValue('EAS_PROJECT_ID') || readEnvValue('EXPO_PROJECT_ID');
  const iosRemotePushEnabled = envFlag(readEnvValue('SIGNAL_IOS_REMOTE_PUSH_ENABLED'));
  const iosAppleSignInEnabled = envFlag(readEnvValue('SIGNAL_IOS_APPLE_SIGN_IN_ENABLED'));

  // 네이티브 앱 번들에 카카오 SDK 를 심으려면 prebuild 시점에만 키가 필요합니다(NOT EXPO_PUBLIC — JS 번들에 안 들어감).
  // Kakao 개발자 콘솔의 네이티브 앱 키와 동일 값을 EAS Secret 또는 로컬 .env 의 `KAKAO_NATIVE_APP_KEY` 로 주입합니다.
  const kakaoNativeKey = readEnvValue('KAKAO_NATIVE_APP_KEY') || '';
  if (kakaoNativeKey && !/^[0-9a-fA-F]{32}$/.test(kakaoNativeKey)) {
    throw new Error(
      `KAKAO_NATIVE_APP_KEY must be a 32-character hexadecimal Kakao Native App Key (current length: ${kakaoNativeKey.length}).`,
    );
  }

  const basePlugins = Array.isArray(appJson.expo.plugins) ? [...appJson.expo.plugins] : [];
  let plugins = [...basePlugins];

  // 개인 Apple Team 빌드는 iOS remote push entitlement 없이도 설치되도록 유지하고,
  // TestFlight/운영 빌드에서만 공식 expo-notifications 플러그인과 aps entitlement를 켭니다.
  // 개인 Apple Team 빌드는 Sign In with Apple entitlement 없이도 설치되도록 유지합니다.
  if (iosAppleSignInEnabled) {
    plugins = withoutPlugin(plugins, ['./plugins/removeIosAppleSignInEntitlement.js']);
  } else {
    plugins = withoutPlugin(plugins, ['expo-apple-authentication']);
  }

  if (iosRemotePushEnabled) {
    plugins = withoutPlugin(plugins, [
      './plugins/expoNotificationsAndroidOnly.js',
      './plugins/removeIosPushEntitlement.js',
    ]);
    if (!hasPlugin(plugins, 'expo-notifications')) {
      plugins.push([
        'expo-notifications',
        {
          icon: './assets/images/icon.png',
          color: '#00C087',
        },
      ]);
    }
  }

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
      updates: {
        ...(appJson.expo.updates ?? {}),
        ...(easProjectId ? { url: `https://u.expo.dev/${easProjectId}` } : {}),
      },
      extra: {
        ...(appJson.expo.extra ?? {}),
        ...(easProjectId
          ? {
              eas: {
                ...(appJson.expo.extra?.eas ?? {}),
                projectId: easProjectId,
              },
            }
          : {}),
        previewOtaBanner,
        iosAppleSignInEnabled,
      },
    },
  };
};
