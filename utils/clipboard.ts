import * as Clipboard from 'expo-clipboard';

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
    const result = await Clipboard.setStringAsync(value);
    return result !== false;
  } catch {
    return false;
  }
}
