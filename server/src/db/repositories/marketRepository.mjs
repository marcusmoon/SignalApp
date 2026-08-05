import { queryKysely } from '../kysely/client.mjs';
import {
  cleanText,
  numberSqlExpression,
  pageOptions,
  paginatedSqlRows,
  payloadFromRow,
  sqlStringList,
} from './publicHelpers.mjs';
import {
  fetchSymbolProfilesForInputs,
  resolvePublicSymbolMeta,
  symbolProfileLookupKeys,
} from './symbolProfilesRepository.mjs';

function publicMarketQuote(item) {
  return {
    id: item.id,
    provider: item.provider,
    providerItemId: item.providerItemId,
    segment: item.segment,
    symbol: item.symbol,
    displaySymbol: item.displaySymbol || item.symbol || null,
    krxSymbol: item.krxSymbol || item.rawPayload?.krxSymbol || null,
    name: item.name || null,
    currentPrice: item.currentPrice ?? null,
    change: item.change ?? null,
    changePercent: item.changePercent ?? null,
    high: item.high ?? null,
    low: item.low ?? null,
    open: item.open ?? null,
    previousClose: item.previousClose ?? null,
    marketCapitalization: item.marketCapitalization ?? null,
    quoteTime: item.quoteTime || null,
    fetchedAt: item.fetchedAt,
    sourceLabel: item.sourceLabel || null,
    official: item.official === false ? false : item.official === true ? true : null,
    notice: item.notice || null,
    afterHoursAvailable: item.afterHoursAvailable === true ? true : item.afterHoursAvailable === false ? false : null,
    regularSession: item.regularSession || null,
    symbolMeta: null,
  };
}

function publicCoinMarket(item) {
  const imageUrl =
    String(item.imageUrl || '').trim() ||
    String(item.rawPayload?.image || '').trim() ||
    null;
  return {
    id: item.id,
    provider: item.provider,
    providerItemId: item.providerItemId,
    symbol: item.symbol,
    name: item.name,
    imageUrl,
    currentPrice: item.currentPrice ?? null,
    marketCap: item.marketCap ?? null,
    change24h: item.change24h ?? null,
    changePercent24h: item.changePercent24h ?? null,
    fetchedAt: item.fetchedAt,
  };
}

export async function queryPublicMarketQuoteRows(options = {}) {
  const { limit, offset } = pageOptions(options, 30);
  const params = [];
  const where = [];
  const segment = cleanText(options.segment);
  if (segment) {
    params.push(segment);
    where.push(`segment = $${params.length}`);
  }
  const symbols = sqlStringList(options.symbols).map((s) => s.toUpperCase());
  if (symbols.length > 0) {
    params.push(symbols);
    where.push(`(
      upper(COALESCE(symbol, '')) = ANY($${params.length}::text[])
      OR upper(COALESCE(display_symbol, '')) = ANY($${params.length}::text[])
      OR upper(COALESCE(krx_symbol, '')) = ANY($${params.length}::text[])
      OR upper(COALESCE(provider_item_id, '')) = ANY($${params.length}::text[])
      OR upper(COALESCE(regular_yahoo_symbol, '')) = ANY($${params.length}::text[])
    )`);
  }
  const q = cleanText(options.q).toLowerCase();
  if (q) {
    params.push(`%${q}%`);
    where.push(`(
      lower(COALESCE(symbol, '')) LIKE $${params.length}
      OR lower(COALESCE(payload->>'name', '')) LIKE $${params.length}
      OR lower(COALESCE(segment, '')) LIKE $${params.length}
    )`);
  }
  if (symbols.length > 0 && !q) {
    const lookupParams = [symbols, segment, limit, offset];
    const result = await queryKysely(
      `
        WITH requested(symbol, ord) AS (
          SELECT * FROM unnest($1::text[]) WITH ORDINALITY
        ),
        candidates AS (
          SELECT r.symbol AS requested_symbol, r.ord, p.payload, p.fetched_at, 1 AS priority
          FROM requested r JOIN market_quotes p ON upper(COALESCE(p.symbol, '')) = r.symbol
          WHERE ($2::text = '' OR p.segment = $2)
          UNION ALL
          SELECT r.symbol AS requested_symbol, r.ord, p.payload, p.fetched_at, 2 AS priority
          FROM requested r JOIN market_quotes p ON upper(COALESCE(p.display_symbol, '')) = r.symbol
          WHERE ($2::text = '' OR p.segment = $2)
          UNION ALL
          SELECT r.symbol AS requested_symbol, r.ord, p.payload, p.fetched_at, 3 AS priority
          FROM requested r JOIN market_quotes p ON upper(COALESCE(p.krx_symbol, '')) = r.symbol
          WHERE ($2::text = '' OR p.segment = $2)
          UNION ALL
          SELECT r.symbol AS requested_symbol, r.ord, p.payload, p.fetched_at, 4 AS priority
          FROM requested r JOIN market_quotes p ON upper(COALESCE(p.provider_item_id, '')) = r.symbol
          WHERE ($2::text = '' OR p.segment = $2)
          UNION ALL
          SELECT r.symbol AS requested_symbol, r.ord, p.payload, p.fetched_at, 5 AS priority
          FROM requested r JOIN market_quotes p ON upper(COALESCE(p.regular_yahoo_symbol, '')) = r.symbol
          WHERE ($2::text = '' OR p.segment = $2)
        ),
        best AS (
          SELECT DISTINCT ON (requested_symbol) requested_symbol, ord, payload
          FROM candidates
          ORDER BY requested_symbol, priority ASC, fetched_at DESC NULLS LAST
        )
        SELECT payload
        FROM best
        ORDER BY ord ASC
        LIMIT $3 OFFSET $4
      `,
      lookupParams,
    );
    const rows = await enrichMarketQuoteRows(result.rows.map((row) => publicMarketQuote(payloadFromRow(row))).filter(Boolean));
    return {
      rows,
      total: rows.length,
      limit,
      offset,
      hasMore: false,
      nextOffset: null,
    };
  }
  const sqlLimit = symbols.length > 0 && !segment ? Math.max(limit + 1, symbols.length * 3) : limit + 1;
  params.push(sqlLimit, offset);
  const result = await queryKysely(
    `
      SELECT payload
      FROM market_quotes
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY fetched_at DESC NULLS LAST, COALESCE(segment, ''), COALESCE(symbol, '')
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `,
    params,
  );
  let rows = await enrichMarketQuoteRows(result.rows.map((row) => publicMarketQuote(payloadFromRow(row))).filter(Boolean));
  if (symbols.length > 0 && !segment) {
    const bestBySymbol = new Map();
    for (const row of rows) {
      const key = cleanText(row.krxSymbol || row.symbol).toUpperCase();
      if (!key) continue;
      const prev = bestBySymbol.get(key);
      const prevAt = prev?.fetchedAt ? Date.parse(prev.fetchedAt) : 0;
      const nextAt = row?.fetchedAt ? Date.parse(row.fetchedAt) : 0;
      if (!prev || nextAt >= prevAt) bestBySymbol.set(key, row);
    }
    rows = [...bestBySymbol.values()];
  }
  const pageRows = rows.slice(0, limit);
  const hasMore = symbols.length > 0 && !segment ? false : rows.length > limit;
  const total = offset + pageRows.length + (hasMore ? 1 : 0);
  return {
    rows: pageRows,
    total,
    limit,
    offset,
    hasMore,
    nextOffset: hasMore ? offset + pageRows.length : null,
  };
}

async function enrichMarketQuoteRows(rows = []) {
  const inputs = rows.map((row) => ({
    market: row.segment === 'korea' ? 'kr' : 'global',
    symbol: row.symbol,
    displaySymbol: row.displaySymbol,
    krxSymbol: row.krxSymbol,
    providerItemId: row.providerItemId,
  }));
  if (inputs.length === 0) return rows;
  const profiles = await fetchSymbolProfilesForInputs(inputs);
  return rows.map((row) => {
    const identity = {
      market: row.segment === 'korea' ? 'kr' : 'global',
      symbol: row.symbol,
      displaySymbol: row.displaySymbol,
      krxSymbol: row.krxSymbol,
      providerItemId: row.providerItemId,
    };
    const profile = symbolProfileLookupKeys(identity).map((key) => profiles.get(key)).find(Boolean) || null;
    return {
      ...row,
      symbolMeta: resolvePublicSymbolMeta(profile),
    };
  });
}

export async function queryPublicCoinMarketRows(options = {}) {
  const { limit, offset } = pageOptions(options, 30);
  const params = [];
  const where = [];
  const q = cleanText(options.q).toLowerCase();
  if (q) {
    params.push(`%${q}%`);
    where.push(`(
      lower(COALESCE(symbol, '')) LIKE $${params.length}
      OR lower(COALESCE(payload->>'name', '')) LIKE $${params.length}
      OR lower(COALESCE(payload->>'providerItemId', '')) LIKE $${params.length}
    )`);
  }
  params.push(limit + 1, offset);
  const result = await queryKysely(
    `
      SELECT payload
      FROM coin_markets
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY ${numberSqlExpression(`payload->>'marketCap'`)} DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `,
    params,
  );
  return paginatedSqlRows(
    result.rows.map((row) => {
      const payload = payloadFromRow(row);
      return { ...row, item: payload ? publicCoinMarket(payload) : null };
    }),
    { limit, offset },
  );
}
