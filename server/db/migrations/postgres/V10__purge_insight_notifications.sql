-- Insights pipeline removed; drop legacy insight notification rows.
DELETE FROM user_notification_inbox
WHERE notification_id IN (
  SELECT id FROM notification_items
  WHERE type = 'insight_signal' OR source_type = 'insight'
);

DELETE FROM notification_items
WHERE type = 'insight_signal' OR source_type = 'insight';
