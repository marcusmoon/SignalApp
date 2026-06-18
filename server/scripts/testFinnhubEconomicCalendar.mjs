/**
 * Finnhub economic calendar 진단.
 * 실행: cd server && FINNHUB_TOKEN=... node scripts/testFinnhubEconomicCalendar.mjs
 */
import { fetchFinnhubEconomicCalendar } from '../src/providers/calendar/finnhub.mjs';

async function main() {
  const token = String(process.env.FINNHUB_TOKEN || process.env.FINNHUB_API_KEY || '').trim();
  console.log('finnhub.hasEnvToken', Boolean(token));

  if (!token) {
    try {
      const { getProviderSetting } = await import('../src/providerSettings.mjs');
      const setting = await getProviderSetting('finnhub');
      console.log('finnhub.enabled', setting.enabled);
      console.log('finnhub.hasApiKey', Boolean(setting.apiKey));
    } catch (error) {
      console.error('provider lookup failed', error instanceof Error ? error.message : error);
      process.exitCode = 1;
      return;
    }
  } else {
    process.env.FINNHUB_TOKEN = token;
  }

  try {
    const rows = await fetchFinnhubEconomicCalendar({ daysBack: 7, daysAhead: 30 });
    console.log('rowCount', rows.length);
    const byType = rows.reduce((acc, row) => {
      acc[row.type] = (acc[row.type] || 0) + 1;
      return acc;
    }, {});
    console.log('byType', byType);
    if (rows[0]) console.log('sample', JSON.stringify(rows[0], null, 2));
    const fomc = rows.filter((row) => row.type === 'fomc' || /FOMC/i.test(row.title));
    console.log('fomcMatches', fomc.length);
    if (fomc[0]) console.log('fomcSample', JSON.stringify(fomc[0], null, 2));
  } catch (error) {
    console.error('fetch failed', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

main();
