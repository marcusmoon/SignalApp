import { ScrollViewStyleReset } from 'expo-router/html';

import {
  themeTokensForScheme,
  themeBackgroundForScheme,
  WEB_THEME_APPEARANCE_KEYS,
  WEB_THEME_EFFECTIVE_SCHEME_KEY,
} from '@/utils/webThemeDocument';

// This file is web-only and used to configure the root HTML for every
// web page during static rendering.
// The contents of this function only run in Node.js environments and
// do not have access to the DOM or browser APIs.
export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <meta name="color-scheme" content="light dark" />
        <meta name="theme-color" content={darkBg} />

        <script dangerouslySetInnerHTML={{ __html: initialThemeScript }} />

        {/* 
          Disable body scrolling on web. This makes ScrollView components work closer to how they do on native. 
          However, body scrolling is often nice to have for mobile web. If you want to enable it, remove this line.
        */}
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: responsiveBackground }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

const storageKeysJson = JSON.stringify(WEB_THEME_APPEARANCE_KEYS);
const lightBg = themeBackgroundForScheme('light');
const darkBg = themeBackgroundForScheme('dark');
const lightTokens = themeTokensForScheme('light');
const darkTokens = themeTokensForScheme('dark');

const initialThemeScript = `
(function () {
  function applySignalTheme() {
    try {
      var effectiveKey = ${JSON.stringify(WEB_THEME_EFFECTIVE_SCHEME_KEY)};
      var keys = ${storageKeysJson};
      var stored = '';
      for (var i = 0; i < keys.length; i++) {
        var value = window.localStorage.getItem(keys[i]);
        if (!value) continue;
        var candidate = String(value).trim().replace(/^"|"$/g, '');
        if (candidate === 'light' || candidate === 'dark' || candidate === 'system') {
          stored = candidate;
          break;
        }
      }
      var mode = stored || 'system';
      var scheme = mode === 'light' ? 'light' : 'dark';
      try { window.localStorage.setItem(effectiveKey, scheme); } catch (e) {}
      var bg = scheme === 'dark' ? ${JSON.stringify(darkBg)} : ${JSON.stringify(lightBg)};
      var tokens = scheme === 'dark' ? ${JSON.stringify(darkTokens)} : ${JSON.stringify(lightTokens)};
      document.documentElement.dataset.signalTheme = scheme;
      document.documentElement.style.colorScheme = scheme;
      document.documentElement.style.backgroundColor = bg;
      var themeColorMeta = document.querySelector('meta[name="theme-color"]');
      if (themeColorMeta) themeColorMeta.setAttribute('content', bg);
      document.documentElement.style.setProperty('--signal-bg', tokens.bg);
      document.documentElement.style.setProperty('--signal-bg-elevated', tokens.bgElevated);
      document.documentElement.style.setProperty('--signal-card', tokens.card);
      document.documentElement.style.setProperty('--signal-border', tokens.border);
      document.documentElement.style.setProperty('--signal-text', tokens.text);
      document.documentElement.style.setProperty('--signal-text-muted', tokens.textMuted);
      document.documentElement.style.setProperty('--signal-text-dim', tokens.textDim);
      document.documentElement.style.setProperty('--signal-green', tokens.green);
      document.documentElement.style.setProperty('--signal-green-dim', tokens.greenDim);
      document.documentElement.style.setProperty('--signal-green-border', tokens.greenBorder);
    if (document.body) document.body.style.backgroundColor = bg;
    var root = document.getElementById('root');
    if (root) {
      root.style.backgroundColor = bg;
      var shell = root.firstElementChild;
      if (shell instanceof HTMLElement) {
        shell.style.backgroundColor = bg;
        if (shell.firstElementChild instanceof HTMLElement) {
          shell.firstElementChild.style.backgroundColor = bg;
        }
      }
    }
    } catch (e) {}
  }
  applySignalTheme();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applySignalTheme);
  }
})();
`;

const responsiveBackground = `
html {
  height: 100%;
  color-scheme: light dark;
  --signal-bg: ${darkBg};
  --signal-bg-elevated: ${darkTokens.bgElevated};
  --signal-card: ${darkTokens.card};
  --signal-border: ${darkTokens.border};
  --signal-text: ${darkTokens.text};
  --signal-text-muted: ${darkTokens.textMuted};
  --signal-text-dim: ${darkTokens.textDim};
  --signal-green: ${darkTokens.green};
  --signal-green-dim: ${darkTokens.greenDim};
  --signal-green-border: ${darkTokens.greenBorder};
}

body {
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background-color: var(--signal-bg);
}

#root {
  display: flex;
  flex: 1;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background-color: var(--signal-bg);
}

/* Tab navigators must fill height so inner lists get a bounded scroll viewport on web. */
#root > div {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  background-color: var(--signal-bg);
}

#root > div > div {
  background-color: var(--signal-bg);
}

/* Hide scrollbars on horizontal card carousels (navigation uses overlay arrows). */
[data-signal-horizontal-carousel="true"] {
  scrollbar-width: none;
  -ms-overflow-style: none;
}
[data-signal-horizontal-carousel="true"]::-webkit-scrollbar {
  display: none;
}

/* Mobile Safari can miss RN Web's initial fixed/absolute measurements until resize.
   Keep floating navigation controls in a CSS-owned fixed layer from first paint. */
[data-signal-floating-tabbar="true"] {
  position: fixed !important;
  left: max(16px, env(safe-area-inset-left)) !important;
  right: max(16px, env(safe-area-inset-right)) !important;
  bottom: max(10px, env(safe-area-inset-bottom)) !important;
  width: auto !important;
  background-color: var(--signal-card) !important;
  border: 1px solid var(--signal-border) !important;
  color: var(--signal-text-muted) !important;
  z-index: 2147483000 !important;
  pointer-events: auto !important;
  transform: translateZ(0);
}

[data-signal-floating-fab="true"] {
  position: fixed !important;
  right: max(16px, env(safe-area-inset-right)) !important;
  bottom: calc(max(10px, env(safe-area-inset-bottom)) + 92px) !important;
  background-color: var(--signal-card) !important;
  border: 1px solid var(--signal-border) !important;
  color: var(--signal-green) !important;
  z-index: 2147483001 !important;
  pointer-events: auto !important;
  touch-action: manipulation;
  transform: translateZ(0);
}

html[data-signal-theme="light"] {
  --signal-bg: ${lightBg};
  --signal-bg-elevated: ${lightTokens.bgElevated};
  --signal-card: ${lightTokens.card};
  --signal-border: ${lightTokens.border};
  --signal-text: ${lightTokens.text};
  --signal-text-muted: ${lightTokens.textMuted};
  --signal-text-dim: ${lightTokens.textDim};
  --signal-green: ${lightTokens.green};
  --signal-green-dim: ${lightTokens.greenDim};
  --signal-green-border: ${lightTokens.greenBorder};
}
`;
