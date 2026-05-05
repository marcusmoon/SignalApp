export const $ = (id) => document.getElementById(id);

export const state = {
  view: 'dashboard',
  settingsTab: 'keys',
  operationFilter: 'all',
  dashboardOperationFilter: 'latest',
  dashboardLimit: 5,
  monitoringSort: 'newest',
  uiModelPresets: null,
  providerSettings: [],
  adminUsers: [],
  appSettings: null,
  openModelPresetsOnTranslations: false,
  newsPage: 1,
  newsTotalPages: 1,
  newsTotal: 0,
  newsRows: [],
  newsEditItemId: '',
  newsEditLocale: 'en',
  youtubePage: 1,
  youtubeTotalPages: 1,
  youtubeTotal: 0,
  calendarPage: 1,
  calendarTotalPages: 1,
  calendarTotal: 0,
  /** `YYYY-MM` for admin month calendar */
  calendarMonthYm: '',
  /** `YYYY-MM-DD` selected day in month view */
  calendarSelectedYmd: '',
  /** Full rows for visible month (client-side day filter) */
  calendarMonthRows: [],
  jobRunsPage: 1,
  jobRunsTotalPages: 1,
  jobRunsTotal: 0,
  jobRunsSortKey: 'finishedAt',
  jobRunsSortDir: 'desc', // asc|desc
  jobRunsSelected: [], // job run row keys (prefer run.id)
  jobRunsLastRows: [],
  errorRows: [],
  jobs: [],
  jobTab: 'info',
  jobListEnabled: 'all', // all|enabled|disabled
  jobListDomain: 'all',
  jobListProvider: 'all',
  jobListQuery: '',
  jobListSort: 'name', // name|lastRunDesc|intervalAsc
  marketLists: [],
  marketListDraft: null,
  newsSourceAliasDraft: null,
  newsSources: [],
  newsSourceDraftRows: [''],
  newsSourcesCategory: 'global',
  newsSourcesShowHidden: false,
  newsSourceSettings: {
    autoEnableNewSources: { global: true, crypto: true },
    aliases: { global: {}, crypto: {} },
  },
};
