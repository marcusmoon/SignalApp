export const i18n = {
  ko: {
    navDashboard: '대시보드',
    navMonitoring: '수집 현황',
    navErrors: '오류 로그',
    navJobs: '스케줄 관리',
    navNews: '뉴스 목록',
    navYoutube: '유튜브 관리',
    navCalendar: '투자 캘린더',
    navConcalls: '컨콜 요약',
    navTranslations: '번역 설정',
    navSettingsKeys: 'Provider 키관리',
    navSettingsTheme: '테마',
    navSettingsLists: '마켓 리스트',
    navSettingsDanger: '데이터 초기화',
    login: 'Login',
    jobInfo: 'Job 정보',
    jobRuns: 'Job 로그',
  },
  en: {
    navDashboard: 'Dashboard',
    navMonitoring: 'Monitoring',
    navErrors: 'Errors',
    navJobs: 'Jobs',
    navNews: 'News',
    navYoutube: 'YouTube',
    navCalendar: 'Calendar',
    navConcalls: 'Concall',
    navTranslations: 'Translation',
    navSettingsKeys: 'Provider Keys',
    navSettingsTheme: 'Theme',
    navSettingsLists: 'Market Lists',
    navSettingsDanger: 'Data Reset',
    login: 'Login',
    jobInfo: 'Job Info',
    jobRuns: 'Job Logs',
  },
  ja: {
    navDashboard: 'ダッシュボード',
    navMonitoring: '収集状況',
    navErrors: 'エラーログ',
    navJobs: 'Job 管理',
    navNews: 'ニュース管理',
    navYoutube: 'YouTube 管理',
    navCalendar: '投資カレンダー',
    navConcalls: 'コンコール要約',
    navTranslations: '翻訳設定',
    navSettingsKeys: 'プロバイダーキー管理',
    navSettingsTheme: 'テーマ',
    navSettingsLists: 'マーケットリスト',
    navSettingsDanger: 'データ初期化',
    login: 'Login',
    jobInfo: 'Job 情報',
    jobRuns: 'Job ログ',
  },
};

export function textFor(key) {
  const lang = localStorage.getItem('signalAdminLanguage') || 'ko';
  return i18n[lang]?.[key] || i18n.ko[key] || key;
}

export function applyAdminLanguage() {
  // Map labels by view id instead of DOM order (order changed by IA refactor).
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
}
