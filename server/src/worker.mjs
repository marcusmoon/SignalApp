import { config } from './config.mjs';
import { startScheduler } from './jobs/scheduler.mjs';
import { startNotificationSender } from './notifications/sender.mjs';

console.log(`Signal worker started (dbRuntime=sqlite requested=${config.dbDriver} sqlite=${config.sqlitePath})`);
if (config.databaseUrl) console.log('[worker] Postgres target configured (Flyway/schema target; runtime adapter pending)');
const stopScheduler = config.schedulerEnabled
  ? startScheduler()
  : () => {};
const stopNotificationSender = startNotificationSender();

if (!config.schedulerEnabled) {
  console.warn('[worker] scheduler disabled by SIGNAL_SCHEDULER_ENABLED=false');
}

process.on('SIGINT', () => {
  stopScheduler();
  stopNotificationSender();
  process.exit(0);
});
