import { tossInvestRequest } from './client.mjs';

/** @returns {Promise<Array<object>>} */
export async function fetchTossInvestAccounts() {
  const result = await tossInvestRequest('/api/v1/accounts');
  return Array.isArray(result) ? result : [];
}

/** @returns {Promise<object|null>} */
export async function fetchTossInvestHoldings({ symbol = null, accountSeq = null } = {}) {
  return tossInvestRequest('/api/v1/holdings', {
    account: true,
    accountSeq,
    params: { symbol: symbol ? String(symbol).trim() : undefined },
  });
}
