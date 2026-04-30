/**
 * YouTube Data API calls are server-side only.
 * App code should read stored videos through `integrations/signal-api/youtube`.
 */
export function isYoutubeDataApiConfigured(): boolean {
  return false;
}

export function youtubeDataApiUrl(path: string, params: Record<string, string>): string {
  void path;
  void params;
  throw new Error('SIGNAL_API_ONLY');
}
