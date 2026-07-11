# 다이제스트·브리핑 출처 참조키 조회

## 방향

분석·묶음 생성 시 Codex는 `sourceRefs`에 **참조키(`type`, `id`)** 만 넣고, 앱 표시 시 서버가 canonical 테이블에서 조회해 제목·URL·출처명을 채운다.

- **뉴스** `id` → `news_items` + `news_translations` (`/v1/news`와 동일 locale 규칙)
- **공시** `id` → `disclosures`
- **외부 URL** 등 id 없음 → ingest 스냅샷 stub 유지 (v1 호환)

이렇게 하면 글로벌 뉴스도 피드와 **동일 번역**이 출처 시트에 보이고, 마켓 브리핑·오늘의 브리핑도 같은 resolver로 확장할 수 있다.

## Phase 1 (read-time hydrate)

| 구간 | 동작 |
|---|---|
| Ingest | v1 전체 스냅샷 허용 (하위 호환) |
| `GET /v1/news-digests?locale=` | `hydrateSourceRefs`로 `sourceRefs` 조회·병합 |
| `GET /v1/disclosure-digests?locale=` | 동일 (공시는 locale 무관, API 일관성용) |
| 앱 | `fetchSignal*Digests`에 `locale` 전달 |

**서버:** `server/src/sources/resolveSourceRefs.mjs`  
**저장소 조회:** `fetchPublicNewsByIds`, `fetchPublicDisclosuresByIds`

## Phase 2 (v2 ingest)

| 구간 | 동작 |
|---|---|
| Ingest | `normalizeSourceRefs` — `type`+`id`(+`relation`)만 저장. `sources[]`는 비움 |
| 내부 job | `disclosureDigest.mjs`도 ref-only 저장 |
| `GET /v1/market-briefings?locale=` | `sourceRefs` hydrate |
| `GET /v1/today-briefing(s)?locale=` | `sourceRefs` hydrate |
| v1 데이터 | read 시 기존 스냅샷 fallback 유지 |

**정규화:** `server/src/sources/normalizeSourceRefs.mjs`

Codex v2 출력 `sourceRefs` 예:

```json
{ "type": "news", "id": "codex-news:global:abc123", "relation": "primary" }
```

`title`, `url`, `sourceName`은 생략. ingest는 ref만 저장하고 read 시 hydrate.

스키마: [`docs/schemas/news-issue-digest.v2.schema.json`](./schemas/news-issue-digest.v2.schema.json)  
예시: [`docs/examples/news-issue-digest.v2.ingest.example.json`](./examples/news-issue-digest.v2.ingest.example.json)

## 후속

1. `POST /v1/source-refs/resolve` — 출처 시트 on-open 전용 (목록 payload 경량화)
2. 알림 `notification_items.sourceRefs` read-time hydrate (필요 시)
