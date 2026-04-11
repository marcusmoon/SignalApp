/** Supported UI languages */
export type AppLocale = 'ko' | 'en' | 'ja';

/** Interpolate {{name}} in strings */
export function formatMessage(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  let out = template;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
  }
  return out;
}

const ko = {
  commonBack: '뒤로',
  commonCancel: '취소',
  commonAdd: '추가',
  commonLoading: '불러오는 중…',

  tabNews: '뉴스',
  tabYoutube: '유튜브',
  tabQuotes: '시세',
  tabCalls: '컨콜',

  screenSettings: '설정',
  screenAlerts: '알림',
  screenCalendar: '투자 캘린더',
  calendarScreenHint: 'Finnhub 실적 · 경제지표 (무료 플랜은 일부 비어 있을 수 있음)',
  calendarScreenMonthHeading: '이 달 일정',
  calendarScreenEmptyMonth: '이 달에 표시할 일정이 없습니다.',
  calendarScreenSectionTitle: '이 날의 일정',
  calendarScreenEmptyDay: '이 날짜에 일정이 없습니다.',
  calendarMonthPrevA11y: '이전 달',
  calendarMonthNextA11y: '다음 달',
  calendarTagEarnings: '실적',
  calendarTagFomc: 'FOMC',
  calendarTagFed: '연준',
  calendarTagMacro: '지표',
  screenInfo: '정보',
  screenMegaCapList: '메가캡 티커 목록',
  screenMegaCapListLead:
    '캘린더·컨콜에서 「메가캡」을 선택했을 때 실적 후보에 사용하는 티커입니다. 시총 상위권에 가까운 미국 대형주를 앱에서 큐레이션한 목록이며, 투자 권유가 아닙니다.',
  screenMegaCapListCount: '총 {{count}}개',
  settingsMegaCapListLink: '메가캡 티커 목록 보기',

  settingsCacheSectionTitle: '캐시',
  settingsCacheOneLiner:
    '뉴스 {{news}}분 · 유튜브 {{yt}}분 · 시세 약 {{qt}}초 · 컨콜 {{cc}}분 · 캘린더 {{cal}}분 · 끄면 매번 새로 불러옴',
  settingsCacheClearButton: '모두 비우기',
  settingsCacheClearedTitle: '캐시',
  settingsCacheClearedBody: '뉴스·유튜브·시세·컨콜·캘린더 메모리 캐시를 비웠습니다.',
  settingsCacheYoutubeToggle: '유튜브',
  settingsCacheConcallToggle: '컨콜',
  settingsCacheCalendarToggle: '캘린더',
  settingsCacheQuotesToggle: '시세',
  settingsCacheNewsToggle: '뉴스',
  settingsLlmProviderKicker: 'AI 요약',
  settingsLlmProviderHint:
    '뉴스·유튜브·컨콜 요약에 사용합니다. 선택한 제공자의 API 키가 .env(EXPO_PUBLIC_*)에 있어야 합니다.',
  settingsLlmProviderClaude: 'Claude (Anthropic)',
  settingsLlmProviderOpenai: 'ChatGPT (OpenAI)',
  settingsLlmProviderUnavailable: '키 없음',
  settingsLlmProviderDisabledNote: 'API 키가 없는 제공자는 비활성화됩니다.',


  headerTagline: '노이즈는 걸러내고, 진짜 시그널만',
  a11yAlerts: '알림',
  a11yCalendar: '투자 캘린더',
  a11ySettings: '설정',
  a11yNewsFilter: '뉴스 제공사 필터 열기',
  a11yCallsFilter: '컨콜 관심종목 필터 열기',

  otaUpdateAvailable: '새 화면이 준비되었습니다. 적용하면 최신 JS 번들로 다시 시작합니다.',
  otaUpdateApply: '업데이트',
  otaUpdateDismiss: '나중에',
  otaUpdateErrorTitle: '업데이트',
  otaUpdateErrorBody: '다운로드에 실패했습니다. 네트워크를 확인한 뒤 다시 시도해 주세요.',
  otaUpdatePreviewMessage: '[미리보기] 새 화면이 준비되었습니다. (실제 OTA 아님)',
  otaUpdatePreviewTitle: '미리보기',
  otaUpdatePreviewBody: '실제 OTA가 아닙니다. 배너 모양만 확인한 것입니다.',

  settingsTabYoutube: '유튜브',
  settingsTabNews: '뉴스',
  settingsTabQuotes: '시세',
  settingsTabDisplay: '표시',
  settingsTabCalendar: '캘린더',
  settingsTabNotifications: '알림',

  settingsDeveloperFooterLine: 'Marcus · LinkedIn',
  settingsDeveloperLinkedInA11y: 'Marcus LinkedIn 프로필 열기',

  settingsYoutubeLead:
    '경제 유튜브 탭의 큐레이션 채널 목록입니다. 기본으로 아래 핸들이 포함되어 있으며, 원하는 채널을 추가하거나 삭제할 수 있습니다.',
  settingsYoutubeSectionAdd: '채널 추가',
  settingsYoutubeHintHandle: 'YouTube @핸들 (예: 채널 URL의 @뒤 이름)',
  settingsYoutubePlaceholderHandle: '핸들 입력',
  settingsYoutubeDefaultCuration: '기본 큐레이션 (앱 제공)',
  settingsYoutubeCurrentList: '현재 목록 ({{count}})',
  settingsYoutubeReset: '기본 큐레이션으로 초기화',

  youtubeErrorKeyMissing:
    'EXPO_PUBLIC_YOUTUBE_API_KEY가 필요합니다. Google Cloud에서 YouTube Data API v3를 활성화한 뒤 키를 .env에 넣고 Metro를 재시작하세요.',
  youtubeErrorSelectChannel: '채널을 1개 이상 선택해 주세요.',
  youtubeErrorQuota:
    'YouTube Data API 일일 쿼터가 소진되었습니다(태평양 자정 기준으로 갱신). Google Cloud 콘솔에서 사용량을 확인하거나, 새 프로젝트·키로 나누거나, 내일 다시 시도해 주세요.',
  youtubeErrorQuotaResetHint:
    '다음 일일 한도 갱신까지 약 {{hours}}시간 {{minutes}}분 (태평양 자정 기준).',
  youtubeErrorQuotaResetImminent: '곧 일일 한도가 갱신될 수 있습니다(태평양 자정).',
  youtubeErrorQuotaConsoleLink: 'Google Cloud에서 쿼터 확인',
  youtubeErrorLoad: '유튜브를 불러오지 못했습니다.',
  youtubeErrorRefresh: '새로고침 실패',

  settingsQuotesLead: '시세 탭 「관심」에 쓰는 미국 주식 티커입니다. 이 기기에 저장됩니다.',
  settingsQuotesSectionAdd: '티커 추가',
  settingsQuotesHintTicker: '미국 티커 (예: AAPL, SPY)',
  settingsQuotesPlaceholderTicker: '티커 입력',
  settingsQuotesDefaultWatchlist: '기본 관심 종목 (앱 제공)',
  settingsQuotesCurrentList: '현재 목록 ({{count}})',
  settingsQuotesReset: '초기화',
  settingsQuotesLimitsKicker: '개수',
  settingsQuotesWatchKicker: '관심 종목',
  settingsQuotesListLimitsHint:
    '인기·시총·코인 모두 10~100까지 10개 단위로 선택합니다(기본 20). 시총은 유니버스 길이 이하만 표시됩니다. 상한: 인기 {{popMax}} · 시총 {{mcapMax}} · 코인 {{coinMax}}.',
  settingsQuotesPopularCountLabel: '인기순',
  settingsQuotesMcapCountLabel: '시총순',
  settingsQuotesCoinCountLabel: '코인',
  settingsQuotesSegmentOrderKicker: '순서',
  settingsQuotesSegmentOrderHint:
    '실시간 시세 화면 상단의 관심·인기순·시총순·코인 순서입니다. 오른쪽 ≡을 드래그해 바꿉니다.',
  settingsQuotesSegmentDragHandleA11y: '{{name}} 순서 바꾸기(드래그)',

  settingsThemeLead:
    '표시 설정에서 언어와 앱 테마(강조색)를 바꿀 수 있습니다. 언어는 즉시 저장되며, 테마 색은 탭·버튼·새로고침 등에 적용됩니다.',
  settingsThemeAccentSection: '테마',
  settingsThemeLanguageSection: '언어',
  settingsTabBarGlassKicker: '앱 글래스',
  settingsTabBarGlassHint:
    '가로 막대의 세로 손잡이를 드래그해 조절합니다. 오른쪽일수록 진하고 왼쪽일수록 투명합니다. 아래 미리보기는 적용 예시입니다. 변경 시 즉시 반영됩니다.',
  settingsTabBarGlassA11y: '앱 글래스 강도 {{percent}}퍼센트',
  settingsTabBarGlassPreviewKicker: '적용 예시',
  settingsDisplayPreviewLabel: '미리보기',
  settingsDisplaySelectedTheme: '선택: {{name}}',

  settingsNewsTabLead: '뉴스 화면에서 쓰는 옵션입니다. 이 기기에만 저장됩니다.',
  settingsNewsSegmentOrderKicker: '뉴스 탭 순서',
  settingsNewsSegmentOrderHint:
    '뉴스 화면 상단의 글로벌·코인·한국 순서입니다. 오른쪽 ≡을 드래그해 바꿉니다.',
  settingsNewsSegmentDragHandleA11y: '{{name}} 순서 바꾸기(드래그)',
  settingsNewsKoreaKeywordsKicker: '한국 뉴스 키워드',
  settingsNewsKoreaKeywordsLead:
    '한국 탭은 Finnhub 일반·FX 뉴스를 제목·요약·관련 심볼에서 키워드로 거릅니다. 처음 실행 시 아래 목록에 앱 기본 키워드가 채워지며, 내장 정규식과 함께 OR로 적용됩니다. 삭제·추가로 조정할 수 있습니다.',
  settingsNewsKoreaKeywordsHint: '한 줄에 하나씩 · 제목·요약·관련 심볼에 부분 일치(대소문자 무시)',
  settingsNewsKoreaKeywordsPlaceholder: '예: NH투자증권, 한화에어로',
  settingsNewsKoreaKeywordsReset: '추가 키워드 모두 지우기',
  settingsNewsKoreaKeywordsRestoreDefaults: '기본 키워드로 채우기',
  settingsNewsKoreaKeywordsRestoreConfirmBody: '현재 키워드 목록을 앱 기본값으로 덮어씁니다.',
  settingsNewsKoreaKeywordsResetConfirmBody: '등록한 추가 키워드를 모두 삭제합니다. (앱 기본 키워드는 유지됩니다)',
  alertEmptyKoreaKeyword: '키워드를 입력해 주세요.',

  settingsCalendarScopeTitle: '캘린더 · 컨콜',
  settingsCalendarTabLead: '캘린더·컨콜 화면의 실적 행 범위를 정합니다.',
  settingsCalendarScopeLead:
    '실적(earnings) 행은 메가캡 유니버스로 볼지, 시세·설정의 관심종목으로 볼지 선택합니다. 경제지표·매크로 일정은 항상 전체로 표시됩니다.',
  settingsScopeMega: '메가캡',
  settingsScopeWatch: '관심종목',

  settingsNotificationsLead:
    '푸시 알림 수신과 실적 알림만 받기를 설정합니다. Firebase FCM 연동 후 기기로 전송됩니다.',
  settingsPushEnabled: '푸시 알림',
  settingsEarningsOnly: '실적 알림만',

  alertsListHint: '하루 최대 10건 · HIGH만 즉시 (PRD)',
  alertsEmpty: '수신한 알림이 없습니다. FCM 연동 후 푸시가 오면 여기에 표시됩니다.',
  alertsOpenSettings: '알림 설정',

  localeNameKo: '한국어',
  localeNameEn: 'English',
  localeNameJa: '日本語',

  accentGreen: '녹색',
  accentRed: '붉은색',
  accentBlue: '파란색',
  accentYellow: '노란색',
  accentOrange: '주황색',
  accentPurple: '보라색',
  accentCyan: '시안',
  accentTeal: '틸',
  accentPink: '핑크',
  accentLime: '라임',
  accentIndigo: '인디고',
  accentRose: '로즈',
  accentCustom: '커스텀',

  settingsAccentCustomModalTitle: '커스텀 강조색',
  settingsAccentPaletteHint:
    '흰·빨·주·노·초·파·남·보 열마다 위가 밝고 아래로 갈수록 어두워집니다. 고른 뒤 적용을 누르세요.',
  settingsAccentApply: '적용',

  alertTitleInputError: '입력 오류',
  alertEmptyHandle: '채널 핸들을 입력해 주세요.',
  alertTitleFormatError: '형식 오류',
  alertYoutubeHandleRule: '영문·숫자·._- 만 사용할 수 있습니다. @는 생략해도 됩니다.',
  alertTitleDup: '중복',
  alertDupHandle: '이미 목록에 있는 핸들입니다.',
  alertDupKoreaKeyword: '이미 추가된 키워드입니다.',
  alertTitleMinOne: '최소 1개',
  alertMinChannel: '큐레이션 채널은 최소 1개 이상 유지해야 합니다.',
  alertMinNewsSource: '뉴스 제공사는 최소 1개 이상 선택해야 합니다.',
  alertResetCurationTitle: '기본값으로 초기화',
  alertResetCurationBody: '앱에서 제공하는 기본 큐레이션 채널 목록으로 되돌립니다. 계속할까요?',
  alertResetWatchTitle: '관심 목록',
  alertResetWatchBody: '앱 기본 티커로 되돌립니다. 계속할까요?',
  alertReset: '초기화',
  alertEmptyTicker: '티커를 입력해 주세요.',
  alertTickerRule: '영문·숫자·.(점)·-(하이픈) 조합만 사용할 수 있습니다.',
  alertDupTicker: '이미 목록에 있는 티커입니다.',

  feedSectionTitle: '실시간 뉴스',
  feedSegmentGlobal: '글로벌',
  feedSegmentKorea: '한국',
  feedSegmentCrypto: '코인',
  feedHint:
    '상단: 글로벌(Finnhub general) · 코인(Finnhub crypto) · 한국(일반+FX 풀에서 키워드 필터) · 한국어 번역/3줄 요약(Claude 또는 ChatGPT) · 우하단 필터로 출처',
  feedEmptyKorea:
    '한국 관련 키워드가 포함된 기사가 없습니다. 글로벌 탭을 보거나 잠시 후 다시 새로고침해 주세요.',
  feedNewsFilterTitle: '뉴스 제공사',
  feedNewsFilterIncluded: '포함 출처',
  feedNewsFilterSelectAll: '전체 선택',
  feedNewsFilterSub: 'Finnhub 최신 응답에 나온 출처 기준 · 탭: 포함 on/off · 최소 1개',
  feedNewsFilterClose: '닫기',
  feedErrorToken:
    'EXPO_PUBLIC_FINNHUB_TOKEN 이 필요합니다. 프로젝트 루트에 .env 를 만들고 토큰을 넣은 뒤 Metro를 재시작하세요.',
  feedErrorLoad: '뉴스를 불러오지 못했습니다.',
  feedErrorRefresh: '새로고침 실패',
  feedEmpty: '표시할 뉴스가 없습니다.',
  feedDisclaimer: '본 앱은 투자 권유가 아닌 정보 제공 목적입니다. AI 요약 오류가 있을 수 있습니다.',

  newsAiClaude: 'Claude AI 요약',
  newsAiOpenai: 'ChatGPT 요약',
  newsAiFinnhub: '원문 요약 (Finnhub)',
  newsReadMore: '원문 보기 →',
  newsSourceLabel: '출처',
  newsFlashBadge: '속보',

  callsSectionTitle: '컨콜 요약',
  callsHint:
    'Finnhub 실적 일정 → 트랜스크립트 → Claude 요약 · 표시 설정에서 실적 범위(메가캡/관심) · 우하단에서 연도·분기 조회',
  callsFiscalYear: '회계연도',
  callsFiscalQuarter: '분기',
  /** 한 줄 콤보 라벨 */
  callsFiscalYearShort: '연도',
  callsFiscalQuarterShort: '분기',
  callsFiscalAll: '전체',
  callsModalFiscalLead:
    '회계연도·분기를 설정한 뒤 조회합니다. 실적 범위(메가캡/관심종목)는 표시 설정에서 바꿀 수 있습니다.',
  callsFilterQuery: '조회',
  callsQuerySummary: '조회 FY{{year}} · {{quarter}}',
  callsQueryScopeSuffixMega: ' · 메가캡',
  callsQueryScopeSuffixWatch: ' · 관심',
  callsFilterTitle: '컨콜 필터',
  callsFilterClose: '닫기',
  callsEmptyWatchFilter: '선택한 기간에 관심종목 실적 일정이 없습니다. 목록을 확인하거나 나중에 다시 보세요.',
  callsEmptyGeneral:
    '표시할 카드가 없습니다. 우하단 필터에서 연도·분기를 바꾼 뒤 조회를 누르거나, 아래 안내 카드를 확인해 주세요.',
  callsEmptyWatchlistEmpty:
    '관심 종목이 없습니다. 시세·설정에서 티커를 추가하거나, 표시 설정에서 메가캡 범위를 선택하세요.',
  callsYahooConcallA11y: '{{symbol}} Yahoo Finance에서 실적·컨콜 보기',
  callsAiProviderClaude: 'Claude AI 요약',
  callsAiProviderOpenai: 'ChatGPT 요약',
  callsAiProviderFallback: '폴백 / 안내',


  quotesSegmentWatch: '관심',
  quotesSegmentPopular: '인기순',
  quotesSegmentMcap: '시총순',
  quotesSegmentCoin: '코인',
  quotesHintCoin: '글로벌 시가총액 기준 상위 코인 (CoinGecko · USD) — 개수는 설정에서 조절',
  quotesFooterCoin:
    '코인은 CoinGecko 공개 API 기준입니다. 시총·가격은 참고용이며 실제 거래와 다를 수 있습니다.',
  quotesPrevRefCoin: '24h 기준가',
  quotesPrevCloseStock: '전일 종',
  quotesWatchSwipeRemove: '삭제',
  quotesNextRefresh: '다음 갱신까지 {{seconds}}초',
  quotesYahooShort: 'Yahoo',
  quotesYahooFinanceA11y: '{{symbol}} Yahoo Finance에서 보기',
  alertTitleUnknownTicker: '티커 없음',
  quotesTickerNotFoundBody:
    'Finnhub에서 해당 티커 시세를 찾을 수 없습니다. 상장 심볼인지 확인해 주세요.',

  modalInfoTitle: 'SIGNAL 정보',
  modalInfoBody:
    '본 앱은 투자 권유·중개가 아닌 정보 제공을 목적으로 합니다. 뉴스 및 컨콜 요약은 Claude AI로 생성되며 오류가 있을 수 있습니다. 투자 결정은 본인 책임 하에 하시기 바랍니다.',
  modalInfoNext: '다음 단계 (PRD)',
  modalInfoNextBody: 'Finnhub 연동 · Claude 요약 파이프라인 · Firebase FCM',
} as const;

const en = {
  commonBack: 'Back',
  commonCancel: 'Cancel',
  commonAdd: 'Add',
  commonLoading: 'Loading…',

  tabNews: 'News',
  tabYoutube: 'YouTube',
  tabQuotes: 'Quotes',
  tabCalls: 'Calls',

  screenSettings: 'Settings',
  screenAlerts: 'Alerts',
  screenCalendar: 'Invest calendar',
  calendarScreenHint: 'Finnhub earnings & economic calendar (free tier may omit some items)',
  calendarScreenMonthHeading: 'This month',
  calendarScreenEmptyMonth: 'No events this month.',
  calendarScreenSectionTitle: 'Events on this day',
  calendarScreenEmptyDay: 'No events on this date.',
  calendarMonthPrevA11y: 'Previous month',
  calendarMonthNextA11y: 'Next month',
  calendarTagEarnings: 'Earnings',
  calendarTagFomc: 'FOMC',
  calendarTagFed: 'Fed',
  calendarTagMacro: 'Macro',
  screenInfo: 'About',
  screenMegaCapList: 'Mega-cap tickers',
  screenMegaCapListLead:
    'Tickers used for earnings rows when Calendar & calls is set to mega-cap. This is an app-curated list of large U.S. names—not investment advice.',
  screenMegaCapListCount: '{{count}} tickers',
  settingsMegaCapListLink: 'View mega-cap ticker list',

  settingsCacheSectionTitle: 'Cache',
  settingsCacheOneLiner:
    'News {{news}} min · YouTube {{yt}} min · Quotes ~{{qt}}s · Calls {{cc}} min · Calendar {{cal}} min · off = fetch every time',
  settingsCacheClearButton: 'Clear all',
  settingsCacheClearedTitle: 'Cache',
  settingsCacheClearedBody: 'News, YouTube, Quotes, Calls, and Calendar memory caches were cleared.',
  settingsCacheYoutubeToggle: 'YouTube',
  settingsCacheConcallToggle: 'Calls',
  settingsCacheCalendarToggle: 'Calendar',
  settingsCacheQuotesToggle: 'Quotes',
  settingsCacheNewsToggle: 'News',

  settingsLlmProviderKicker: 'AI summaries',
  settingsLlmProviderHint:
    'Used for news translation/summaries, YouTube summaries, and earnings-call summaries. Put the selected provider API key in .env (EXPO_PUBLIC_*).',
  settingsLlmProviderClaude: 'Claude (Anthropic)',
  settingsLlmProviderOpenai: 'ChatGPT (OpenAI)',
  settingsLlmProviderUnavailable: 'No key',
  settingsLlmProviderDisabledNote: 'Providers without an API key are shown disabled.',

  headerTagline: 'Cut the noise. Keep the signal.',
  a11yAlerts: 'Alerts',
  a11yCalendar: 'Invest calendar',
  a11ySettings: 'Settings',
  a11yNewsFilter: 'Open news source filter',
  a11yCallsFilter: 'Open earnings call watchlist filter',

  otaUpdateAvailable: 'A new JS bundle is ready. Apply to restart on the latest update.',
  otaUpdateApply: 'Update',
  otaUpdateDismiss: 'Later',
  otaUpdateErrorTitle: 'Update',
  otaUpdateErrorBody: 'Download failed. Check your network and try again.',
  otaUpdatePreviewMessage: '[Preview] A new bundle is ready. (not a real OTA)',
  otaUpdatePreviewTitle: 'Preview',
  otaUpdatePreviewBody: 'This is not a real OTA. You are only previewing the banner UI.',

  settingsTabYoutube: 'YouTube',
  settingsTabNews: 'News',
  settingsTabQuotes: 'Quotes',
  settingsTabDisplay: 'Display',
  settingsTabCalendar: 'Calendar',
  settingsTabNotifications: 'Alerts',

  settingsDeveloperFooterLine: 'Marcus · LinkedIn',
  settingsDeveloperLinkedInA11y: 'Open Marcus LinkedIn profile',

  settingsYoutubeLead:
    'Curated channels for the Economy YouTube tab. Default handles are included below—add or remove as you like.',
  settingsYoutubeSectionAdd: 'Add channel',
  settingsYoutubeHintHandle: 'YouTube @handle (from the channel URL)',
  settingsYoutubePlaceholderHandle: 'Handle',
  settingsYoutubeDefaultCuration: 'Default curation (app)',
  settingsYoutubeCurrentList: 'Current list ({{count}})',
  settingsYoutubeReset: 'Reset to default curation',

  youtubeErrorKeyMissing:
    'EXPO_PUBLIC_YOUTUBE_API_KEY is required. Enable YouTube Data API v3 in Google Cloud, add the key to .env, and restart Metro.',
  youtubeErrorSelectChannel: 'Select at least one channel.',
  youtubeErrorQuota:
    'YouTube Data API daily quota is exhausted (resets at midnight Pacific). Check usage in Google Cloud, use another project/key, or try again tomorrow.',
  youtubeErrorQuotaResetHint:
    'Approx. {{hours}} h {{minutes}} m until the next daily reset (Pacific midnight).',
  youtubeErrorQuotaResetImminent: 'Daily quota may reset very soon (Pacific midnight).',
  youtubeErrorQuotaConsoleLink: 'View quota in Google Cloud',
  youtubeErrorLoad: 'Could not load YouTube.',
  youtubeErrorRefresh: 'Refresh failed',

  settingsQuotesLead: 'US tickers used for the Watch segment on the Quotes tab. Saved on this device.',
  settingsQuotesSectionAdd: 'Add ticker',
  settingsQuotesHintTicker: 'US ticker (e.g. AAPL, SPY)',
  settingsQuotesPlaceholderTicker: 'Ticker',
  settingsQuotesDefaultWatchlist: 'Default watchlist (app)',
  settingsQuotesCurrentList: 'Current list ({{count}})',
  settingsQuotesReset: 'Reset',
  settingsQuotesLimitsKicker: 'Count',
  settingsQuotesWatchKicker: 'WATCHLIST',
  settingsQuotesListLimitsHint:
    'Popular, market cap, and crypto: pick 10–100 in steps of 10 (default 20) from the scroll list. Market cap options are capped by the symbol universe. Max: Popular {{popMax}} · MCap {{mcapMax}} · Crypto {{coinMax}}.',
  settingsQuotesPopularCountLabel: 'Popular',
  settingsQuotesMcapCountLabel: 'Market cap',
  settingsQuotesCoinCountLabel: 'Crypto',
  settingsQuotesSegmentOrderKicker: 'Order',
  settingsQuotesSegmentOrderHint:
    'Order of Watch / Popular / Market cap / Crypto on the Quotes screen. Drag the ≡ handle to reorder.',
  settingsQuotesSegmentDragHandleA11y: 'Reorder {{name}} (drag)',

  settingsThemeLead:
    'In Display, change language and the app theme (accent color). Language saves immediately; theme color applies to tabs, buttons, and refresh controls.',
  settingsThemeAccentSection: 'Theme',
  settingsThemeLanguageSection: 'Language',
  settingsTabBarGlassKicker: 'App glass',
  settingsTabBarGlassHint:
    'Drag the vertical handle on the horizontal track. Right is stronger glass; left is more transparent. The preview below shows how it will look. Changes apply immediately.',
  settingsTabBarGlassA11y: 'App glass strength {{percent}} percent',
  settingsTabBarGlassPreviewKicker: 'Preview',
  settingsDisplayPreviewLabel: 'Preview',
  settingsDisplaySelectedTheme: 'Selected: {{name}}',

  settingsNewsTabLead: 'Options for the News screen. Stored on this device only.',
  settingsNewsSegmentOrderKicker: 'News tab order',
  settingsNewsSegmentOrderHint:
    'Order of Global, Crypto, and Korea on the News screen. Drag the ≡ handle to reorder.',
  settingsNewsSegmentDragHandleA11y: 'Reorder {{name}} (drag)',
  settingsNewsKoreaKeywordsKicker: 'Korea news keywords',
  settingsNewsKoreaKeywordsLead:
    'The Korea tab filters general and FX Finnhub news by headline, summary, and related symbols. On first launch the list is pre-filled with defaults and matched with OR alongside built-in rules. You can edit the list anytime.',
  settingsNewsKoreaKeywordsHint:
    'One per line. Case-insensitive substring match on headline, summary, and related symbols.',
  settingsNewsKoreaKeywordsPlaceholder: 'e.g. NH Investment, Hanwha Aerospace',
  settingsNewsKoreaKeywordsReset: 'Clear added keywords',
  settingsNewsKoreaKeywordsRestoreDefaults: 'Fill with defaults',
  settingsNewsKoreaKeywordsRestoreConfirmBody: 'Replace your keyword list with the app default set.',
  settingsNewsKoreaKeywordsResetConfirmBody:
    'Remove all keywords you added. Built-in keywords stay applied.',
  alertEmptyKoreaKeyword: 'Enter a keyword.',

  settingsCalendarScopeTitle: 'Calendar · calls',
  settingsCalendarTabLead: 'Set how earnings rows are scoped on Calendar and earnings-call screens.',
  settingsCalendarScopeLead:
    'Choose whether earnings rows use the app mega-cap universe or your Quotes/Settings watchlist. Macro/economic events are always shown in full.',
  settingsScopeMega: 'Mega-cap',
  settingsScopeWatch: 'Watchlist',

  settingsNotificationsLead:
    'Control push notifications and earnings-only alerts. Delivered via FCM after Firebase setup.',
  settingsPushEnabled: 'Push notifications',
  settingsEarningsOnly: 'Earnings alerts only',

  alertsListHint: 'Up to 10/day · HIGH immediate (PRD)',
  alertsEmpty: 'No notifications yet. They appear here after FCM delivers pushes.',
  alertsOpenSettings: 'Notification settings',

  localeNameKo: '한국어',
  localeNameEn: 'English',
  localeNameJa: '日本語',

  accentGreen: 'Green',
  accentRed: 'Red',
  accentBlue: 'Blue',
  accentYellow: 'Yellow',
  accentOrange: 'Orange',
  accentPurple: 'Purple',
  accentCyan: 'Cyan',
  accentTeal: 'Teal',
  accentPink: 'Pink',
  accentLime: 'Lime',
  accentIndigo: 'Indigo',
  accentRose: 'Rose',
  accentCustom: 'Custom',

  settingsAccentCustomModalTitle: 'Custom accent',
  settingsAccentPaletteHint:
    'Eight columns (white + ROYGBIV hues); each column is lighter at the top, darker at the bottom. Tap Apply to confirm.',
  settingsAccentApply: 'Apply',

  alertTitleInputError: 'Input error',
  alertEmptyHandle: 'Enter a channel handle.',
  alertTitleFormatError: 'Invalid format',
  alertYoutubeHandleRule: 'Use letters, numbers, . _ - only. @ is optional.',
  alertTitleDup: 'Duplicate',
  alertDupHandle: 'This handle is already in the list.',
  alertDupKoreaKeyword: 'That keyword is already in the list.',
  alertTitleMinOne: 'At least one',
  alertMinChannel: 'Keep at least one curated channel.',
  alertMinNewsSource: 'Select at least one news source.',
  alertResetCurationTitle: 'Reset to defaults',
  alertResetCurationBody: 'Restore the app’s default curation list. Continue?',
  alertResetWatchTitle: 'Watchlist',
  alertResetWatchBody: 'Restore the app default tickers?',
  alertReset: 'Reset',
  alertEmptyTicker: 'Enter a ticker.',
  alertTickerRule: 'Use letters, numbers, . and - only.',
  alertDupTicker: 'This ticker is already in the list.',

  feedSectionTitle: 'Live news',
  feedSegmentGlobal: 'Global',
  feedSegmentKorea: 'Korea',
  feedSegmentCrypto: 'Crypto',
  feedHint:
    'Tabs: Global (Finnhub general) · Crypto (Finnhub crypto) · Korea (keyword filter on general+FX) · Korean translation + 3-line summary (Claude or ChatGPT) · FAB: sources',
  feedEmptyKorea:
    'No headlines matched Korea-related keywords. Try Global or refresh later.',
  feedNewsFilterTitle: 'News sources',
  feedNewsFilterIncluded: 'Included',
  feedNewsFilterSelectAll: 'Select all',
  feedNewsFilterSub: 'Based on sources in the latest Finnhub response · tap to toggle · keep at least one',
  feedNewsFilterClose: 'Close',
  feedErrorToken:
    'EXPO_PUBLIC_FINNHUB_TOKEN is required. Add it to .env at the project root and restart Metro.',
  feedErrorLoad: 'Could not load news.',
  feedErrorRefresh: 'Refresh failed',
  feedEmpty: 'No news to show.',
  feedDisclaimer:
    'For information only, not investment advice. AI summaries may contain errors.',

  newsAiClaude: 'Claude summary',
  newsAiOpenai: 'ChatGPT summary',
  newsAiFinnhub: 'Source summary (Finnhub)',
  newsReadMore: 'Open article →',
  newsSourceLabel: 'Source',
  newsFlashBadge: 'Breaking',

  callsSectionTitle: 'Earnings call summaries',
  callsHint:
    'Finnhub calendar → transcript → Claude summary · earnings scope (mega-cap vs watchlist) in Display · FAB: year/quarter',
  callsFiscalYear: 'Fiscal year',
  callsFiscalQuarter: 'Quarter',
  callsFiscalYearShort: 'FY',
  callsFiscalQuarterShort: 'Qtr',
  callsFiscalAll: 'All',
  callsModalFiscalLead:
    'Set fiscal year and quarter, then tap Query. Earnings scope (mega-cap vs watchlist) is in Display settings.',
  callsFilterQuery: 'Query',
  callsQuerySummary: 'Query FY{{year}} · {{quarter}}',
  callsQueryScopeSuffixMega: ' · Mega-cap',
  callsQueryScopeSuffixWatch: ' · Watchlist',
  callsFilterTitle: 'Call filter',
  callsFilterClose: 'Close',
  callsEmptyWatchFilter:
    'No earnings events for your watchlist in this window. Try again later or adjust your list.',
  callsEmptyGeneral:
    'Nothing to show. Change year/quarter in the filter (FAB) and tap Query, or read any guidance card below.',
  callsEmptyWatchlistEmpty:
    'No watchlist tickers. Add some in Quotes/Settings or choose mega-cap scope in Display.',
  callsYahooConcallA11y: 'View {{symbol}} earnings and conference call on Yahoo Finance',
  callsAiProviderClaude: 'Claude AI summary',
  callsAiProviderOpenai: 'ChatGPT summary',
  callsAiProviderFallback: 'Fallback / notice',


  quotesSegmentWatch: 'Watch',
  quotesSegmentPopular: 'Popular',
  quotesSegmentMcap: 'MCap',
  quotesSegmentCoin: 'Crypto',
  quotesHintCoin: 'Top cryptos by global market cap (CoinGecko · USD). Count in Settings.',
  quotesFooterCoin:
    'Crypto data from CoinGecko public API. Market cap and prices are indicative and may differ from exchange fills.',
  quotesPrevRefCoin: '24h ref.',
  quotesPrevCloseStock: 'Prev. close',
  quotesWatchSwipeRemove: 'Remove',
  quotesNextRefresh: 'Next refresh in {{seconds}}s',
  quotesYahooShort: 'Yahoo',
  quotesYahooFinanceA11y: 'Open {{symbol}} on Yahoo Finance',
  alertTitleUnknownTicker: 'Unknown ticker',
  quotesTickerNotFoundBody:
    'Finnhub has no quote for this symbol. Check that it is a valid listed ticker.',

  modalInfoTitle: 'About SIGNAL',
  modalInfoBody:
    'This app is for information only, not investment advice. News and call summaries are generated by Claude AI and may contain errors. You are responsible for your investment decisions.',
  modalInfoNext: 'Next (PRD)',
  modalInfoNextBody: 'Finnhub · Claude pipeline · Firebase FCM',
} as const;

const ja = {
  commonBack: '戻る',
  commonCancel: 'キャンセル',
  commonAdd: '追加',
  commonLoading: '読み込み中…',

  tabNews: 'ニュース',
  tabYoutube: 'YouTube',
  tabQuotes: '相場',
  tabCalls: '決算',

  screenSettings: '設定',
  screenAlerts: '通知',
  screenCalendar: '投資カレンダー',
  calendarScreenHint: 'Finnhub 決算・経済カレンダー（無料枠では一部欠ける場合があります）',
  calendarScreenMonthHeading: '今月の予定',
  calendarScreenEmptyMonth: '今月の予定はありません。',
  calendarScreenSectionTitle: 'この日の予定',
  calendarScreenEmptyDay: 'この日の予定はありません。',
  calendarMonthPrevA11y: '前の月',
  calendarMonthNextA11y: '次の月',
  calendarTagEarnings: '決算',
  calendarTagFomc: 'FOMC',
  calendarTagFed: 'FRB',
  calendarTagMacro: '指標',
  screenInfo: '情報',
  screenMegaCapList: 'メガキャップのティッカー一覧',
  screenMegaCapListLead:
    'カレンダー・決算コールで「メガキャップ」を選んだときの実績候補に使うティッカーです。アプリがキュレーションした米国大型株の一覧であり、投資勧誘ではありません。',
  screenMegaCapListCount: '全{{count}}件',
  settingsMegaCapListLink: 'メガキャップのティッカー一覧を見る',

  settingsCacheSectionTitle: 'キャッシュ',
  settingsCacheOneLiner:
    'ニュース {{news}}分 · YouTube {{yt}}分 · 株価 約{{qt}}秒 · コール {{cc}}分 · カレンダー {{cal}}分 · オフで毎回取得',
  settingsCacheClearButton: '全消去',
  settingsCacheClearedTitle: 'キャッシュ',
  settingsCacheClearedBody: 'ニュース・YouTube・株価・決算コール・カレンダーのメモリキャッシュを消去しました。',
  settingsCacheYoutubeToggle: 'YouTube',
  settingsCacheConcallToggle: 'コール',
  settingsCacheCalendarToggle: 'カレンダー',
  settingsCacheQuotesToggle: '株価',
  settingsCacheNewsToggle: 'ニュース',
  settingsLlmProviderKicker: 'AI要約',
  settingsLlmProviderHint:
    'ニュース翻訳/要約・YouTube要約・決算コール要約に使います。選んだ提供元のAPIキーを.env（EXPO_PUBLIC_*）に設定してください。',
  settingsLlmProviderClaude: 'Claude (Anthropic)',
  settingsLlmProviderOpenai: 'ChatGPT (OpenAI)',
  settingsLlmProviderUnavailable: 'キーなし',
  settingsLlmProviderDisabledNote: 'APIキーがない提供元は無効表示になります。',


  headerTagline: 'ノイズを捨て、本当のシグナルだけを。',
  a11yAlerts: '通知',
  a11yCalendar: '投資カレンダー',
  a11ySettings: '設定',
  a11yNewsFilter: 'ニュース提供元フィルタを開く',
  a11yCallsFilter: '決算コールのウォッチリストフィルタを開く',

  otaUpdateAvailable: '新しい画面の準備ができました。適用すると最新のJSに切り替わります。',
  otaUpdateApply: '更新',
  otaUpdateDismiss: 'あとで',
  otaUpdateErrorTitle: '更新',
  otaUpdateErrorBody: 'ダウンロードに失敗しました。通信状況を確認して再度お試しください。',
  otaUpdatePreviewMessage: '[プレビュー] 新しい画面の準備ができました（実OTAではありません）',
  otaUpdatePreviewTitle: 'プレビュー',
  otaUpdatePreviewBody: '実際のOTAではありません。バナー表示の確認用です。',

  settingsTabYoutube: 'YouTube',
  settingsTabNews: 'ニュース',
  settingsTabQuotes: '株価',
  settingsTabDisplay: '表示',
  settingsTabCalendar: 'カレンダー',
  settingsTabNotifications: '通知',

  settingsDeveloperFooterLine: 'Marcus · LinkedIn',
  settingsDeveloperLinkedInA11y: 'Marcus の LinkedIn を開く',

  settingsYoutubeLead:
    '経済YouTubeタブのキュレーションチャンネル一覧です。デフォルトのハンドルに加え、追加・削除できます。',
  settingsYoutubeSectionAdd: 'チャンネルを追加',
  settingsYoutubeHintHandle: 'YouTube @ハンドル（チャンネルURLの@以降）',
  settingsYoutubePlaceholderHandle: 'ハンドル',
  settingsYoutubeDefaultCuration: 'デフォルトキュレーション（アプリ）',
  settingsYoutubeCurrentList: '現在の一覧 ({{count}})',
  settingsYoutubeReset: 'デフォルトキュレーションに戻す',

  youtubeErrorKeyMissing:
    'EXPO_PUBLIC_YOUTUBE_API_KEY が必要です。Google Cloud で YouTube Data API v3 を有効化し、.env にキーを入れて Metro を再起動してください。',
  youtubeErrorSelectChannel: 'チャンネルを1つ以上選んでください。',
  youtubeErrorQuota:
    'YouTube Data API の1日クォータを使い切りました（太平洋時間0時にリセット）。Google Cloud の使用量を確認するか、別プロジェクト・キーに分けるか、明日再度お試しください。',
  youtubeErrorQuotaResetHint:
    '次の日次リセットまで約 {{hours}} 時間 {{minutes}} 分（太平洋時間の深夜0時基準）。',
  youtubeErrorQuotaResetImminent: 'まもなく日次クォータが更新される可能性があります（太平洋時間の深夜0時）。',
  youtubeErrorQuotaConsoleLink: 'Google Cloud でクォータを確認',
  youtubeErrorLoad: 'YouTube を読み込めませんでした。',
  youtubeErrorRefresh: '更新に失敗しました',

  settingsQuotesLead: '相場タブ「ウォッチ」用の米国株ティッカーです。この端末に保存されます。',
  settingsQuotesSectionAdd: 'ティッカーを追加',
  settingsQuotesHintTicker: '米国ティッカー（例: AAPL, SPY）',
  settingsQuotesPlaceholderTicker: 'ティッカー',
  settingsQuotesDefaultWatchlist: 'デフォルトウォッチ（アプリ）',
  settingsQuotesCurrentList: '現在の一覧 ({{count}})',
  settingsQuotesReset: 'リセット',
  settingsQuotesLimitsKicker: '件数',
  settingsQuotesWatchKicker: 'ウォッチリスト',
  settingsQuotesListLimitsHint:
    '人気・時価・仮想通貨はいずれも10〜100を10件単位でスクロール選択（既定20）。時価はユニバース件数以下のみ表示。上限: 人気 {{popMax}} · 時価 {{mcapMax}} · コイン {{coinMax}}。',
  settingsQuotesPopularCountLabel: '人気順',
  settingsQuotesMcapCountLabel: '時価順',
  settingsQuotesCoinCountLabel: '仮想通貨',
  settingsQuotesSegmentOrderKicker: '順序',
  settingsQuotesSegmentOrderHint:
    '相場画面上部のウォッチ・人気・時価・仮想通貨の順です。右の≡をドラッグして並べ替えます。',
  settingsQuotesSegmentDragHandleA11y: '{{name}}の順番を変更（ドラッグ）',

  settingsThemeLead:
    '表示では言語とアプリのテーマ（アクセントカラー）を変更できます。言語はすぐに保存され、テーマ色はタブ・ボタン・更新などに反映されます。',
  settingsThemeAccentSection: 'テーマ',
  settingsThemeLanguageSection: '言語',
  settingsTabBarGlassKicker: 'アプリのガラス',
  settingsTabBarGlassHint:
    '横のトラック上の縦のつまみをドラッグして調整します。右ほど濃く、左ほど透明です。下のプレビューが適用イメージです。変更はすぐに反映されます。',
  settingsTabBarGlassA11y: 'アプリのガラス強度 {{percent}}パーセント',
  settingsTabBarGlassPreviewKicker: 'プレビュー',
  settingsDisplayPreviewLabel: 'プレビュー',
  settingsDisplaySelectedTheme: '選択: {{name}}',

  settingsNewsTabLead: 'ニュース画面のオプションです。この端末にのみ保存されます。',
  settingsNewsSegmentOrderKicker: 'ニュースタブの順序',
  settingsNewsSegmentOrderHint:
    'ニュース画面上部のグローバル・コイン・韓国の並びです。右の≡をドラッグして並べ替えます。',
  settingsNewsSegmentDragHandleA11y: '{{name}}の順番を変更（ドラッグ）',
  settingsNewsKoreaKeywordsKicker: '韓国ニュース キーワード',
  settingsNewsKoreaKeywordsLead:
    '韓国タブは Finnhub の一般・FX ニュースを見出し・要約・関連シンボルでキーワードに合わせて絞り込みます。初回は下の一覧に既定キーワードが入り、組み込みルールと OR で照合されます。削除・追加で調整できます。',
  settingsNewsKoreaKeywordsHint: '1行に1つ · 見出し・要約・関連シンボルに部分一致（大文字小文字無視）',
  settingsNewsKoreaKeywordsPlaceholder: '例: NH Investment, ハンファ',
  settingsNewsKoreaKeywordsReset: '追加キーワードをすべて削除',
  settingsNewsKoreaKeywordsRestoreDefaults: '既定キーワードで埋める',
  settingsNewsKoreaKeywordsRestoreConfirmBody: '現在のキーワード一覧をアプリ既定のセットに置き換えます。',
  settingsNewsKoreaKeywordsResetConfirmBody:
    '追加したキーワードをすべて削除します。アプリ既定のキーワードはそのままです。',
  alertEmptyKoreaKeyword: 'キーワードを入力してください。',

  settingsCalendarScopeTitle: 'カレンダー・決算コール',
  settingsCalendarTabLead: 'カレンダー・決算コール画面の実績行の範囲を設定します。',
  settingsCalendarScopeLead:
    '実績(earnings)行をメガキャップ候補にするか、相場・設定のウォッチティッカーにするか選びます。経済指標・マクロは常にすべて表示されます。',
  settingsScopeMega: 'メガキャップ',
  settingsScopeWatch: 'ウォッチ',

  settingsNotificationsLead:
    'プッシュ通知と決算のみ通知を設定します。FCM連携後に端末へ送信されます。',
  settingsPushEnabled: 'プッシュ通知',
  settingsEarningsOnly: '決算のみ',

  alertsListHint: '1日最大10件・HIGHは即時（PRD）',
  alertsEmpty: '受信した通知はまだありません。FCM連携後にここに表示されます。',
  alertsOpenSettings: '通知設定',

  localeNameKo: '한국어',
  localeNameEn: 'English',
  localeNameJa: '日本語',

  accentGreen: '緑',
  accentRed: '赤',
  accentBlue: '青',
  accentYellow: '黄',
  accentOrange: 'オレンジ',
  accentPurple: '紫',
  accentCyan: 'シアン',
  accentTeal: 'ティール',
  accentPink: 'ピンク',
  accentLime: 'ライム',
  accentIndigo: 'インディゴ',
  accentRose: 'ローズ',
  accentCustom: 'カスタム',

  settingsAccentCustomModalTitle: 'カスタムアクセント',
  settingsAccentPaletteHint:
    '白・赤〜紫の8列。各列は上が明るく、下へ行くほど暗くなります。選んで適用を押してください。',
  settingsAccentApply: '適用',

  alertTitleInputError: '入力エラー',
  alertEmptyHandle: 'チャンネルハンドルを入力してください。',
  alertTitleFormatError: '形式エラー',
  alertYoutubeHandleRule: '英数字・._- のみ使えます。@は省略可です。',
  alertTitleDup: '重複',
  alertDupHandle: 'すでに一覧にあります。',
  alertDupKoreaKeyword: 'すでに追加済みのキーワードです。',
  alertTitleMinOne: '最低1件',
  alertMinChannel: 'キュレーションは最低1チャンネル必要です。',
  alertMinNewsSource: 'ニュース提供元は最低1つ選択してください。',
  alertResetCurationTitle: 'デフォルトに戻す',
  alertResetCurationBody: 'アプリ標準のキュレーション一覧に戻します。続行しますか？',
  alertResetWatchTitle: 'ウォッチ',
  alertResetWatchBody: 'アプリ既定のティッカーに戻します。よろしいですか？',
  alertReset: 'リセット',
  alertEmptyTicker: 'ティッカーを入力してください。',
  alertTickerRule: '英数字・.(ドット)·-(ハイフン) のみ使えます。',
  alertDupTicker: 'すでに一覧にあります。',

  feedSectionTitle: 'リアルタイムニュース',
  feedSegmentGlobal: 'グローバル',
  feedSegmentKorea: '韓国',
  feedSegmentCrypto: 'コイン',
  feedHint:
    'タブ: グローバル(Finnhub general) · コイン(Finnhub crypto) · 韓国(一般+FXからキーワード) · 韓国語翻訳＋3行要約(Claude または ChatGPT) · 右下で提供元',
  feedEmptyKorea:
    '韓国関連キーワードに一致する記事がありません。グローバルを見るか、しばらくして更新してください。',
  feedNewsFilterTitle: 'ニュース提供元',
  feedNewsFilterIncluded: '含める',
  feedNewsFilterSelectAll: 'すべて選択',
  feedNewsFilterSub: '最新のFinnhub応答に含まれる提供元 · タップでon/off · 最低1件',
  feedNewsFilterClose: '閉じる',
  feedErrorToken:
    'EXPO_PUBLIC_FINNHUB_TOKEN が必要です。プロジェクト直下の .env に設定し Metro を再起動してください。',
  feedErrorLoad: 'ニュースを読み込めませんでした。',
  feedErrorRefresh: '更新に失敗しました',
  feedEmpty: '表示するニュースがありません。',
  feedDisclaimer: '投資勧誘ではなく情報提供です。AI要約に誤りがある場合があります。',

  newsAiClaude: 'Claude要約',
  newsAiOpenai: 'ChatGPT要約',
  newsAiFinnhub: '原文要約（Finnhub）',
  newsReadMore: '原文を見る →',
  newsSourceLabel: '出所',
  newsFlashBadge: '速報',

  callsSectionTitle: '決算コール要約',
  callsHint:
    'Finnhub決算カレンダー → トランスクリプト → Claude要約 · 表示設定で実績範囲(メガキャップ/ウォッチ) · 右下で年度・四半期',
  callsFiscalYear: '会計年度',
  callsFiscalQuarter: '四半期',
  callsFiscalYearShort: '年度',
  callsFiscalQuarterShort: '四半期',
  callsFiscalAll: '通年',
  callsModalFiscalLead:
    '会計年度・四半期を設定して検索します。実績範囲(メガキャップ/ウォッチ)は表示設定で変えられます。',
  callsFilterQuery: '検索',
  callsQuerySummary: '検索 FY{{year}} · {{quarter}}',
  callsQueryScopeSuffixMega: ' · メガキャップ',
  callsQueryScopeSuffixWatch: ' · ウォッチ',
  callsFilterTitle: '決算フィルタ',
  callsFilterClose: '閉じる',
  callsEmptyWatchFilter: 'この期間にウォッチ銘柄の決算予定がありません。後で確認してください。',
  callsEmptyGeneral:
    '表示するカードがありません。右下フィルタで年度・四半期を変えて検索するか、案内カードを確認してください。',
  callsEmptyWatchlistEmpty:
    'ウォッチがありません。相場・設定でティッカーを追加するか、表示でメガキャップ範囲を選んでください。',
  callsYahooConcallA11y: '{{symbol}} の決算・決算説明会を Yahoo Finance で開く',
  callsAiProviderClaude: 'Claude AI要約',
  callsAiProviderOpenai: 'ChatGPT要約',
  callsAiProviderFallback: 'フォールバック / 案内',


  quotesSegmentWatch: 'ウォッチ',
  quotesSegmentPopular: '人気順',
  quotesSegmentMcap: '時価順',
  quotesSegmentCoin: '仮想通貨',
  quotesHintCoin: '時価総額グローバル上位（CoinGecko · USD）— 件数は設定で変更',
  quotesFooterCoin:
    'CoinGecko 公開APIのデータです。時価・価格は参考値であり、実際の取引と異なる場合があります。',
  quotesPrevRefCoin: '24h基準',
  quotesPrevCloseStock: '前日終値',
  quotesWatchSwipeRemove: '削除',
  quotesNextRefresh: '次の更新まであと{{seconds}}秒',
  quotesYahooShort: 'Yahoo',
  quotesYahooFinanceA11y: '{{symbol}} を Yahoo Finance で開く',
  alertTitleUnknownTicker: 'ティッカー不明',
  quotesTickerNotFoundBody:
    'Finnhubでこのティッカーの相場が見つかりません。上場シンボルか確認してください。',

  modalInfoTitle: 'SIGNALについて',
  modalInfoBody:
    '本アプリは投資勧誘・仲介を目的としません。ニュース・決算要約はClaude AIで生成され誤りがある場合があります。投資判断は自己責任でお願いします。',
  modalInfoNext: '次のステップ（PRD）',
  modalInfoNextBody: 'Finnhub連携 · Claudeパイプライン · Firebase FCM',
} as const;

export const messages = {
  ko,
  en,
  ja,
} satisfies Record<AppLocale, Record<keyof typeof ko, string>>;

export type MessageId = keyof typeof ko;
