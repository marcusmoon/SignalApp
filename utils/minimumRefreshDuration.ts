/** Native RefreshControl dismiss animation needs refreshing=true for a short minimum. */
export const REFRESH_CONTROL_MIN_VISIBLE_MS = 450;

export async function delayRemainingRefreshMin(
  startedAtMs: number,
  minMs = REFRESH_CONTROL_MIN_VISIBLE_MS,
): Promise<void> {
  const remain = minMs - (Date.now() - startedAtMs);
  if (remain > 0) {
    await new Promise<void>((resolve) => setTimeout(resolve, remain));
  }
}
