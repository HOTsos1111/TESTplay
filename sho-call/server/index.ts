// Sho Call server entry point.
import { createApp } from './app.ts';
import { loadConfig } from './config.ts';
import { get } from './db.ts';
import { seedDemo } from './seed.ts';

const config = loadConfig();
const app = await createApp();
const users = get<{ n: number }>(app.db, 'SELECT COUNT(*) AS n FROM users')!.n;
if (users === 0 && config.demoLogin) {
  seedDemo(app.db);
  console.log('Empty database: seeded the fictional Summit Live demo (password "showcall-demo").');
}
console.log(`Sho Call server listening on ${app.url} (database ${config.databasePath})`);

const shutdown = async () => {
  await app.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
