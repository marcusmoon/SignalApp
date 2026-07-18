-- Clear legacy ETF briefing rows before the weekly contract relaunch.
DELETE FROM user_notification_inbox
WHERE notification_id IN (
  SELECT id FROM notification_items
  WHERE type = 'etf_insight' OR source_type = 'etf_insight'
);

DELETE FROM notification_items
WHERE type = 'etf_insight' OR source_type = 'etf_insight';

DELETE FROM etf_insights;
