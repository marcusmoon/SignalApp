import { ScrollViewStyleReset } from 'expo-router/html';

import {
  themeBackgroundForScheme,
  WEB_THEME_APPEARANCE_KEYS,
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

        {/* 
          Disable body scrolling on web. This makes ScrollView components work closer to how they do on native. 
          However, body scrolling is often nice to have for mobile web. If you want to enable it, remove this line.
        */}
        <ScrollViewStyleReset />

        {/* Keep the document background aligned with the persisted app theme before React hydrates. */}
        <script dangerouslySetInnerHTML={{ __html: initialThemeScript }} />
        <style dangerouslySetInnerHTML={{ __html: responsiveBackground }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

const storageKeysJson = JSON.stringify(WEB_THEME_APPEARANCE_KEYS);
const lightBg = themeBackgroundForScheme('light');
const darkBg = themeBackgroundForScheme('dark');

const initialThemeScript = `
(function () {
  try {
    var keys = ${storageKeysJson};
    var stored = '';
    for (var i = 0; i < keys.length; i++) {
      var value = window.localStorage.getItem(keys[i]);
      if (value) { stored = value; break; }
    }
    var mode = String(stored).replace(/^"|"$/g, '');
    var systemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    var scheme = mode === 'dark' || (mode !== 'light' && systemDark) ? 'dark' : 'light';
    var bg = scheme === 'dark' ? ${JSON.stringify(darkBg)} : ${JSON.stringify(lightBg)};
    document.documentElement.dataset.signalTheme = scheme;
    document.documentElement.style.colorScheme = scheme;
    document.documentElement.style.backgroundColor = bg;
    if (document.body) document.body.style.backgroundColor = bg;
    var root = document.getElementById('root');
    if (root) root.style.backgroundColor = bg;
  } catch (e) {}
})();
`;

const responsiveBackground = `
html {
  height: 100%;
  color-scheme: light dark;
}

body {
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

#root {
  display: flex;
  flex: 1;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

/* Tab navigators must fill height so inner lists get a bounded scroll viewport on web. */
#root > div {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  height: 100%;
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
  z-index: 2147483000 !important;
  pointer-events: auto !important;
  transform: translateZ(0);
}

[data-signal-floating-fab="true"] {
  position: fixed !important;
  right: max(16px, env(safe-area-inset-right)) !important;
  bottom: calc(max(10px, env(safe-area-inset-bottom)) + 92px) !important;
  z-index: 2147483001 !important;
  pointer-events: auto !important;
  touch-action: manipulation;
  transform: translateZ(0);
}

html[data-signal-theme="light"],
html[data-signal-theme="light"] body,
html[data-signal-theme="light"] #root {
  background-color: ${lightBg};
}

html[data-signal-theme="dark"],
html[data-signal-theme="dark"] body,
html[data-signal-theme="dark"] #root {
  background-color: ${darkBg};
}

@media (prefers-color-scheme: dark) {
  html:not([data-signal-theme]),
  html:not([data-signal-theme]) body,
  html:not([data-signal-theme]) #root {
    background-color: ${darkBg};
  }
}

@media (prefers-color-scheme: light) {
  html:not([data-signal-theme]),
  html:not([data-signal-theme]) body,
  html:not([data-signal-theme]) #root {
    background-color: ${lightBg};
  }
}
`;
