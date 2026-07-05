# 알림센터 (템플릿 + 사용자 링크)

알림센터는 **서버**를 단일 진실 원천으로 한다. 알림 **본문(템플릿)** 은 `notification_items`에 공통 저장하고, 사용자별 **읽음·삭제·노출** 은 `user_notification_inbox`에만 기록한다.

## 운영 규칙

- **최대 50건**: 사용자당 inbox row는 `delivered_at` 기준 최신 50개만 유지한다. 초과분은 서버에서 hard delete.
- **등록 사용자만**: `app_users.active = true`인 계정만 lazy link·적재·발송 대상이다.
- **발송 대상**: push는 `app_user_devices`에 등록된 활성 기기를 가진 등록 사용자에게만 전달한다. 발송 성공 시 해당 사용자 inbox row를 upsert한다.
- **DB**: Flyway `V7__notification_inbox.sql` (`user_notification_inbox` 테이블).

## 구조

| 레이어 | 역할 |
|---|---|
| `notification_items` | 템플릿·발송 outbox (브로드캐스트 row 공유) |
| `user_notification_inbox` | 사용자별 `read_at`, `deleted_at`, `delivered_at` |
| 앱 `app/alerts.tsx` | `GET /v1/notifications` 단일 소스 |

## 링크 생성

**Lazy (목록 조회):** 알림 API 호출 시 노출 가능한 `notification_items` 중 미연결 row를 insert.

```sql
(app_user_id = :userId OR (target_type = 'all' AND app_user_id IS NULL))
AND (expires_at IS NULL OR expires_at > NOW())
AND status IN ('sent', 'skipped')
```

**Push 성공 후:** sender가 수신 `user_id` 목록에 inbox upsert.

**푸시 수신(앱):** `POST /v1/notifications/deliver` (`data.notificationId`).

## API

인증: `Authorization: Bearer` (앱 사용자 JWT 필수)

| Method | Path | 설명 |
|---|---|---|
| GET | `/v1/notifications` | 목록 (limit 1–50, lazy link) |
| GET | `/v1/notifications/unread-count` | 미읽음 건수 |
| PATCH | `/v1/notifications/read` | `{ "ids": [] }` 또는 `{ "all": true }` |
| DELETE | `/v1/notifications` | soft delete |
| POST | `/v1/notifications/deliver` | `{ "notificationId": "..." }` |
| POST | `/v1/notifications/test` | push 테스트 (outbox enqueue) |

목록 항목 예:

```json
{
  "id": "user123:notification:push:market_briefing:...",
  "notificationId": "notification:push:market_briefing:...",
  "type": "market_briefing",
  "title": "오전 시장 브리핑",
  "body": "...",
  "deliveredAt": "2026-07-05T08:00:00.000Z",
  "readAt": null
}
```

## 앱 연동

| 파일 | 역할 |
|---|---|
| `app/alerts.tsx` | 목록·삭제 |
| `services/alertsUnreadPreference.ts` | unread-count, read, `loadAlertsFromServer` |
| `components/NotificationListener.tsx` | deliver + 배지 |
| `integrations/signal-api/notifications.ts` | API 클라이언트 |

로컬 `@signal/notification_history_v1`, `@signal/dismissed_notification_ids_v1`는 사용하지 않는다.

## Admin

`POST /admin/api/notifications` → `notification_items` 적재. `target_type = 'user'`는 발송 후 inbox link, `all`은 lazy link.

## 시간 기준

`delivered_at`, `read_at`, `deleted_at`, `scheduled_at`, `expires_at`은 UTC ISO. [DATE-TIME.md](./DATE-TIME.md) 준수.

## 관련 파일

| 영역 | 파일 |
|---|---|
| DB | `server/db/migrations/postgres/V7__notification_inbox.sql` |
| 서버 repo | `server/src/db/repositories/notificationInboxRepository.mjs` |
| 서버 HTTP | `server/src/http/public/v1/notifications.mjs` |
| 발송 | `server/src/notifications/sender.mjs` |

## 후속 (별도 과제)

- 서버 저장 사용자 알림 설정(`notification_prefs`)
