/** 클립보드에 평문 복사. 빈 문자열이면 false. */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  const value = String(text || '');
  if (!value.trim()) return false;

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      // fall through
    }
  }

  try {
    const clipboard = await import('expo-clipboard');
    await clipboard.setStringAsync(value);
    return true;
  } catch {
    return false;
  }
}
