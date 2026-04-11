/**
 * Android 11+ 패키지 가시성: 다른 앱의 커스텀 스킴/딥링크를 열 때
 * `<queries>`에 패키지·VIEW+scheme을 선언하지 않으면 canOpenURL/openURL이
 * 웹으로만 떨어지는 경우가 많습니다.
 *
 * 네이티브 변경이므로 `npx expo prebuild` 또는 EAS 빌드 후 재설치가 필요합니다.
 */
const { withAndroidManifest } = require('expo/config-plugins');

/** 참고 링크에서 여는 금융·거래소 앱 (Play 스토어 패키지 기준) */
const QUERIED_PACKAGES = [
  'com.dunamu.exchange',
  'com.dunamu.exchange.global',
  'viva.republica.toss',
  'com.binance.dev',
  'com.coinbase.android',
  'com.yahoo.mobile.client.android.finance',
  'com.google.android.youtube',
];

/** VIEW + data:scheme(+host) — 앱 링크/브라우저 디스패치 시 매칭용 */
const VIEW_SCHEMES = [
  'yfinance',
  'yahoo',
  'upbit',
  'supertoss',
  'binance',
  'bnc',
  'coinbase',
  'youtube',
  'vnd.youtube',
];

function viewIntentForScheme(scheme) {
  return {
    action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
    data: [{ $: { 'android:scheme': scheme } }],
  };
}

/** https://finance.yahoo.com 같은 링크를 어떤 앱이 받는지 조회할 때 사용 */
const VIEW_INTENTS_WITH_DATA = [
  {
    action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
    data: [{ $: { 'android:scheme': 'https', 'android:host': 'finance.yahoo.com' } }],
  },
];

function intentDataKey(intent) {
  const d = intent?.data?.[0]?.$;
  if (!d) return null;
  const scheme = d['android:scheme'] ?? '';
  const host = d['android:host'] ?? '';
  const pathPrefix = d['android:pathPrefix'] ?? '';
  return `${scheme}|${host}|${pathPrefix}`;
}

function mergeExternalAppQueries(androidManifest) {
  const root = androidManifest?.manifest;
  if (!root) return androidManifest;

  const newPackages = QUERIED_PACKAGES.map((name) => ({
    $: { 'android:name': name },
  }));
  const newIntents = [...VIEW_SCHEMES.map(viewIntentForScheme), ...VIEW_INTENTS_WITH_DATA];

  if (!root.queries) {
    root.queries = [{ package: newPackages, intent: newIntents }];
    return androidManifest;
  }

  const queriesArr = Array.isArray(root.queries) ? root.queries : [root.queries];
  let block = queriesArr[0];
  if (!block || typeof block !== 'object' || Array.isArray(block)) {
    block = { package: [], intent: [] };
    queriesArr[0] = block;
    root.queries = queriesArr;
  } else {
    root.queries = queriesArr;
  }

  block.package = Array.isArray(block.package)
    ? block.package
    : block.package
      ? [].concat(block.package)
      : [];
  block.intent = Array.isArray(block.intent)
    ? block.intent
    : block.intent
      ? [].concat(block.intent)
      : [];

  const seenPkg = new Set(
    block.package.map((p) => p?.$?.['android:name']).filter((n) => typeof n === 'string' && n.length > 0),
  );
  for (const p of newPackages) {
    const name = p.$['android:name'];
    if (!seenPkg.has(name)) {
      block.package.push(p);
      seenPkg.add(name);
    }
  }

  const seenIntentKey = new Set(
    block.intent.map(intentDataKey).filter((k) => typeof k === 'string' && k.length > 0),
  );
  for (const intent of newIntents) {
    const key = intentDataKey(intent);
    if (key && !seenIntentKey.has(key)) {
      block.intent.push(intent);
      seenIntentKey.add(key);
    }
  }

  return androidManifest;
}

module.exports = function withAndroidExternalAppQueries(config) {
  return withAndroidManifest(config, (cfg) => {
    cfg.modResults = mergeExternalAppQueries(cfg.modResults);
    return cfg;
  });
};
