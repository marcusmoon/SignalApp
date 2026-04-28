import { baseKo } from './i18n/ko.js';
import { baseEn } from './i18n/en.js';
import { baseJa } from './i18n/ja.js';

export const i18n = {
  ko: baseKo,
  en: baseEn,
  ja: baseJa,
};

export function textFor(key) {
  const lang = localStorage.getItem('signalAdminLanguage') || 'ko';
  return i18n[lang]?.[key] || i18n.ko[key] || key;
}

/** Replace `{{name}}` placeholders (same pattern as app locales). */
export function textForVars(key, vars = {}) {
  let s = textFor(key);
  for (const [k, v] of Object.entries(vars)) {
    s = s.split(`{{${k}}}`).join(String(v));
  }
  return s;
}

export function applyAdminLanguage() {
  const viewLabelKey = {
    dashboard: 'navDashboard',
    monitoring: 'navMonitoring',
    errors: 'navErrors',
    jobs: 'navJobs',
    news: 'navNews',
    youtube: 'navYoutube',
    calendar: 'navCalendar',
    concalls: 'navConcalls',
    translations: 'navTranslations',
    'settings-keys': 'navSettingsKeys',
    'settings-theme': 'navSettingsTheme',
    'settings-lists': 'navSettingsLists',
    'settings-sources': 'navSettingsSources',
    'settings-danger': 'navSettingsDanger',
  };
  document.querySelectorAll('[data-view]').forEach((btn) => {
    const view = btn.getAttribute('data-view');
    const key = view ? viewLabelKey[view] : null;
    if (key) btn.textContent = textFor(key);
  });
  const jobTabs = document.querySelectorAll('[data-job-tab]');
  if (jobTabs[0]) jobTabs[0].textContent = textFor('jobInfo');
  if (jobTabs[1]) jobTabs[1].textContent = textFor('jobRuns');

  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (!key) return;
    el.textContent = textFor(key);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (!key) return;
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) el.placeholder = textFor(key);
  });
  document.querySelectorAll('[data-i18n-title]').forEach((el) => {
    const key = el.getAttribute('data-i18n-title');
    if (!key) return;
    const label = textFor(key);
    el.title = label;
    if (el instanceof HTMLButtonElement) el.setAttribute('aria-label', label);
  });
  document.querySelectorAll('option[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (!key) return;
    el.textContent = textFor(key);
  });
  document.querySelectorAll('[data-i18n-aria-label]').forEach((el) => {
    const key = el.getAttribute('data-i18n-aria-label');
    if (!key) return;
    el.setAttribute('aria-label', textFor(key));
  });
  const globalSearch = document.getElementById('globalSearchInput');
  if (globalSearch instanceof HTMLInputElement) globalSearch.placeholder = textFor('headerSearchPh');
}

