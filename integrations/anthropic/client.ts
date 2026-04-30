/**
 * Anthropic calls are server-side only. The app no longer reads or sends provider keys.
 */
export function isAnthropicConfigured(): boolean {
  return false;
}

export async function postAnthropicMessages(params: {
  model: string;
  system: string;
  user: string;
  maxTokens: number;
}): Promise<string> {
  void params;
  throw new Error('SIGNAL_API_ONLY');
}
