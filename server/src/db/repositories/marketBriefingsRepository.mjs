import { queryKysely } from '../kysely/client.mjs';
import { hydrateMarketBriefingItems } from '../../sources/resolveSourceRefs.mjs';
import { queryPublicMarketQuoteRows } from './marketRepository.mjs';
import {
  cleanText,
  normalizeEntities,
  pageOptions,
  payloadFromRow,
  sqlUtcRangeFrom,
  sqlUtcRangeTo,
} from './publicHelpers.mjs';

function publicBriefing(item) {
  if (!item) return null;
  const entities = normalizeEntities(item.entities);
  return {
    id: item.id,
    market: item.market || '',
    session: item.session || '',
    title: item.title || '',
    headline: item.headline || '',
    summary: item.summary || '',
    overview: Array.isArray(item.overview) ? item.overview : [],
    sectors: Array.isArray(item.sectors) ? item.sectors : [],
    companies: Array.isArray(item.companies) ? item.companies : [],
    macro: Array.isArray(item.macro) ? item.macro : [],
    sourceRefs: Array.isArray(item.sourceRefs) ? item.sourceRefs : [],
    ...(entities.length > 0 ? { entities } : {}),
    publishedAt: item.publishedAt || item.generatedAt || null,
    briefingDate: item.briefingDate || item.generatedDate || null,
    pushTitle: item.pushTitle || '',
    pushBody: item.pushBody || '',
    createdAt: item.createdAt || null,
    updatedAt: item.updatedAt || null,
  };
}

function quoteKeys(quote) {
  return [
    quote?.symbol,
    quote?.displaySymbol,
    quote?.krxSymbol,
    quote?.providerItemId,
    quote?.regularSession?.yahooSymbol,
  ]
    .map((value) => cleanText(value).toUpperCase())
    .filter(Boolean);
}

function companyKeys(company) {
  return [
    company?.symbol,
    company?.ticker,
    company?.krxSymbol,
    company?.yahooSymbol,
  ]
    .map((value) => cleanText(value).toUpperCase())
    .filter(Boolean);
}

function hasFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

async function enrichBriefingCompanies(rows) {
  const symbols = [
    ...new Set(
      rows
        .flatMap((briefing) => (Array.isArray(briefing?.companies) ? briefing.companies : []))
        .flatMap(companyKeys),
    ),
  ];
  if (symbols.length === 0) return rows;

  const quotesPage = await queryPublicMarketQuoteRows({
    symbols,
    limit: Math.max(100, symbols.length),
    offset: 0,
  });
  const quoteByKey = new Map();
  for (const quote of quotesPage.rows || []) {
    for (const key of quoteKeys(quote)) {
      if (!quoteByKey.has(key)) quoteByKey.set(key, quote);
    }
  }
  if (quoteByKey.size === 0) return rows;

  return rows.map((briefing) => ({
    ...briefing,
    companies: (briefing.companies || []).map((company) => {
      const quote = companyKeys(company).map((key) => quoteByKey.get(key)).find(Boolean);
      if (!quote) return company;
      const shouldFallbackChangePercent = briefing.market !== 'us';
      return {
        ...company,
        name: company.name || quote.name || null,
        price: hasFiniteNumber(company.price) ? company.price : quote.currentPrice,
        changePercent: hasFiniteNumber(company.changePercent)
          ? company.changePercent
          : shouldFallbackChangePercent
            ? quote.changePercent
            : null,
      };
    }),
  }));
}

export async function queryPublicMarketBriefings(options = {}) {
  const { limit, offset } = pageOptions(options, 10);
  const params = [];
  const where = [];
  const market = cleanText(options.market).toLowerCase();
  const session = cleanText(options.session).toLowerCase();
  const date = cleanText(options.date);
  const fromText = cleanText(options.from);
  const toText = cleanText(options.to);
  const id = cleanText(options.id);
  if (id) {
    params.push(id);
    where.push(`id = $${params.length}`);
  }
  if (market) {
    params.push(market);
    where.push(`market = $${params.length}`);
  }
  if (session) {
    params.push(session);
    where.push(`session = $${params.length}`);
  }
  if (date) {
    params.push(date);
    where.push(`briefing_date = $${params.length}::date`);
  }
  const from = sqlUtcRangeFrom(fromText);
  if (from) {
    params.push(from);
    where.push(`published_at >= $${params.length}::timestamptz`);
  }
  const to = sqlUtcRangeTo(toText);
  if (to) {
    params.push(to);
    where.push(`published_at <= $${params.length}::timestamptz`);
  }
  params.push(limit + 1, offset);
  const result = await queryKysely(
    `
      SELECT payload
      FROM market_briefings
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY briefing_date DESC, published_at DESC, position ASC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `,
    params,
  );
  const rows = await enrichBriefingCompanies(
    result.rows.map(payloadFromRow).filter(Boolean).map(publicBriefing),
  );
  const hydrated = await hydrateMarketBriefingItems(rows, {
    locale: cleanText(options.locale) || 'ko',
  });
  const pageRows = hydrated.slice(0, limit);
  const hasMore = hydrated.length > limit;
  return {
    rows: pageRows,
    total: offset + pageRows.length + (hasMore ? 1 : 0),
    limit,
    offset,
    hasMore,
    nextOffset: hasMore ? offset + pageRows.length : null,
  };
}
