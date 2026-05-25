import { db, client } from './index.js';
import { users } from './schema.js';

async function seed() {
  await db
    .insert(users)
    .values({
      name: 'Demo User',
      email: 'demo@example.com'
    })
    .onConflictDoNothing({ target: users.email });

  console.log('Seed complete');
}

seed()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end();
  });
