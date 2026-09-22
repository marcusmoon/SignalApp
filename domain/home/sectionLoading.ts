/** A late response must not overwrite another date, locale, or newer refresh. */
export async function settleHomeSection<T>(
  request: Promise<T>,
  options: {
    isCurrent: () => boolean;
    commit: (value: T) => void;
    fail: () => void;
    finish: () => void;
  },
): Promise<void> {
  try {
    const value = await request;
    if (options.isCurrent()) options.commit(value);
  } catch {
    if (options.isCurrent()) options.fail();
  } finally {
    if (options.isCurrent()) options.finish();
  }
}
