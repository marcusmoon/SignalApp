import { tossInvestRequest } from './client.mjs';

/** @returns {Promise<object|null>} */
export async function fetchTossInvestBuyingPower({ currency, accountSeq = null } = {}) {
  const code = String(currency || '').trim();
  if (!code) throw new Error('TOSSINVEST_CURRENCY_REQUIRED');
  return tossInvestRequest('/api/v1/buying-power', {
    account: true,
    accountSeq,
    params: { currency: code },
  });
}

/** @returns {Promise<object|null>} */
export async function fetchTossInvestSellableQuantity(symbol, { accountSeq = null } = {}) {
  const sym = String(symbol || '').trim();
  if (!sym) throw new Error('TOSSINVEST_SYMBOL_REQUIRED');
  return tossInvestRequest('/api/v1/sellable-quantity', {
    account: true,
    accountSeq,
    params: { symbol: sym },
  });
}

/** @returns {Promise<object|null>} */
export async function fetchTossInvestCommissions({ accountSeq = null } = {}) {
  return tossInvestRequest('/api/v1/commissions', { account: true, accountSeq });
}

/** @returns {Promise<object|null>} */
export async function fetchTossInvestOrders(params = {}) {
  const status = String(params.status || '').trim();
  if (!status) throw new Error('TOSSINVEST_ORDER_STATUS_REQUIRED');
  return tossInvestRequest('/api/v1/orders', {
    account: true,
    accountSeq: params.accountSeq ?? null,
    params: {
      status,
      symbol: params.symbol ? String(params.symbol).trim() : undefined,
      from: params.from || undefined,
      to: params.to || undefined,
      cursor: params.cursor || undefined,
      limit: params.limit ?? undefined,
    },
  });
}

/** @returns {Promise<object|null>} */
export async function fetchTossInvestOrder(orderId, { accountSeq = null } = {}) {
  const id = String(orderId || '').trim();
  if (!id) throw new Error('TOSSINVEST_ORDER_ID_REQUIRED');
  return tossInvestRequest(`/api/v1/orders/${encodeURIComponent(id)}`, {
    account: true,
    accountSeq,
  });
}

/** @returns {Promise<object|null>} */
export async function createTossInvestOrder(body, { accountSeq = null } = {}) {
  if (!body || typeof body !== 'object') throw new Error('TOSSINVEST_ORDER_BODY_REQUIRED');
  return tossInvestRequest('/api/v1/orders', {
    method: 'POST',
    account: true,
    accountSeq,
    body,
  });
}

/** @returns {Promise<object|null>} */
export async function modifyTossInvestOrder(orderId, body, { accountSeq = null } = {}) {
  const id = String(orderId || '').trim();
  if (!id) throw new Error('TOSSINVEST_ORDER_ID_REQUIRED');
  if (!body || typeof body !== 'object') throw new Error('TOSSINVEST_ORDER_BODY_REQUIRED');
  return tossInvestRequest(`/api/v1/orders/${encodeURIComponent(id)}/modify`, {
    method: 'POST',
    account: true,
    accountSeq,
    body,
  });
}

/** @returns {Promise<object|null>} */
export async function cancelTossInvestOrder(orderId, body = {}, { accountSeq = null } = {}) {
  const id = String(orderId || '').trim();
  if (!id) throw new Error('TOSSINVEST_ORDER_ID_REQUIRED');
  return tossInvestRequest(`/api/v1/orders/${encodeURIComponent(id)}/cancel`, {
    method: 'POST',
    account: true,
    accountSeq,
    body,
  });
}
