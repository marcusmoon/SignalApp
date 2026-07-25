-- Inbox delete is hard-delete; remove legacy soft-deleted rows.
DELETE FROM user_notification_inbox WHERE deleted_at IS NOT NULL;
