import { $ } from './state.js';

export const themePresets = [
  ['green', '#00C087'],
  ['red', '#FF4D6D'],
  ['blue', '#3B82F6'],
  ['yellow', '#EAB308'],
  ['orange', '#F97316'],
  ['purple', '#A855F7'],
  ['cyan', '#06B6D4'],
  ['teal', '#14B8A6'],
  ['pink', '#EC4899'],
  ['lime', '#84CC16'],
  ['indigo', '#6366F1'],
  ['rose', '#F43F5E'],
];

function withAlpha(hex, alphaHex) {
  return `${hex}${alphaHex}`;
}

export function applyTheme(id) {
  const preset = themePresets.find(([key]) => key === id) || themePresets[0];
  const [, hex] = preset;
  document.documentElement.style.setProperty('--accent', hex);
  document.documentElement.style.setProperty('--accent-dim', withAlpha(hex, '18'));
  document.documentElement.style.setProperty('--accent-border', withAlpha(hex, '55'));
  localStorage.setItem('signalAdminAccent', id);
  renderThemeOptions();
}

export function renderThemeOptions() {
  const current = localStorage.getItem('signalAdminAccent') || 'green';
  if (!$('themeOptions')) return;
  $('themeOptions').innerHTML = themePresets.map(([id, hex]) => `
    <button class="swatchBtn ${current === id ? 'active' : ''}" data-theme="${id}">
      <span class="swatchDot" style="background:${hex}"></span>
      <span>${id}</span>
    </button>
  `).join('');
}
