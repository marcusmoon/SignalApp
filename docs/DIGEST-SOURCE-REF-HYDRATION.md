# 다이제스트·브리핑 출처 참조키 조회

## 방향

분석·묶음 생성 시 Codex는 `sourceRefs`에 **참조키(`type`, `id`)** 만 넣고, 앱 표시 시 서버가 canonical 테이블에서 조회해 제목·URL·출처명을 채운다.

- **뉴스** `id` → `news_items` + `news_translations` (`/v1/news`와 동일 locale 규칙)
- **공시** `id` → `disclosures`
- **외부 URL** 등 id 없음 → ingest 스냅샷 fallback (v1 호환)

이렇게 하면 글로벌 뉴스도 피드와 **동일 번역**이 출처 시트에 보이고, 마켓 브리핑·오늘의 브리핑도 같은 resolver로 확장할 수 있다.

## 현재 구현 (Phase 1)

| 구간 | 동작 |
|---|---|
| Ingest | 기존 v1 전체 스냅샷 그대로 허용 |
| `GET /v1/news-digests?locale=` | `hydrateSourceRefs`로 `sourceRefs` 조회·병합 |
| `GET /v1/disclosure-digests?locale=` | 동일 (공시는 locale 무관, API 일관성용) |
| 앱 | `fetchSignal*Digests`에 `locale` 전달 |

**서버:** `server/src/sources/resolveSourceRefs.mjs`  
**저장소 조회:** `fetchPublicNewsByIds`, `fetchPublicDisclosuresByIds`

## v2 ingest (후속)

Codex 출력 `sourceRefs` 예:

```json
{ "type": "news", "id": "codex-news:global:abc123" }
```

`title`, `url`, `sourceName`은 생략 가능. ingest는 ref만 저장해도 read 시 hydrate.

## 후속 Phase

1. 마켓 브리핑·오늘의 브리핑 `sourceRefs` hydrate
2. `POST /v1/source-refs/resolve` — 출처 시트 on-open 전용 (목록 payload 경량화)
3. ingest 스키마 v2 + automation 프롬프트 갱신 (`docs/NEWS-ISSUE-AUTOMATION.md`)
