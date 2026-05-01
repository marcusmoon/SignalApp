import { signalApi } from '@/integrations/signal-api/client';
import type { SignalApiStockCandles, SignalApiStockProfile } from '@/integrations/signal-api/types';

export async function fetchSignalStockProfile(symbol: string): Promise<SignalApiStockProfile | null> {
  const sym = symbol.trim().toUpperCase();
  if (!sym) return null;
  try {
    const json = await signalApi<{ data: SignalApiStockProfile }>('/v1/stock-profile', { symbol: sym });
    return json.data ?? null;
  } catch {
    return null;
  }
}

export async function fetchSignalStockCandles(
  symbol: string,
  resolution: string,
  from: Date,
  to: Date,
): Promise<SignalApiStockCandles | null> {
  const sym = symbol.trim().toUpperCase();
  if (!sym) return null;
  const fromU = Math.floor(from.getTime() / 1000);
  const toU = Math.floor(to.getTime() / 1000);
  if (!Number.isFinite(fromU) || !Number.isFinite(toU)) return null;
  try {
    const json = await signalApi<{ data: SignalApiStockCandles }>('/v1/stock-candles', {
      symbol: sym,
      resolution,
      from: fromU,
      to: toU,
    });
    const data = json.data;
    if (!data || data.s !== 'ok') return null;
    return data;
  } catch {
    return null;
  }
}
