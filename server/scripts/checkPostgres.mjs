import { checkKyselyConnectivity } from '../src/db/kysely/client.mjs';

const status = await checkKyselyConnectivity();
console.log(JSON.stringify(status, null, 2));

if (!status.ok) {
  process.exitCode = 1;
}
