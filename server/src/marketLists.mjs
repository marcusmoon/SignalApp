export const MARKET_LIST_KEYS = ['mega_cap', 'mcap_universe', 'popular_symbols', 'default_watchlist'];

export function normalizeMarketSymbol(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
}

export function normalizeMarketSymbols(values) {
  const input = Array.isArray(values)
    ? values
    : String(values || '')
        .split(/[\s,]+/)
        .filter(Boolean);
  return [...new Set(input.map(normalizeMarketSymbol).filter(Boolean))];
}

export function defaultMarketLists(nowIso) {
  const now = nowIso();
  return [
    {
      key: 'mega_cap',
      displayName: '메가캡 리스트',
      description: '캘린더·컨콜에서 메가캡 필터 기준으로 쓰는 미국 대형주 리스트입니다.',
      symbols: [
        'AAPL', 'MSFT', 'GOOGL', 'GOOG', 'AMZN', 'NVDA', 'META', 'TSLA', 'BRK.B', 'AVGO',
        'UNH', 'XOM', 'JNJ', 'JPM', 'V', 'PG', 'MA', 'HD', 'CVX', 'MRK',
        'ABBV', 'PEP', 'COST', 'ADBE', 'TMO', 'CSCO', 'ACN', 'NFLX', 'DHR', 'LIN',
        'AMD', 'MCD', 'WMT', 'DIS', 'ORCL', 'BAC', 'CRM', 'PM', 'INTU', 'TXN',
        'QCOM', 'IBM', 'AMAT', 'COP', 'GE', 'HON', 'CAT', 'AMGN', 'SPGI', 'BKNG',
        'BLK', 'SBUX', 'GILD', 'ISRG', 'MDT', 'ADI', 'VRTX', 'PANW', 'MU', 'LRCX',
        'SYK', 'DE', 'REGN', 'ZTS', 'ETN', 'KLAC', 'SNPS', 'CDNS', 'MELI', 'CMCSA',
      ],
      updatedAt: now,
    },
    {
      key: 'mcap_universe',
      displayName: '시총 산정 후보',
      description: '시총 상위 시세 Job이 profile 조회 후 정렬할 후보 종목입니다.',
      symbols: [
        'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'AVGO', 'TSLA', 'BRK-B', 'JPM',
        'WMT', 'UNH', 'XOM', 'JNJ', 'V', 'PG', 'MA', 'ORCL', 'COST', 'HD',
        'ABBV', 'BAC', 'KO', 'NFLX', 'AMD', 'LLY', 'MRK', 'PEP', 'TMO', 'ABT',
        'DHR', 'CSCO', 'ACN', 'DIS', 'CMCSA', 'NKE', 'PM', 'TXN', 'LIN', 'QCOM',
        'AMGN', 'HON', 'UPS', 'LOW', 'SBUX', 'AMAT', 'INTU', 'ISRG', 'BKNG', 'ADBE',
        'GE', 'CAT', 'DE', 'GS', 'MS', 'BLK', 'SCHW', 'SPGI', 'MDT', 'ZTS',
        'CI', 'SYK', 'MO', 'PFE', 'T', 'CME', 'EQIX', 'ICE', 'AXP', 'TJX',
        'REGN', 'CL', 'EL', 'NEE', 'DUK', 'SO', 'PLD', 'MMC', 'CB', 'AON',
        'ECL', 'SHW', 'ITW', 'EMR', 'FCX', 'OXY', 'MET', 'PYPL', 'CRWD', 'NOW',
        'UBER', 'ABNB', 'LRCX', 'MU', 'ADI', 'SNPS', 'CDNS', 'PANW', 'FTNT', 'MMM',
        'RTX', 'BA', 'LMT',
      ],
      updatedAt: now,
    },
    {
      key: 'popular_symbols',
      displayName: '인기 시세 종목',
      description: '인기 시세 최신 수집 Job과 앱 인기 탭에서 공유할 종목 순서입니다.',
      symbols: [
        'NVDA', 'TSLA', 'AAPL', 'AMD', 'META', 'AMZN', 'GOOGL', 'MSFT', 'MSTR', 'COIN',
        'PLTR', 'SPY', 'QQQ', 'IWM', 'BRK-B', 'JPM', 'NFLX', 'UNH', 'AVGO', 'XOM',
      ],
      updatedAt: now,
    },
    {
      key: 'default_watchlist',
      displayName: '기본 관심종목',
      description: '신규 사용자 또는 관심종목 초기화 시 사용할 기본 종목입니다.',
      symbols: ['NVDA', 'GOOGL', 'AAPL', 'TSLA', 'BMNR', 'MU', 'PLTR', 'CRCL', 'SPY', 'QQQ'],
      updatedAt: now,
    },
  ];
}

export function ensureMarketListsShape(lists, nowIso) {
  const existing = Array.isArray(lists) ? lists : [];
  const defaults = defaultMarketLists(nowIso);
  const shaped = existing
    .filter((item) => MARKET_LIST_KEYS.includes(item?.key))
    .map((item) => ({
      ...item,
      displayName: String(item.displayName || item.key),
      description: String(item.description || ''),
      symbols: normalizeMarketSymbols(item.symbols),
      updatedAt: item.updatedAt || nowIso(),
    }));
  for (const list of defaults) {
    if (!shaped.some((item) => item.key === list.key)) shaped.push(list);
  }
  return shaped;
}

export function publicMarketList(list) {
  return {
    key: list.key,
    displayName: list.displayName,
    description: list.description,
    symbols: list.symbols,
    count: list.symbols.length,
    updatedAt: list.updatedAt,
  };
}
