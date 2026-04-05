/** @type {import('@babel/core').TransformOptions} */
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // 반드시 마지막 — 릴리스(iOS)에서 Reanimated 워크렛 미적용 시 크래시 방지
    plugins: ['react-native-reanimated/plugin'],
  };
};
