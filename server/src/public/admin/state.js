export const $ = (id) => document.getElementById(id);

export const state = {
  view: 'dashboard',
  settingsTab: 'keys',
  operationFilter: 'all',
  dashboardOperationFilter: 'all',
  dashboardSort: 'newest',
  uiModelPresets: null,
  providerSettings: [],
  openModelPresetsOnTranslations: false,
  newsPage: 1,
  newsTotalPages: 1,
  newsTotal: 0,
  youtubePage: 1,
  youtubeTotalPages: 1,
  youtubeTotal: 0,
  calendarPage: 1,
  calendarTotalPages: 1,
  calendarTotal: 0,
  jobRunsPage: 1,
  jobRunsTotalPages: 1,
  jobRunsTotal: 0,
  jobRunsSortKey: 'finishedAt',
  jobRunsSortDir: 'desc', // asc|desc
  jobRunsSelected: [],
  jobs: [],
  jobTab: 'info',
  jobListEnabled: 'all', // all|enabled|disabled
  jobListDomain: 'all',
  jobListProvider: 'all',
  jobListQuery: '',
  jobListSort: 'name', // name|lastRunDesc|intervalAsc
  marketLists: [],
  marketListDraft: null,
};
