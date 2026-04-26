# Signal Local API Server

Local-first server for polling external APIs, storing Signal-shaped data, and serving the mobile app/admin.

## Run

```bash
cd server
cp .env.example .env
npm run dev
```

Open:

- API health: `http://127.0.0.1:4000/health`
- Admin: `http://127.0.0.1:4000/admin`

Default local admin is `admin` / `signal-local` unless changed in `server/.env`.

## Worker Split

The source is already split for a future dedicated worker:

- `src/jobs/runner.mjs`: executes one polling or translation job.
- `src/jobs/scheduler.mjs`: finds due jobs and calls the runner.
- `src/server.mjs`: API + admin + scheduler for local MVP.
- `src/worker.mjs`: scheduler-only entrypoint for a future separate process.

For now, `npm run dev` starts the scheduler inside the API server. Later cloud deployment can run `npm run start` and `npm run worker` as separate services after DB locking is added.

## Shape

- `news_items`: original provider news normalized into Signal fields.
- `news_translations`: locale-specific title/summary/content, editable by admin.
- `calendar_events`: earnings/macro events normalized into Signal fields.
- `polling_jobs`: enabled/interval/provider/params for periodic ingestion.
- `translation_settings`: provider/model/autotranslate per target locale.

This MVP uses `server/data/local-db.json` for local persistence. It is intentionally shaped like tables so it can move to Postgres later.
