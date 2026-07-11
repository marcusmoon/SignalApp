/**
 * Toss Invest Open API provider smoke test.
 * 실행: cd server && TOSSINVEST_CLIENT_ID=... TOSSINVEST_CLIENT_SECRET=... node scripts/testTossInvestProvider.mjs
 */
import {
  fetchTossInvestExchangeRate,
  fetchTossInvestKrMarketCalendar,
  fetchTossInvestPrices,
  fetchTossInvestStocks,
  getTossInvestAccessToken,
  getTossInvestSetting,
} from '../src/providers/tossinvest/index.mjs';

async function main() {
  const setting = await getTossInvestSetting();
  console.log('tossinvest.enabled', setting.enabled);
  console.log('tossinvest.hasClientId', Boolean(setting.clientId));
  console.log('tossinvest.hasClientSecret', Boolean(setting.clientSecret));
  console.log('tossinvest.accountSeq', setting.accountSeq);
  console.log('tossinvest.baseUrl', setting.baseUrl);

  if (!setting.clientId || !setting.clientSecret) {
    console.error('Set TOSSINVEST_CLIENT_ID and TOSSINVEST_CLIENT_SECRET in server/.env or Admin provider-settings/tossinvest');
    process.exitCode = 1;
    return;
  }

  try {
    const token = await getTossInvestAccessToken();
    console.log('token.issued', Boolean(token));

    const prices = await fetchTossInvestPrices(['005930', 'AAPL']);
    console.log('prices.count', prices.length);
    if (prices[0]) console.log('prices.sample', JSON.stringify(prices[0], null, 2));

    const stocks = await fetchTossInvestStocks(['005930']);
    console.log('stocks.count', stocks.length);
    if (stocks[0]) console.log('stocks.sample', JSON.stringify(stocks[0], null, 2));

    const fx = await fetchTossInvestExchangeRate({ baseCurrency: 'USD', quoteCurrency: 'KRW' });
    console.log('exchangeRate', JSON.stringify(fx, null, 2));

    const calendar = await fetchTossInvestKrMarketCalendar();
    console.log('krCalendar.date', calendar?.date || null);
  } catch (error) {
    console.error('fetch failed', error instanceof Error ? error.message : error);
    if (error && typeof error === 'object' && 'code' in error) {
      console.error('code', error.code, 'status', error.status, 'requestId', error.requestId);
    }
    process.exitCode = 1;
  }
}

main();
