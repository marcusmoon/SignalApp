import { config } from './config.mjs';
import { startScheduler } from './jobs/scheduler.mjs';

console.log(`Signal worker started (dataDir=${config.dataDir})`);
const stopScheduler = startScheduler();

process.on('SIGINT', () => {
  stopScheduler();
  process.exit(0);
});

