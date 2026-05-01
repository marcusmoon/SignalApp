# Signal Local API Server

Local-first Signal API server for collecting external provider data, normalizing it into Signal-shaped JSON stores, and serving both the mobile app and admin console.

For the full Korean operations guide, see [`../docs/SERVER.md`](../docs/SERVER.md).

## Run

From the repository root:

```bash
cp server/.env.example server/.env
npm run server:dev
```

Open:

- API health: `http://127.0.0.1:4000/health`
- Admin: `http://127.0.0.1:4000/admin`
- OpenAPI: `http://127.0.0.1:4000/openapi.json`
- Docs: `http://127.0.0.1:4000/docs`

Admin login is configured only through `ADMIN_USERS` in `server/.env`:

```env
ADMIN_USERS=[{"id":"dev","password":"change-me"}]
```

## Environment

Provider keys can be seeded from env, but normal local operation should use Admin settings.

- `FINNHUB_TOKEN`
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `YOUTUBE_API_KEY`
- `NINJAS_KEY`

Translation defaults:

- `TRANSLATION_PROVIDER=mock|openai|claude`
- `TRANSLATION_MODEL=...`

## Source Split

- `src/server.mjs`: API + admin + scheduler for local MVP.
- `src/worker.mjs`: scheduler-only future entrypoint.
- `src/http/`: public/admin HTTP routes split by domain.
- `src/jobs/runner.mjs`: executes one polling or translation job.
- `src/jobs/scheduler.mjs`: finds due jobs and calls the runner.
- `src/providers/`: external providers and normalization.

`npm run server:worker` is a future split-process entrypoint. Do not run it together with `server:dev` until an operational lock exists.

## Persistence

Data is split by domain under `server/data/`:

- `settings.json`: app settings, provider settings, translation settings, UI model presets, news source settings.
- `jobs.json`: polling jobs and run history.
- `news.json`: news items and translations, including hashtags.
- `calendar.json`: macro/earnings calendar events.
- `concalls.json`: concall transcripts.
- `youtube.json`: YouTube videos.
- `market.json`: market quotes, coin markets, market lists.

Older `server/data/local-db.json` is read once and migrated into the split files.
