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
  screenInfo: '정보',

  headerTagline: '노이즈는 걸러내고, 진짜 시그널만',
  a11yAlerts: '알림',
  a11yCalendar: '투자 캘린더',
  a11ySettings: '설정',

  settingsTabYoutube: '유튜브',
  settingsTabQuotes: '관심종목',
  settingsTabDisplay: '표시',
  settingsTabNotifications: '알림',

  settingsYoutubeLead:
    '경제 유튜브 탭의 큐레이션 채널 목록입니다. 기본으로 아래 핸들이 포함되어 있으며, 원하는 채널을 추가하거나 삭제할 수 있습니다.',
  settingsYoutubeSectionAdd: '채널 추가',
  settingsYoutubeHintHandle: 'YouTube @핸들 (예: 채널 URL의 @뒤 이름)',
  settingsYoutubePlaceholderHandle: '핸들 입력',
  settingsYoutubeDefaultCuration: '기본 큐레이션 (앱 제공)',
  settingsYoutubeCurrentList: '현재 목록 ({{count}})',
  settingsYoutubeReset: '기본 큐레이션으로 초기화',

  settingsQuotesLead: '시세 탭의 「관심」에 표시되는 미국 주식 티커입니다. 여기서 바꾸면 앱에 저장됩니다.',
  settingsQuotesSectionAdd: '티커 추가',
  settingsQuotesHintTicker: '미국 티커 (예: AAPL, SPY)',
  settingsQuotesPlaceholderTicker: '티커 입력',
  settingsQuotesDefaultWatchlist: '기본 관심 종목 (앱 제공)',
  settingsQuotesCurrentList: '현재 목록 ({{count}})',
  settingsQuotesReset: '기본 관심 종목으로 초기화',

  settingsThemeLead:
    '표시 설정에서 앱 테마(강조색)와 언어를 바꿀 수 있습니다. 테마 색은 탭·버튼·새로고침 등에 적용되며, 언어는 즉시 저장됩니다.',
  settingsThemeAccentSection: '테마',
  settingsThemeLanguageSection: '언어',
  settingsDisplayPreviewLabel: '미리보기',
  settingsDisplaySelectedTheme: '선택: {{name}}',

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

  alertTitleInputError: '입력 오류',
  alertEmptyHandle: '채널 핸들을 입력해 주세요.',
  alertTitleFormatError: '형식 오류',
  alertYoutubeHandleRule: '영문·숫자·._- 만 사용할 수 있습니다. @는 생략해도 됩니다.',
  alertTitleDup: '중복',
  alertDupHandle: '이미 목록에 있는 핸들입니다.',
  alertTitleMinOne: '최소 1개',
  alertMinChannel: '큐레이션 채널은 최소 1개 이상 유지해야 합니다.',
  alertResetCurationTitle: '기본값으로 초기화',
  alertResetCurationBody: '앱에서 제공하는 기본 큐레이션 채널 목록으로 되돌립니다. 계속할까요?',
  alertResetWatchTitle: '기본 관심 종목으로 초기화',
  alertResetWatchBody: '아래 기본 티커 목록으로 되돌립니다. 계속할까요?',
  alertReset: '초기화',
  alertEmptyTicker: '티커를 입력해 주세요.',
  alertTickerRule: '영문·숫자·.(점)·-(하이픈) 조합만 사용할 수 있습니다.',
  alertDupTicker: '이미 목록에 있는 티커입니다.',

  feedSectionTitle: '실시간 뉴스',
  feedHint: 'Finnhub 속보 · 한국어 3줄 요약 (Anthropic 키가 있으면 Claude)',
  feedErrorToken:
    'EXPO_PUBLIC_FINNHUB_TOKEN 이 필요합니다. 프로젝트 루트에 .env 를 만들고 토큰을 넣은 뒤 Metro를 재시작하세요.',
  feedErrorLoad: '뉴스를 불러오지 못했습니다.',
  feedErrorRefresh: '새로고침 실패',
  feedEmpty: '표시할 뉴스가 없습니다.',
  feedDisclaimer: '본 앱은 투자 권유가 아닌 정보 제공 목적입니다. AI 요약 오류가 있을 수 있습니다.',

  newsAiClaude: 'Claude AI 요약',
  newsAiFinnhub: '원문 요약 (Finnhub)',
  newsReadMore: '원문 보기 →',

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
  screenInfo: 'About',

  headerTagline: 'Cut the noise. Keep the signal.',
  a11yAlerts: 'Alerts',
  a11yCalendar: 'Invest calendar',
  a11ySettings: 'Settings',

  settingsTabYoutube: 'YouTube',
  settingsTabQuotes: 'Watchlist',
  settingsTabDisplay: 'Display',
  settingsTabNotifications: 'Alerts',

  settingsYoutubeLead:
    'Curated channels for the Economy YouTube tab. Default handles are included below—add or remove as you like.',
  settingsYoutubeSectionAdd: 'Add channel',
  settingsYoutubeHintHandle: 'YouTube @handle (from the channel URL)',
  settingsYoutubePlaceholderHandle: 'Handle',
  settingsYoutubeDefaultCuration: 'Default curation (app)',
  settingsYoutubeCurrentList: 'Current list ({{count}})',
  settingsYoutubeReset: 'Reset to default curation',

  settingsQuotesLead: 'US tickers shown under Watch on the Quotes tab. Changes are saved on device.',
  settingsQuotesSectionAdd: 'Add ticker',
  settingsQuotesHintTicker: 'US ticker (e.g. AAPL, SPY)',
  settingsQuotesPlaceholderTicker: 'Ticker',
  settingsQuotesDefaultWatchlist: 'Default watchlist (app)',
  settingsQuotesCurrentList: 'Current list ({{count}})',
  settingsQuotesReset: 'Reset to default watchlist',

  settingsThemeLead:
    'In Display, change the app theme (accent color) and language. Theme color applies to tabs, buttons, and refresh controls; language saves immediately.',
  settingsThemeAccentSection: 'Theme',
  settingsThemeLanguageSection: 'Language',
  settingsDisplayPreviewLabel: 'Preview',
  settingsDisplaySelectedTheme: 'Selected: {{name}}',

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

  alertTitleInputError: 'Input error',
  alertEmptyHandle: 'Enter a channel handle.',
  alertTitleFormatError: 'Invalid format',
  alertYoutubeHandleRule: 'Use letters, numbers, . _ - only. @ is optional.',
  alertTitleDup: 'Duplicate',
  alertDupHandle: 'This handle is already in the list.',
  alertTitleMinOne: 'At least one',
  alertMinChannel: 'Keep at least one curated channel.',
  alertResetCurationTitle: 'Reset to defaults',
  alertResetCurationBody: 'Restore the app’s default curation list. Continue?',
  alertResetWatchTitle: 'Reset watchlist',
  alertResetWatchBody: 'Restore the default ticker list below. Continue?',
  alertReset: 'Reset',
  alertEmptyTicker: 'Enter a ticker.',
  alertTickerRule: 'Use letters, numbers, . and - only.',
  alertDupTicker: 'This ticker is already in the list.',

  feedSectionTitle: 'Live news',
  feedHint: 'Finnhub headlines · 3-line summary (Claude if Anthropic key is set)',
  feedErrorToken:
    'EXPO_PUBLIC_FINNHUB_TOKEN is required. Add it to .env at the project root and restart Metro.',
  feedErrorLoad: 'Could not load news.',
  feedErrorRefresh: 'Refresh failed',
  feedEmpty: 'No news to show.',
  feedDisclaimer:
    'For information only, not investment advice. AI summaries may contain errors.',

  newsAiClaude: 'Claude summary',
  newsAiFinnhub: 'Source summary (Finnhub)',
  newsReadMore: 'Open article →',

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
  screenInfo: '情報',

  headerTagline: 'ノイズを捨て、本当のシグナルだけを。',
  a11yAlerts: '通知',
  a11yCalendar: '投資カレンダー',
  a11ySettings: '設定',

  settingsTabYoutube: 'YouTube',
  settingsTabQuotes: 'ウォッチ',
  settingsTabDisplay: '表示',
  settingsTabNotifications: '通知',

  settingsYoutubeLead:
    '経済YouTubeタブのキュレーションチャンネル一覧です。デフォルトのハンドルに加え、追加・削除できます。',
  settingsYoutubeSectionAdd: 'チャンネルを追加',
  settingsYoutubeHintHandle: 'YouTube @ハンドル（チャンネルURLの@以降）',
  settingsYoutubePlaceholderHandle: 'ハンドル',
  settingsYoutubeDefaultCuration: 'デフォルトキュレーション（アプリ）',
  settingsYoutubeCurrentList: '現在の一覧 ({{count}})',
  settingsYoutubeReset: 'デフォルトキュレーションに戻す',

  settingsQuotesLead: '相場タブの「ウォッチ」に表示する米国株ティッカーです。変更は端末に保存されます。',
  settingsQuotesSectionAdd: 'ティッカーを追加',
  settingsQuotesHintTicker: '米国ティッカー（例: AAPL, SPY）',
  settingsQuotesPlaceholderTicker: 'ティッカー',
  settingsQuotesDefaultWatchlist: 'デフォルトウォッチ（アプリ）',
  settingsQuotesCurrentList: '現在の一覧 ({{count}})',
  settingsQuotesReset: 'デフォルトウォッチに戻す',

  settingsThemeLead:
    '表示ではアプリのテーマ（アクセントカラー）と言語を変更できます。テーマ色はタブ・ボタン・更新などに反映され、言語はすぐに保存されます。',
  settingsThemeAccentSection: 'テーマ',
  settingsThemeLanguageSection: '言語',
  settingsDisplayPreviewLabel: 'プレビュー',
  settingsDisplaySelectedTheme: '選択: {{name}}',

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

  alertTitleInputError: '入力エラー',
  alertEmptyHandle: 'チャンネルハンドルを入力してください。',
  alertTitleFormatError: '形式エラー',
  alertYoutubeHandleRule: '英数字・._- のみ使えます。@は省略可です。',
  alertTitleDup: '重複',
  alertDupHandle: 'すでに一覧にあります。',
  alertTitleMinOne: '最低1件',
  alertMinChannel: 'キュレーションは最低1チャンネル必要です。',
  alertResetCurationTitle: 'デフォルトに戻す',
  alertResetCurationBody: 'アプリ標準のキュレーション一覧に戻します。続行しますか？',
  alertResetWatchTitle: 'ウォッチをデフォルトに',
  alertResetWatchBody: '下記のデフォルトティッカー一覧に戻します。続行しますか？',
  alertReset: 'リセット',
  alertEmptyTicker: 'ティッカーを入力してください。',
  alertTickerRule: '英数字・.(ドット)·-(ハイフン) のみ使えます。',
  alertDupTicker: 'すでに一覧にあります。',

  feedSectionTitle: 'リアルタイムニュース',
  feedHint: 'Finnhub速報・3行要約（AnthropicキーがあればClaude）',
  feedErrorToken:
    'EXPO_PUBLIC_FINNHUB_TOKEN が必要です。プロジェクト直下の .env に設定し Metro を再起動してください。',
  feedErrorLoad: 'ニュースを読み込めませんでした。',
  feedErrorRefresh: '更新に失敗しました',
  feedEmpty: '表示するニュースがありません。',
  feedDisclaimer: '投資勧誘ではなく情報提供です。AI要約に誤りがある場合があります。',

  newsAiClaude: 'Claude要約',
  newsAiFinnhub: '原文要約（Finnhub）',
  newsReadMore: '原文を見る →',

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
