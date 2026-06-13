import { useEffect, useState } from 'react';

import { fetchSignalRuntimeConfig } from '@/integrations/signal-api/config';
import { hasSignalApi } from '@/services/env';

const CACHE_TTL_MS = 5 * 60 * 1000;

let cachedEnabled = false;
let cachedAt = 0;
let inFlight: Promise<boolean> | null = null;

export async function loadAdsEnabled(): Promise<boolean> {
  if (!hasSignalApi()) return false;
  const now = Date.now();
  if (now - cachedAt < CACHE_TTL_MS) return cachedEnabled;
  if (!inFlight) {
    inFlight = fetchSignalRuntimeConfig()
      .then((config) => config.features?.ads?.enabled !== false)
      .then((enabled) => {
        cachedEnabled = enabled;
        cachedAt = Date.now();
        return enabled;
      })
      .catch(() => {
        cachedAt = Date.now();
        cachedEnabled = false;
        return false;
      })
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}

export function useAdsEnabled(): boolean {
  const [enabled, setEnabled] = useState(cachedEnabled);

  useEffect(() => {
    let cancelled = false;
    loadAdsEnabled().then((next) => {
      if (!cancelled) setEnabled(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return enabled;
}
