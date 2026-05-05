import { nowIso } from '../db/time.mjs';

function validTime(value) {
  const ms = new Date(value || 0).getTime();
  return Number.isFinite(ms) && ms > 0 ? ms : null;
}

function ymd(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function daysBetweenYmd(a, b) {
  const ma = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(a || ''));
  const mb = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(b || ''));
  if (!ma || !mb) return null;
  const da = Date.UTC(Number(ma[1]), Number(ma[2]) - 1, Number(ma[3]));
  const db = Date.UTC(Number(mb[1]), Number(mb[2]) - 1, Number(mb[3]));
  return Math.round((db - da) / 86_400_000);
}

function normalizeSymbol(value) {
  return String(value || '').trim().toUpperCase();
}

function quoteMovePct(quote) {
  if (!quote) return 0;
  const direct = Number(quote.changePercent);
  if (Number.isFinite(direct)) return direct;
  const current = Number(quote.currentPrice);
  const prev = Number(quote.previousClose);
  if (Number.isFinite(current) && Number.isFinite(prev) && prev !== 0) return ((current - prev) / prev) * 100;
  return 0;
}

function bestQuoteBySymbol(quotes) {
  const map = new Map();
  for (const quote of quotes || []) {
    const symbol = normalizeSymbol(quote?.symbol);
    if (!symbol) continue;
    const prev = map.get(symbol);
    const prevAt = validTime(prev?.fetchedAt || prev?.quoteTime) || 0;
    const nextAt = validTime(quote?.fetchedAt || quote?.quoteTime) || 0;
    if (!prev || nextAt >= prevAt) map.set(symbol, quote);
  }
  return map;
}

function recentRows(rows, fields, sinceMs, limit = 200) {
  return [...(rows || [])]
    .filter((row) => fields.some((field) => {
      const t = validTime(row?.[field]);
      return t != null && t >= sinceMs;
    }))
    .sort((a, b) => {
      const at = Math.max(...fields.map((field) => validTime(a?.[field]) || 0));
      const bt = Math.max(...fields.map((field) => validTime(b?.[field]) || 0));
      return bt - at;
    })
    .slice(0, limit);
}

function nextEarningsBySymbol(events, today) {
  const map = new Map();
  for (const event of events || []) {
    if (event?.type !== 'earnings') continue;
    const symbol = normalizeSymbol(event.symbol);
    const date = String(event.date || event.eventAt || '').slice(0, 10);
    if (!symbol || !date || date < today) continue;
    const prev = map.get(symbol);
    if (!prev || date < String(prev.date || prev.eventAt || '').slice(0, 10)) map.set(symbol, event);
  }
  return map;
}

function levelForScore(score) {
  if (score >= 70) return 'alert';
  if (score >= 40) return 'watch';
  return 'brief';
}

function selectInsightLlm(db, preference = 'auto') {
  const pref = String(preference || 'auto').toLowerCase();
  const providers = Array.isArray(db.providerSettings) ? db.providerSettings : [];
  const candidates = pref === 'auto' ? ['claude', 'openai'] : [pref];
  for (const provider of candidates) {
    const setting = providers.find((row) => row?.provider === provider);
    if (!setting || setting.enabled === false || !String(setting.apiKey || '').trim()) continue;
    return {
      status: 'ready',
      provider,
      model: setting.defaultModel || null,
    };
  }
  return { status: 'not_configured', provider: pref === 'auto' ? null : pref, model: null };
}

function sourceRefFromNews(item) {
  return {
    type: 'news',
    id: item.id,
    title: item.titleOriginal || item.title || '',
    url: item.sourceUrl || '',
    sourceName: item.sourceName || '',
    publishedAt: item.publishedAt || null,
  };
}

function sourceRefFromYoutube(item) {
  return {
    type: 'youtube',
    id: item.id,
    title: item.title || '',
    url: item.videoId ? `https://www.youtube.com/watch?v=${item.videoId}` : '',
    sourceName: item.channel || '',
    publishedAt: item.publishedAt || null,
  };
}

function titleForSymbol(symbol, score, newsCount, movePct, earningsSoon) {
  const moveText = Math.abs(movePct) >= 1 ? `${movePct > 0 ? '+' : ''}${movePct.toFixed(1)}%` : '시세 변동 낮음';
  if (earningsSoon) return `${symbol} 실적 전후 신호 점검`;
  if (score >= 70) return `${symbol} 강한 시장 신호 감지`;
  if (newsCount >= 3 && Math.abs(movePct) >= 2) return `${symbol} 뉴스와 시세가 함께 움직임`;
  return `${symbol} 관심 신호 업데이트`;
}

function buildSymbolInsight({ symbol, news, quote, earning, videos, today, generatedAt, expiresAt, llm }) {
  const movePct = quoteMovePct(quote);
  const absMove = Math.abs(movePct);
  const earningDate = String(earning?.date || earning?.eventAt || '').slice(0, 10);
  const earningDays = earningDate ? daysBetweenYmd(today, earningDate) : null;
  const earningsSoon = earningDays != null && earningDays >= 0 && earningDays <= 7;
  const reasons = [];
  let score = 0;

  if (news.length >= 6) {
    score += 32;
    reasons.push(`최근 ${news.length}건의 관련 뉴스가 집중됐습니다.`);
  } else if (news.length >= 3) {
    score += 22;
    reasons.push(`최근 ${news.length}건의 관련 뉴스가 확인됐습니다.`);
  } else if (news.length > 0) {
    score += 10;
    reasons.push('관련 뉴스가 새로 들어왔습니다.');
  }

  if (absMove >= 5) {
    score += 34;
    reasons.push(`시세가 ${movePct > 0 ? '상승' : '하락'} 방향으로 ${absMove.toFixed(1)}% 움직였습니다.`);
  } else if (absMove >= 2) {
    score += 22;
    reasons.push(`시세 변동폭이 ${absMove.toFixed(1)}%로 커졌습니다.`);
  } else if (absMove >= 1) {
    score += 8;
  }

  if (earningsSoon) {
    score += 20;
    reasons.push(`실적 발표가 ${earningDays === 0 ? '오늘' : `${earningDays}일 뒤`} 예정되어 있습니다.`);
  }

  if (videos.length > 0) {
    score += Math.min(10, videos.length * 4);
    reasons.push(`관련 유튜브 ${videos.length}건이 최근 업데이트됐습니다.`);
  }

  const capped = Math.min(100, Math.round(score));
  const level = levelForScore(capped);
  const sourceRefs = [
    ...news.slice(0, 4).map(sourceRefFromNews),
    ...videos.slice(0, 2).map(sourceRefFromYoutube),
  ];
  const summaryParts = [];
  if (news.length > 0) summaryParts.push(`뉴스 ${news.length}건`);
  if (Math.abs(movePct) >= 1) summaryParts.push(`시세 ${movePct > 0 ? '+' : ''}${movePct.toFixed(1)}%`);
  if (earningsSoon) summaryParts.push(`실적 D-${earningDays}`);
  if (videos.length > 0) summaryParts.push(`유튜브 ${videos.length}건`);
  const summary = `${summaryParts.join(' · ') || '수집 데이터'} 기준으로 관심도가 상승했습니다. 관련 원문을 확인해 맥락을 이어서 볼 수 있습니다.`;

  return {
    id: `insight:${symbol}:${generatedAt.slice(0, 13)}`,
    kind: 'asset_signal',
    level,
    score: capped,
    title: titleForSymbol(symbol, capped, news.length, movePct, earningsSoon),
    summary,
    symbols: [symbol],
    topics: ['asset', ...(earningsSoon ? ['earnings'] : []), ...(news.length ? ['news'] : []), ...(absMove >= 2 ? ['price_move'] : [])],
    reasoning: reasons,
    sourceRefs,
    relatedNewsIds: news.map((item) => item.id),
    relatedYoutubeIds: videos.map((item) => item.id),
    relatedQuoteIds: quote?.id ? [quote.id] : [],
    pushCandidate: capped >= 55,
    pushTitle: `${symbol} 관심 신호`,
    pushBody: summary,
    provider: 'rules',
    model: null,
    llm,
    llmPromptInput: {
      symbol,
      news: news.slice(0, 6).map((item) => ({ title: item.titleOriginal || item.title, summary: item.summaryOriginal || '' })),
      quote,
      earning,
      videos: videos.slice(0, 3).map((item) => ({ title: item.title, channel: item.channel })),
    },
    generatedAt,
    expiresAt,
    createdAt: generatedAt,
    updatedAt: generatedAt,
  };
}

function buildBriefInsight({ recentNews, recentVideos, generatedAt, expiresAt, llm }) {
  const topNews = recentNews.slice(0, 5);
  const topVideos = recentVideos.slice(0, 3);
  const refs = [...topNews.map(sourceRefFromNews), ...topVideos.map(sourceRefFromYoutube)];
  return {
    id: `insight:market-brief:${generatedAt.slice(0, 13)}`,
    kind: 'market_brief',
    level: topNews.length >= 8 ? 'watch' : 'brief',
    score: Math.min(60, 20 + topNews.length * 4 + topVideos.length * 3),
    title: '오늘의 시장 브리핑',
    summary: `최근 뉴스 ${recentNews.length}건과 유튜브 ${recentVideos.length}건을 기준으로 시장 흐름을 묶었습니다. 주요 원문에서 세부 맥락을 확인하세요.`,
    symbols: [...new Set(topNews.flatMap((item) => item.symbols || []).map(normalizeSymbol).filter(Boolean))].slice(0, 6),
    topics: ['market_brief', 'news', ...(topVideos.length ? ['youtube'] : [])],
    reasoning: ['최근 수집된 콘텐츠를 시간순으로 묶은 브리핑입니다.'],
    sourceRefs: refs,
    relatedNewsIds: topNews.map((item) => item.id),
    relatedYoutubeIds: topVideos.map((item) => item.id),
    relatedQuoteIds: [],
    pushCandidate: false,
    pushTitle: '오늘의 시장 브리핑',
    pushBody: '주요 뉴스와 영상을 묶은 브리핑이 업데이트됐습니다.',
    provider: 'rules',
    model: null,
    llm,
    llmPromptInput: {
      news: topNews.map((item) => ({ title: item.titleOriginal || item.title, summary: item.summaryOriginal || '' })),
      videos: topVideos.map((item) => ({ title: item.title, channel: item.channel })),
    },
    generatedAt,
    expiresAt,
    createdAt: generatedAt,
    updatedAt: generatedAt,
  };
}

export function generateMarketInsights(db, params = {}) {
  const generatedAt = nowIso();
  const now = new Date(generatedAt);
  const today = ymd(now);
  const windowHours = Math.max(1, Math.min(168, Number(params.windowHours) || 24));
  const maxItems = Math.max(1, Math.min(50, Number(params.maxItems) || 8));
  const minScore = Math.max(0, Math.min(100, Number(params.minScore) || 20));
  const expiresAt = new Date(now.getTime() + windowHours * 60 * 60 * 1000).toISOString();
  const sinceMs = now.getTime() - windowHours * 60 * 60 * 1000;
  const llm = selectInsightLlm(db, params.llmProvider || 'auto');

  const recentNews = recentRows(db.newsItems, ['publishedAt', 'fetchedAt', 'updatedAt'], sinceMs, 300);
  const recentVideos = recentRows(db.youtubeVideos, ['publishedAt', 'fetchedAt', 'updatedAt'], sinceMs, 120);
  const quoteMap = bestQuoteBySymbol(db.marketQuotes);
  const earningsMap = nextEarningsBySymbol(db.calendarEvents, today);
  const videosBySymbol = new Map();
  for (const video of recentVideos) {
    for (const symbol of video.symbols || []) {
      const s = normalizeSymbol(symbol);
      if (!s) continue;
      if (!videosBySymbol.has(s)) videosBySymbol.set(s, []);
      videosBySymbol.get(s).push(video);
    }
  }

  const newsBySymbol = new Map();
  for (const item of recentNews) {
    for (const symbol of item.symbols || []) {
      const s = normalizeSymbol(symbol);
      if (!s) continue;
      if (!newsBySymbol.has(s)) newsBySymbol.set(s, []);
      newsBySymbol.get(s).push(item);
    }
  }

  const symbols = new Set([
    ...quoteMap.keys(),
    ...earningsMap.keys(),
    ...newsBySymbol.keys(),
    ...videosBySymbol.keys(),
  ]);

  const assetInsights = [...symbols]
    .map((symbol) =>
      buildSymbolInsight({
        symbol,
        news: newsBySymbol.get(symbol) || [],
        quote: quoteMap.get(symbol) || null,
        earning: earningsMap.get(symbol) || null,
        videos: videosBySymbol.get(symbol) || [],
        today,
        generatedAt,
        expiresAt,
        llm,
      }),
    )
    .filter((item) => item.score >= minScore)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, maxItems);

  const brief = buildBriefInsight({ recentNews, recentVideos, generatedAt, expiresAt, llm });
  return [brief, ...assetInsights].slice(0, maxItems);
}
