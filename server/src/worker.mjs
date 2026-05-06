import { config } from './config.mjs';
import { startScheduler } from './jobs/scheduler.mjs';

console.log(`Signal worker started (sqlite=${config.sqlitePath})`);
const stopScheduler = config.schedulerEnabled
  ? startScheduler()
  : () => {};

if (!config.schedulerEnabled) {
  console.warn('[worker] scheduler disabled by SIGNAL_SCHEDULER_ENABLED=false');
}

process.on('SIGINT', () => {
  stopScheduler();
  process.exit(0);
});
