import { config } from './config.mjs';
import { startScheduler } from './jobs/scheduler.mjs';
import { startNotificationSender } from './notifications/sender.mjs';

console.log(`Signal worker started (dbRuntime=postgres configured=${Boolean(config.databaseUrl)})`);
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
