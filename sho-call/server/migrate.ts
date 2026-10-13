// Applies pending SQL migrations to the configured database.
import { loadConfig } from './config.ts';
import { openDb, migrate } from './db.ts';

const config = loadConfig();
const db = openDb(config.databasePath); // openDb migrates on open
const extra = migrate(db);
console.log(`Database ${config.databasePath} is up to date${extra.length ? ` (applied ${extra.join(', ')})` : ''}.`);
db.close();
