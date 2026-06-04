import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(import.meta.dirname, '..');

function readEnvValueFromFiles(key) {
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

function kakaoNativeKey() {
  const fromFile = readEnvValueFromFiles('KAKAO_NATIVE_APP_KEY');
  const value = fromFile !== undefined ? fromFile : process.env.KAKAO_NATIVE_APP_KEY || '';
  return String(value || '').trim();
}

function assertValidKakaoNativeKey(key) {
  if (!/^[0-9a-fA-F]{32}$/.test(key)) {
    throw new Error(
      `KAKAO_NATIVE_APP_KEY must be a 32-character hexadecimal Kakao Native App Key (current length: ${key.length}).`,
    );
  }
}

function replacePlistStringAfterKey(contents, key, value) {
  const re = new RegExp(`(<key>${key}</key>\\s*<string>)([^<]*)(</string>)`);
  if (re.test(contents)) return contents.replace(re, `$1${value}$3`);
  return contents;
}

function syncIosInfoPlist(key) {
  const infoPlistPath = path.join(root, 'ios', 'SIGNAL', 'Info.plist');
  if (!fs.existsSync(infoPlistPath)) return false;

  let contents = fs.readFileSync(infoPlistPath, 'utf8');
  contents = contents.replace(/<string>kakao(?:\$\([^)]+\)|[0-9a-fA-F]+)<\/string>/g, `<string>kakao${key}</string>`);
  contents = replacePlistStringAfterKey(contents, 'KAKAO_APP_KEY', key);
  contents = replacePlistStringAfterKey(contents, 'KAKAO_APP_SCHEME', `kakao${key}`);
  const kakaoQuerySchemes = ['kakaokompassauth', 'storykompassauth', 'kakaolink'];
  if (!contents.includes('<key>LSApplicationQueriesSchemes</key>')) {
    const block = [
      '\t<key>LSApplicationQueriesSchemes</key>',
      '\t<array>',
      ...kakaoQuerySchemes.map((scheme) => `\t\t<string>${scheme}</string>`),
      '\t</array>',
      '',
    ].join('\n');
    contents = contents.replace(/\t<key>LSMinimumSystemVersion<\/key>/, `${block}\t<key>LSMinimumSystemVersion</key>`);
  } else {
    for (const scheme of kakaoQuerySchemes) {
      if (!contents.includes(`<string>${scheme}</string>`)) {
        contents = contents.replace(
          /(<key>LSApplicationQueriesSchemes<\/key>\s*<array>\n)/,
          `$1\t\t<string>${scheme}</string>\n`,
        );
      }
    }
  }
  fs.writeFileSync(infoPlistPath, contents);
  return true;
}

function syncIosAppDelegate() {
  const appDelegatePath = path.join(root, 'ios', 'SIGNAL', 'AppDelegate.swift');
  if (!fs.existsSync(appDelegatePath)) return false;

  let contents = fs.readFileSync(appDelegatePath, 'utf8');
  if (!contents.includes('import kakao_login')) {
    contents = contents.replace('import Expo', 'import Expo\nimport kakao_login');
  }
  const callback = 'if kakao_login.RNKakaoLogins.isKakaoTalkLoginUrl(url) { return kakao_login.RNKakaoLogins.handleOpen(url) }';
  if (!contents.includes(callback)) {
    contents = contents.replace(
      /(\s+public override func application\([\s\S]*?open url: URL,[\s\S]*?options: \[UIApplication\.OpenURLOptionsKey: Any\] = \[:\]\s*\) -> Bool \{\n)/,
      `$1    ${callback}\n`,
    );
  }
  fs.writeFileSync(appDelegatePath, contents);
  return true;
}

function syncAndroidStrings(key) {
  const stringsPath = path.join(root, 'android', 'app', 'src', 'main', 'res', 'values', 'strings.xml');
  if (!fs.existsSync(stringsPath)) return false;

  let contents = fs.readFileSync(stringsPath, 'utf8');
  const item = `  <string name="kakao_app_key">${key}</string>`;
  if (contents.includes('name="kakao_app_key"')) {
    contents = contents.replace(/\s*<string name="kakao_app_key">[^<]*<\/string>/, `\n${item}`);
  } else {
    contents = contents.replace('</resources>', `${item}\n</resources>`);
  }
  fs.writeFileSync(stringsPath, contents);
  return true;
}

function syncAndroidManifest(key) {
  const manifestPath = path.join(root, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
  if (!fs.existsSync(manifestPath)) return false;

  let contents = fs.readFileSync(manifestPath, 'utf8');
  const activity = [
    '    <activity android:name="com.kakao.sdk.auth.AuthCodeHandlerActivity" android:exported="true">',
    '      <intent-filter>',
    '        <action android:name="android.intent.action.VIEW"/>',
    '        <category android:name="android.intent.category.DEFAULT"/>',
    '        <category android:name="android.intent.category.BROWSABLE"/>',
    `        <data android:host="oauth" android:scheme="kakao${key}"/>`,
    '      </intent-filter>',
    '    </activity>',
  ].join('\n');

  if (contents.includes('com.kakao.sdk.auth.AuthCodeHandlerActivity')) {
    contents = contents.replace(
      /    <activity android:name="com\.kakao\.sdk\.auth\.AuthCodeHandlerActivity"[\s\S]*?    <\/activity>/,
      activity,
    );
  } else {
    contents = contents.replace('  </application>', `${activity}\n  </application>`);
  }
  fs.writeFileSync(manifestPath, contents);
  return true;
}

const key = kakaoNativeKey();
if (!key) {
  console.log('[kakao] KAKAO_NATIVE_APP_KEY is empty. Native Kakao config sync skipped.');
  process.exit(0);
}

assertValidKakaoNativeKey(key);

const synced = [
  syncIosInfoPlist(key) && 'ios Info.plist',
  syncIosAppDelegate() && 'ios AppDelegate.swift',
  syncAndroidStrings(key) && 'android strings.xml',
  syncAndroidManifest(key) && 'android AndroidManifest.xml',
].filter(Boolean);

if (synced.length) {
  const masked = `${key.slice(0, 6)}...${key.slice(-4)}`;
  console.log(`[kakao] Synced native Kakao config (${masked}): ${synced.join(', ')}`);
} else {
  console.log('[kakao] No generated native project found. Expo prebuild will apply Kakao config later.');
}
