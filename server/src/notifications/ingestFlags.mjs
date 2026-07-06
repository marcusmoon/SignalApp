function hasOwnFlag(source, key) {
  return source != null && Object.prototype.hasOwnProperty.call(source, key);
}

/** Request-level: queue device push when true (default true). */
export function resolveIngestSendPush(body) {
  return body?.sendPush !== false;
}

/** Briefing ingest: inbox is request-level only (content pushCandidate is metadata). */
export function resolveBriefingIngestNotifyInbox(body) {
  if (hasOwnFlag(body, 'notifyInbox')) {
    return body.notifyInbox !== false;
  }
  return true;
}

/**
 * News digest ingest: request notifyInbox (default true). Optional per-item notifyInbox opt-out.
 * Item pushCandidate is legacy metadata only.
 */
export function resolveDigestItemNotifyInbox(body, item) {
  if (hasOwnFlag(item, 'notifyInbox')) {
    return item.notifyInbox !== false;
  }
  return resolveBriefingIngestNotifyInbox(body);
}
