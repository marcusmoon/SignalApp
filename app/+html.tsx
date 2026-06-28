import { ScrollViewStyleReset } from 'expo-router/html';

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

        {/* 
          Disable body scrolling on web. This makes ScrollView components work closer to how they do on native. 
          However, body scrolling is often nice to have for mobile web. If you want to enable it, remove this line.
        */}
        <ScrollViewStyleReset />

        {/* Keep the document background aligned with the persisted app theme before React hydrates. */}
        <script dangerouslySetInnerHTML={{ __html: initialThemeScript }} />
        <style dangerouslySetInnerHTML={{ __html: responsiveBackground }} />
        {/* Add any additional <head> elements that you want globally available on web... */}
      </head>
      <body>{children}</body>
    </html>
  );
}

const initialThemeScript = `
(function () {
  try {
    var stored =
      window.localStorage.getItem('AsyncStorage:@signal/theme_appearance_mode_v1') ||
      window.localStorage.getItem('@signal/theme_appearance_mode_v1') ||
      '';
    var mode = String(stored).replace(/^"|"$/g, '');
    var systemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    var scheme = mode === 'dark' || (mode !== 'light' && systemDark) ? 'dark' : 'light';
    var bg = scheme === 'dark' ? '#090A0F' : '#F7F8FA';
    document.documentElement.dataset.signalTheme = scheme;
    document.documentElement.style.backgroundColor = bg;
    if (document.body) document.body.style.backgroundColor = bg;
  } catch (e) {}
})();
`;

const responsiveBackground = `
html,
body,
#root {
  height: 100%;
  min-height: 100%;
  background-color: #F7F8FA;
}

body {
  background-color: #F7F8FA;
}

html[data-signal-theme="dark"],
html[data-signal-theme="dark"] body,
html[data-signal-theme="dark"] #root {
  background-color: #090A0F;
}
@media (prefers-color-scheme: dark) {
  html:not([data-signal-theme]),
  html:not([data-signal-theme]) body,
  html:not([data-signal-theme]) #root {
    background-color: #090A0F;
  }
}`;
