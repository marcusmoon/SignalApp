# 알림센터 인박스 (템플릿 + 사용자 링크)

알림센터는 **서버 인박스**를 단일 진실 원천으로 한다. 알림 **본문(템플릿)** 은 공통으로 두고, 사용자별 **읽음·삭제·노출** 은 `user_notification_inbox`에만 기록한다.

## 운영 규칙

- **최대 50건**: 사용자당 인박스 row는 `delivered_at` 기준 최신 50개만 유지한다. 초과분은 서버에서 hard delete.
- **등록 사용자만**: `app_users.active = true`인 계정만 lazy link·적재·발송 대상이다. 비활성/미등록 계정은 inbox API·push 대상에서 제외.
- **발송 대상**: push는 `app_user_devices`에 등록된 활성 기기를 가진 등록 사용자에게만 전달한다. 발송 성공 시 해당 사용자 inbox row를 upsert한다.

## 현재 vs 목표

| | 현재 | 목표 |
|---|---|---|
| 본문 | `notification_items` (outbox + 공개 조회 혼용) | `notification_items` = **템플릿·발송 outbox** (유지) |
| 사용자 상태 | AsyncStorage `dismissed_ids`, `last_seen_at` | `user_notification_inbox` (`read_at`, `deleted_at`) |
| 삭제 | 기기 로컬 숨김 | 인박스 soft delete → 기기 간 동기화 |
| 목록 | 서버 broadcast + 로컬 push history merge | **인박스 API 단일 응답** |
| 배지 | 로컬 newest vs last_seen | 서버 `read_at IS NULL` 건수 |

## 데이터 모델

### 1. `notification_items` (기존 — 역할 명확화)

발송 outbox이자 **알림 템플릿 마스터**로 유지한다. 브로드캐스트(`target_type = 'all'`)는 row 하나를 모든 사용자가 공유한다.

주요 컬럼: `id`, `type`, `channel`, `priority`, `title`, `source_type`, `source_id`, `target_type`, `target_key`, `scheduled_at`, `expires_at`, `payload` (`body`, `deepLink` 등).

### 2. `user_notification_inbox` (신규)

사용자별 인박스 링크. 본문은 `notification_items`에 JOIN한다.

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | text PK | `{user_id}:{notification_id}` |
| `user_id` | text FK → `app_users` | 수신 사용자 |
| `notification_id` | text FK → `notification_items` | 템플릿/outbox row |
| `delivered_at` | timestamptz | 푸시·인앱 최초 전달 시각 |
| `read_at` | timestamptz NULL | 읽음 처리 시각 |
| `deleted_at` | timestamptz NULL | 사용자 삭제(soft) |
| `created_at` | timestamptz | row 생성 |
| `updated_at` | timestamptz | 마지막 갱신 |

제약: `UNIQUE (user_id, notification_id)`

인덱스:

- `(user_id, deleted_at, delivered_at DESC)` — 목록
- `(user_id, read_at)` WHERE `deleted_at IS NULL` — 미읽음 배지

### 3. 링크 생성 시점 (lazy + push)

**Lazy (목록 조회):** 사용자가 인박스 API를 호출할 때, 해당 사용자에게 **노출 가능한** `notification_items` 중 아직 inbox row가 없는 것을 `INSERT … ON CONFLICT DO NOTHING`으로 생성한다.

노출 가능 조건:

```sql
(app_user_id = :userId OR (target_type = 'all' AND app_user_id IS NULL))
AND (expires_at IS NULL OR expires_at > NOW())
AND status IN ('sent', 'queued', 'skipped')  -- 발송 완료 또는 in_app 전용
```

**Push 성공 후:** sender가 `notificationId`를 payload에 실어 보낸 뒤, 수신 대상 사용자에 대해 inbox row를 upsert한다 (브로드캐스트는 lazy 유지 — 전 사용자 fan-out 금지).

**푸시 수신(앱):** `NotificationListener`가 `data.notificationId`로 `POST /v1/notifications/inbox/deliver`를 호출해 `delivered_at`만 갱신한다.

## API 계약

Base path: `/v1/notifications/inbox`  
인증: `Authorization: Bearer` (앱 사용자 JWT 필수)

### `GET /v1/notifications/inbox`

인박스 목록. 조회 시 lazy link 실행.

Query:

| param | 기본 | 설명 |
|---|---|---|
| `limit` | 50 | 1–50 (고정 상한) |
| `cursor` | — | `delivered_at` + `id` 기반 opaque cursor |
| `filter` | `all` | `all` \| `high` \| `signal` \| `system` (서버 또는 앱 domain 필터) |

Response `data[]` 항목:

```json
{
  "id": "inbox:user123:notification:push:market_briefing:...",
  "notificationId": "notification:push:market_briefing:...",
  "type": "market_briefing",
  "priority": "normal",
  "title": "오전 시장 브리핑",
  "body": "...",
  "sourceType": "market_briefing",
  "sourceId": "market-briefing:2026-07-05:kr:am",
  "deepLink": "/(tabs)/signal",
  "deliveredAt": "2026-07-05T08:00:00.000Z",
  "readAt": null,
  "payload": {}
}
```

정렬: `delivered_at DESC`, `id DESC`.  
`deleted_at IS NOT NULL` row는 목록에서 제외.

### `GET /v1/notifications/inbox/unread-count`

미읽음 건수 (`read_at IS NULL AND deleted_at IS NULL`). 탭 배지용.

### `PATCH /v1/notifications/inbox/read`

Body: `{ "ids": ["inbox:..."] }` 또는 `{ "all": true }`  
효과: `read_at = NOW()` (이미 read/deleted면 no-op).

### `DELETE /v1/notifications/inbox`

Body: `{ "ids": ["inbox:..."] }` 또는 `{ "all": true }`  
효과: `deleted_at = NOW()` (soft delete).

### `POST /v1/notifications/inbox/deliver`

Body: `{ "notificationId": "notification:push:..." }`  
효과: inbox row upsert + `delivered_at` 설정. 푸시 수신·딥링크 진입 시 호출.

### 레거시

`GET /v1/notifications` — Phase 2까지 유지, Phase 3에서 제거.  
앱은 Phase 1부터 inbox API 우선 사용.

## 발송 파이프라인 (변경 최소)

1. ingest/automation → `createNotificationItem` (변경 없음)
2. worker sender → Expo push (변경 없음)
3. **추가:** `target_type = 'user'` 발송 성공 시 해당 user inbox upsert
4. **추가:** push payload `data.notificationId` = `notification_items.id` (이미 전달 중이면 유지)

`in_app` channel 전용 알림은 push 없이 sent 처리 후 lazy link만으로 인박스 노출 가능.

## 앱 전환 순서

### Phase 0 — 문서·스키마 (현재)

- Flyway `V7__notification_inbox.sql`
- 본 문서

### Phase 1 — 서버 API (완료)

- `server/src/db/repositories/notificationInboxRepository.mjs`
- `server/src/http/public/v1/notifications.mjs` — inbox CRUD + legacy `GET /v1/notifications`
- `integrations/signal-api/notifications.ts`
- `server/src/notifications/sender.mjs` — 발송 성공 시 inbox upsert

### Phase 2 — 앱 인박스 (완료)

| 파일 | 변경 |
|---|---|
| `app/alerts.tsx` | `fetchSignalNotificationInbox` 단일 소스, 삭제/전체삭제 → inbox API |
| `services/alertsUnreadPreference.ts` | inbox unread-count·read, `loadAlertsFromInbox` |
| `components/NotificationListener.tsx` | deliver API만, 로컬 history append 제거 |
| `services/notificationHistory.ts` | `StoredNotification` 타입만 유지 |

제거됨:

- `@signal/notification_history_v1` 로컬 목록
- `@signal/dismissed_notification_ids_v1`
- 서버+로컬 merge 로직

### Phase 3 — 정리

- `GET /v1/notifications` 제거
- 로컬 `notification_history_v1` 제거 (또는 미로그인·오프라인 전용으로 축소)
- 서버 사용자 알림 설정(`notification_prefs`) 저장 검토 — 별도 과제

## 비로그인

알림센터는 로그인 필수 유지. 비로그인 시 현재와 동일하게 로그인 유도 UI.

## Admin

Admin 알림 생성(`POST /admin/api/notifications`)은 기존처럼 `notification_items`에 적재.  
`target_type = 'user'`면 발송 후 inbox link 자동 생성.  
`target_type = 'all'`이면 lazy link.

## 관련 파일

| 영역 | 파일 |
|---|---|
| 앱 화면 | `app/alerts.tsx` |
| 앱 domain | `domain/alerts/notificationCategory.ts`, `alertNavigation.ts` |
| 앱 서비스 | `services/alertsUnreadPreference.ts`, `services/notificationHistory.ts` |
| 서버 outbox | `server/src/notifications/outbox.mjs`, `sender.mjs` |
| 서버 repo | `server/src/db/repositories/notificationsRepository.mjs` |
| DB | `V7__notification_inbox.sql` |

## 시간 기준

`delivered_at`, `read_at`, `deleted_at`, `scheduled_at`, `expires_at`은 UTC ISO. [DATE-TIME.md](./DATE-TIME.md) 준수.
