import * as Clipboard from 'expo-clipboard';

/** 클립보드에 평문 복사. 빈 문자열이면 false. */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  const value = String(text || '');
  if (!value.trim()) return false;
  try {
    await Clipboard.setStringAsync(value);
    return true;
  } catch {
    return false;
  }
}
