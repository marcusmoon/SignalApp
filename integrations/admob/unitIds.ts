/**
 * AdMob unit IDs from env — **this file is the only place** in this integration that reads
 * `env.admobNativeUnitId` / `env.admobBannerUnitId`. Native/web entrypoints resolve fallbacks on top of these.
 */
import { env } from '@/services/env';

export function configuredNativeAdUnitId(): string {
  return env.admobNativeUnitId.trim();
}

export function configuredBannerAdUnitId(): string {
  return env.admobBannerUnitId.trim();
}
