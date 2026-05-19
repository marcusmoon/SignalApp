import { $ } from './state.js';

export const themePresets = [
  ['light', '#3182F6'],
  ['dark', '#60A5FA'],
];

export function applyTheme(id) {
  const normalized = id === 'dark' ? 'dark' : 'light';
  const preset = themePresets.find(([key]) => key === normalized) || themePresets[0];
  const [, hex] = preset;
  document.documentElement.style.setProperty('--accent', hex);
  document.body?.setAttribute('data-admin-theme', normalized);
  localStorage.setItem('signalAdminTheme', normalized);
  localStorage.removeItem('signalAdminAccent');
  renderThemeOptions();
}

export function renderThemeOptions() {
  const current = localStorage.getItem('signalAdminTheme') || 'light';
  if (!$('themeOptions')) return;
  $('themeOptions').innerHTML = themePresets.map(([id, hex]) => `
    <button class="swatchBtn ${current === id ? 'active' : ''}" data-theme="${id}">
      <span class="swatchDot" style="background:${hex}"></span>
      <span>${id}</span>
    </button>
  `).join('');
}
