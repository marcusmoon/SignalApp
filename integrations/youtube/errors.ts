/** UI에서 `t('youtubeErrorQuota')`와 매칭 */
export const YOUTUBE_ERROR_QUOTA = 'YOUTUBE_QUOTA';

export function parseYoutubeError(body: unknown): string | null {
  if (body && typeof body === 'object' && 'error' in body) {
    const e = (body as { error?: { message?: string; code?: number } }).error;
    if (e?.message) return e.message;
  }
  return null;
}

export function isYoutubeQuotaExceeded(status: number, body: unknown): boolean {
  const err =
    body && typeof body === 'object'
      ? (body as { error?: { code?: number; message?: string; errors?: Array<{ reason?: string }> } }).error
      : undefined;
  if (!err) return false;
  if (status !== 403 && err.code !== 403) return false;
  const r0 = err.errors?.[0]?.reason;
  if (r0 === 'quotaExceeded' || r0 === 'dailyLimitExceeded' || r0 === 'rateLimitExceeded') return true;
  return (err.message ?? '').toLowerCase().includes('quota');
}

export function throwYoutubeHttpError(res: Response, raw: unknown, label: string): never {
  if (isYoutubeQuotaExceeded(res.status, raw)) {
    throw new Error(YOUTUBE_ERROR_QUOTA);
  }
  const msg = parseYoutubeError(raw) ?? JSON.stringify(raw).slice(0, 200);
  throw new Error(`YouTube ${label} ${res.status}: ${msg}`);
}

export function throwYoutubeBodyError(res: Response, raw: unknown, label: string): never {
  const errMsg = parseYoutubeError(raw);
  if (errMsg) {
    if (isYoutubeQuotaExceeded(res.status, raw)) throw new Error(YOUTUBE_ERROR_QUOTA);
    throw new Error(`YouTube: ${errMsg}`);
  }
  throw new Error(`YouTube ${label}: unknown error`);
}
