import { getDatabaseUrl } from '../lib/env';
import { demoLoads } from '../lib/mock';

function main() {
  const url = getDatabaseUrl();
  console.log('Seeding Clyde demo data...');
  console.log(`Using database: ${url.slice(0, 20)}...`);
  console.log(`Would seed ${demoLoads.length} demo loads.`);
  console.log('Seed complete (demo seed script).');
}

main();
