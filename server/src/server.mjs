import http from 'node:http';
import { getAppUserJwtConfigStatus, getAppUserJwtEnvDebugInfo } from './auth/jwtAccess.mjs';
import { config } from './config.mjs';
import { hasAdminUsers } from './db.mjs';
import { handleRequest } from './http.mjs';
import { recordHttpRequest } from './httpMetrics.mjs';
import { startScheduler } from './jobs/scheduler.mjs';

const server = http.createServer((req, res) => {
  const startedAt = Date.now();
  res.on('finish', () => {
    const elapsed = Date.now() - startedAt;
    const verySlowMs = Math.max(config.slowRequestMs, config.verySlowRequestMs);
    const level = elapsed >= verySlowMs ? 'very-slow' : elapsed >= config.slowRequestMs ? 'slow' : 'ok';
    const prefix = level === 'ok' ? '[http]' : `[http:${level}]`;
    recordHttpRequest({ method: req.method, url: req.url, statusCode: res.statusCode, elapsedMs: elapsed, level });
    if (config.httpLogAll || level !== 'ok' || res.statusCode >= 400) {
      console.log(`${prefix} ${req.method} ${req.url} ${res.statusCode} ${elapsed}ms`);
    }
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
  console.log(`Web client: http://${config.host}:${config.port}/web`);
  console.log(`SQLite DB: ${config.sqlitePath}`);
  if (String(process.env.SIGNAL_JWT_DEBUG || '').trim() === '1') {
    getAppUserJwtConfigStatus()
      .then((status) => console.log('[jwt:debug]', { ...getAppUserJwtEnvDebugInfo(), status }))
      .catch((error) => console.warn('[jwt:debug] failed to inspect JWT config:', error?.message || error));
  }
  hasAdminUsers()
    .then((exists) => {
      if (!exists) console.warn('[server] No active admin users in SQLite — /admin login will reject all credentials.');
    })
    .catch((error) => console.warn('[server] Failed to inspect admin users:', error?.message || error));
});

const stopScheduler = config.schedulerEnabled
  ? startScheduler()
  : () => {};

if (!config.schedulerEnabled) {
  console.log('[server] scheduler disabled by SIGNAL_SCHEDULER_ENABLED=false');
}

process.on('SIGINT', () => {
  stopScheduler();
  server.close(() => process.exit(0));
});
