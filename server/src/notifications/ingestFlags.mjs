function hasOwnFlag(source, key) {
  return source != null && Object.prototype.hasOwnProperty.call(source, key);
}

/** Request-level: upsert notification_items when true (default true). */
export function resolveIngestNotifyInbox(body) {
  if (hasOwnFlag(body, 'notifyInbox')) {
    return body.notifyInbox !== false;
  }
  return true;
}

/** Request-level: queue device push when true (default true). */
export function resolveIngestSendPush(body) {
  return body?.sendPush !== false;
}

/** News digest item: optional per-item notifyInbox opt-out. */
export function resolveDigestItemNotifyInbox(body, item) {
  if (hasOwnFlag(item, 'notifyInbox')) {
    return item.notifyInbox !== false;
  }
  return resolveIngestNotifyInbox(body);
}
