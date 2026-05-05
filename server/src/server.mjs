import http from 'node:http';
import { config } from './config.mjs';
import { hasAdminUsers } from './db.mjs';
import { handleRequest } from './http.mjs';
import { startScheduler } from './jobs/scheduler.mjs';

const server = http.createServer((req, res) => {
  const startedAt = Date.now();
  res.on('finish', () => {
    const elapsed = Date.now() - startedAt;
    console.log(`${req.method} ${req.url} ${res.statusCode} ${elapsed}ms`);
  });
  handleRequest(req, res).catch((error) => {
    console.error('[server] unhandled request error', error);
    res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'INTERNAL_ERROR' }));
  });
});

server.listen(config.port, config.host, () => {
  console.log(`Signal server listening on http://${config.host}:${config.port}`);
  console.log(`Admin: http://${config.host}:${config.port}/admin`);
  console.log(`SQLite DB: ${config.sqlitePath}`);
  hasAdminUsers()
    .then((exists) => {
      if (!exists) console.warn('[server] No active admin users in SQLite — /admin login will reject all credentials.');
    })
    .catch((error) => console.warn('[server] Failed to inspect admin users:', error?.message || error));
});

const stopScheduler = startScheduler();

process.on('SIGINT', () => {
  stopScheduler();
  server.close(() => process.exit(0));
});
