import { checkPostgresConnectivity } from '../src/db/postgres/client.mjs';

const status = await checkPostgresConnectivity();
console.log(JSON.stringify(status, null, 2));

if (!status.ok) {
  process.exitCode = 1;
}
