import { queryKysely } from '../kysely/client.mjs';
import { nowIso } from '../time.mjs';
import { normalizeNotificationPrefs } from '../../notifications/notificationPreferences.mjs';
import { cleanText } from './publicHelpers.mjs';

export async function getAppUserNotificationPrefs(userId) {
  const id = cleanText(userId);
  if (!id) return normalizeNotificationPrefs(null);
  const result = await queryKysely('SELECT notification_prefs FROM app_users WHERE id = $1 AND active = true', [id]);
  return normalizeNotificationPrefs(result.rows[0]?.notification_prefs);
}

export async function updateAppUserNotificationPrefs(userId, patch = {}) {
  const id = cleanText(userId);
  if (!id) return null;
  const current = await getAppUserNotificationPrefs(id);
  const next = normalizeNotificationPrefs({ ...current, ...patch });
  const now = nowIso();
  const result = await queryKysely(
    `
      UPDATE app_users
      SET notification_prefs = $2::jsonb, updated_at = $3
      WHERE id = $1 AND active = true
      RETURNING notification_prefs
    `,
    [id, JSON.stringify(next), now],
  );
  if (!result.rows[0]) return null;
  return normalizeNotificationPrefs(result.rows[0].notification_prefs);
}
