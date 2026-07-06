const DEFAULT_PREFS = {
  pushEnabled: true,
  briefingPushEnabled: true,
};

export function normalizeNotificationPrefs(raw) {
  const value = raw && typeof raw === 'object' ? raw : {};
  return {
    pushEnabled: typeof value.pushEnabled === 'boolean' ? value.pushEnabled : DEFAULT_PREFS.pushEnabled,
    briefingPushEnabled:
      typeof value.briefingPushEnabled === 'boolean' ? value.briefingPushEnabled : DEFAULT_PREFS.briefingPushEnabled,
  };
}

export function shouldDeliverPushToUser(type, sourceType, prefs) {
  const normalized = normalizeNotificationPrefs(prefs);
  if (!normalized.pushEnabled) return false;

  const normalizedType = String(type || '').trim().toLowerCase();
  const normalizedSource = String(sourceType || '').trim().toLowerCase();

  const isBriefingPush =
    normalizedType === 'market_briefing' ||
    normalizedSource === 'market_briefing' ||
    normalizedType === 'today_briefing' ||
    normalizedSource === 'today_briefing' ||
    normalizedType === 'news_digest' ||
    normalizedSource === 'news_digest';
  if (isBriefingPush) return normalized.briefingPushEnabled;

  return true;
}
