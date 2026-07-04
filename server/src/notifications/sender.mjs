import { config } from '../config.mjs';
import {
  claimPushNotificationsForDelivery,
  resolvePushDevicesForNotification,
  updateNotificationSendState,
} from '../db.mjs';
import { nowIso } from '../db/time.mjs';

function cleanText(value) {
  return String(value || '').trim();
}

function providerName() {
  const provider = cleanText(config.notificationPushProvider).toLowerCase();
  return provider || 'mock';
}

function expoMessageFor(notification, device) {
  const payload = notification.payload && typeof notification.payload === 'object' ? notification.payload : {};
  return {
    to: device.pushToken,
    sound: 'default',
    title: notification.title || 'SIGNAL',
    body: notification.body || notification.reason || '',
    priority: notification.priority === 'high' ? 'high' : 'default',
    data: {
      notificationId: notification.id,
      type: notification.type || '',
      deepLink: notification.deepLink || '',
      sourceType: notification.sourceType || '',
      sourceId: notification.sourceId || '',
      symbols: Array.isArray(notification.symbols) ? notification.symbols : [],
      payload: {
        briefingDate: payload.briefingDate || null,
        generatedDate: payload.generatedDate || null,
        digestId: payload.digestId || null,
        category: payload.category || null,
        market: payload.market || null,
        session: payload.session || null,
      },
    },
  };
}

async function sendWithExpo(notification, devices) {
  const messages = devices.map((device) => expoMessageFor(notification, device));
  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify(messages.length === 1 ? messages[0] : messages),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const message = body?.errors?.[0]?.message || body?.error || `EXPO_PUSH_${res.status}`;
    throw new Error(message);
  }
  return {
    providerMessageId: Array.isArray(body?.data)
      ? body.data.map((item) => item?.id).filter(Boolean).join(',')
      : body?.data?.id || '',
  };
}

async function sendNotification(notification) {
  const provider = providerName();
  const devices = await resolvePushDevicesForNotification(notification);
  if (!devices.length) {
    return {
      status: 'skipped',
      provider,
      errorMessage: 'NO_ACTIVE_PUSH_DEVICE',
    };
  }
  if (provider === 'mock') {
    return {
      status: 'sent',
      provider,
      providerMessageId: `mock:${notification.id}:${devices.length}`,
    };
  }
  if (provider === 'expo') {
    const result = await sendWithExpo(notification, devices);
    return {
      status: 'sent',
      provider,
      providerMessageId: result.providerMessageId,
    };
  }
  return {
    status: 'failed',
    provider,
    errorMessage: `UNSUPPORTED_PUSH_PROVIDER:${provider}`,
  };
}

export async function processNotificationOutbox({ limit = config.notificationSenderBatchSize } = {}) {
  const provider = providerName();
  const claimed = await claimPushNotificationsForDelivery({ limit, provider });
  const summary = { claimed: claimed.length, sent: 0, failed: 0, skipped: 0 };
  for (const notification of claimed) {
    const attempts = Math.max(1, Number(notification.attempts) || 1);
    try {
      const result = await sendNotification(notification);
      if (result.status === 'sent') summary.sent += 1;
      else if (result.status === 'skipped') summary.skipped += 1;
      else summary.failed += 1;
      await updateNotificationSendState(notification.id, {
        status: result.status,
        provider: result.provider,
        providerMessageId: result.providerMessageId || null,
        errorMessage: result.errorMessage || null,
        attempts,
        sentAt: result.status === 'sent' ? nowIso() : null,
      });
    } catch (error) {
      summary.failed += 1;
      await updateNotificationSendState(notification.id, {
        status: 'failed',
        provider,
        errorMessage: error instanceof Error ? error.message : String(error),
        attempts,
      });
    }
  }
  return summary;
}

export function startNotificationSender({ intervalMs = config.notificationSenderIntervalMs } = {}) {
  if (!config.notificationSenderEnabled) {
    console.warn('[notifications] sender disabled by SIGNAL_NOTIFICATION_SENDER_ENABLED=false');
    return () => {};
  }
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const summary = await processNotificationOutbox();
      if (summary.claimed > 0) console.log('[notifications] sender tick', summary);
    } catch (error) {
      console.error('[notifications] sender tick failed', error);
    } finally {
      running = false;
    }
  };
  const id = setInterval(() => {
    tick().catch((error) => console.error('[notifications] sender interval failed', error));
  }, intervalMs);
  tick().catch((error) => console.error('[notifications] sender initial tick failed', error));
  return () => clearInterval(id);
}
