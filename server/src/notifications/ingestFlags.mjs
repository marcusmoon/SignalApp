function hasOwnFlag(source, key) {
  return source != null && Object.prototype.hasOwnProperty.call(source, key);
}

/** Request-level: queue device push when true (default true). */
export function resolveIngestSendPush(body) {
  return body?.sendPush !== false;
}

/**
 * Whether to upsert notification_items for inbox.
 * Request-level `notifyInbox` wins when present; else per-item `pushCandidate` (legacy).
 */
export function resolveIngestNotifyInbox(body, item) {
  if (hasOwnFlag(body, 'notifyInbox')) {
    return body.notifyInbox !== false;
  }
  if (hasOwnFlag(item, 'pushCandidate')) {
    return item.pushCandidate !== false;
  }
  return true;
}

/** Briefing ingest: inbox is request-level only (content pushCandidate is metadata). */
export function resolveBriefingIngestNotifyInbox(body) {
  if (hasOwnFlag(body, 'notifyInbox')) {
    return body.notifyInbox !== false;
  }
  return true;
}
