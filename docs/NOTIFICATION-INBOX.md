# 알림센터 (템플릿 + 사용자 링크)

알림센터는 **서버**를 단일 진실 원천으로 한다. 알림 **본문(템플릿)** 은 `notification_items`에 공통 저장하고, 사용자별 **읽음·삭제·노출** 은 `user_notification_inbox`에만 기록한다.

**알림함 적재와 기기 푸시는 분리한다.**

| 경로 | 역할 |
|---|---|
| 알림함 (inbox) | ingest 시 `status: published` — 로그인 사용자 목록에 기본 노출 (lazy link) |
| 푸시 (push) | `payload.pushDelivery: pending` 일 때만 worker sender가 발송. 사용자 `notification_prefs` 반영 |

## 운영 규칙

- **최대 50건**: 사용자당 inbox row는 `delivered_at` 기준 최신 50개만 유지한다. 초과분은 서버에서 hard delete.
- **등록 사용자만**: `app_users.active = true`인 계정만 lazy link·적재 대상이다.
- **푸시 발송**: `app_user_devices` 활성 토큰 + `app_users.notification_prefs` (`pushEnabled`, `briefingPushEnabled`)를 만족할 때만 Expo/mock sender가 전송한다.
- **DB**: Flyway `V7__notification_inbox.sql`, `V8__app_user_notification_prefs.sql`.

## 구조

| 레이어 | 역할 |
|---|---|
| `notification_items` | 템플릿 (`published`) + 푸시 배달 상태 (`payload.pushDelivery`) |
| `user_notification_inbox` | 사용자별 `read_at`, `deleted_at`, `delivered_at` |
| `app_users.notification_prefs` | 서버 푸시 필터 (`pushEnabled`, `briefingPushEnabled`) |
| 앱 `app/alerts.tsx` | `GET /v1/notifications` 단일 소스 |

### ingest (브리핑·주요이슈)

요청 본문에 **독립 플래그** 두 개만 넘긴다. 서버가 `status: published`와 `payload.pushDelivery`를 설정한다.

| 플래그 | 기본값 | 역할 |
|---|---|---|
| `notifyInbox` | `true` | `true`이면 `notification_items` upsert → 알림함 노출 |
| `sendPush` | `true` | `true`이면 `payload.pushDelivery = 'pending'` → worker 푸시 시도 |

1. 콘텐츠 저장
2. `notifyInbox=true`이면 `notification_items`에 **`published`** upsert
3. `sendPush=true`이면 `payload.pushDelivery = 'pending'`
4. `sendPush=false`이면 `pushDelivery = 'none'` (알림함만)

**조합 예:** dry-run `notifyInbox=false`, `sendPush=false` / 운영 `둘 다 true` / 알림함만 `notifyInbox=true`, `sendPush=false`.

뉴스 다이제스트는 요청 `notifyInbox`(기본 `true`)로 알림함 적재를 제어한다. 항목별 제외는 `notifyInbox: false`만 사용한다.

## 링크 생성

**Lazy (목록 조회):** 알림 API 호출 시 노출 가능한 `notification_items` 중 미연결 row를 insert.

```sql
(app_user_id = :userId OR (target_type = 'all' AND app_user_id IS NULL))
AND (expires_at IS NULL OR expires_at > NOW())
AND (scheduled_at IS NULL OR scheduled_at <= NOW())
AND status IN ('published', 'sent', 'skipped', 'queued')
```

**푸시 수신(앱, 보조):** `POST /v1/notifications/deliver` (`data.notificationId`) — 포그라운드 수신 시 deliver API.

## API

인증: `Authorization: Bearer` (앱 사용자 JWT 필수)

| Method | Path | 설명 |
|---|---|---|
| GET | `/v1/notifications` | 목록 (limit 1–50, lazy link, `filter=all\|high\|signal\|system`) |
| GET | `/v1/notifications/prefs` | 서버 푸시 설정 조회 |
| PATCH | `/v1/notifications/prefs` | `{ pushEnabled?, briefingPushEnabled? }` |
| GET | `/v1/notifications/unread-count` | 미읽음 건수 |
| PATCH | `/v1/notifications/read` | `{ "ids": [] }` 또는 `{ "all": true }` |
| DELETE | `/v1/notifications` | soft delete |
| POST | `/v1/notifications/deliver` | `{ "notificationId": "..." }` |
| POST | `/v1/notifications/test` | push 테스트 (outbox enqueue) |

## 앱 연동

| 파일 | 역할 |
|---|---|
| `app/alerts.tsx` | 목록·삭제 |
| `services/alertsUnreadPreference.ts` | unread-count, read, `loadAlertsFromServer` |
| `services/notificationPreferences.ts` | 로컬 설정 + 서버 `PATCH /prefs` 동기화 |
| `components/NotificationListener.tsx` | deliver + 배지 |
| `integrations/signal-api/notifications.ts` | API 클라이언트 |

로컬 `localMacroCalendar`는 기기 로컬 알림 전용. 서버 푸시와 무관.

## Admin

| Method | Path | 설명 |
|---|---|---|
| GET | `/admin/api/notifications` | outbox 검색 |
| GET | `/admin/api/app-users/:userId/inbox` | 사용자 인박스 |

## 시간 기준

`delivered_at`, `read_at`, `deleted_at`, `scheduled_at`, `expires_at`은 UTC ISO. [DATE-TIME.md](./DATE-TIME.md) 준수.

## 관련 파일

| 영역 | 파일 |
|---|---|
| DB | `server/db/migrations/postgres/V7__notification_inbox.sql`, `V8__app_user_notification_prefs.sql` |
| publish | `server/src/notifications/publish.mjs` |
| 서버 repo | `server/src/db/repositories/notificationInboxRepository.mjs` |
| 푸시 prefs | `server/src/notifications/notificationPreferences.mjs` |
| 발송 | `server/src/notifications/sender.mjs` |
