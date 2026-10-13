// Creates a local account from the command line (for the first owner when the
// demo seed is disabled).
//   npm run user:create -- --email you@example.com --name "Your Name" --password "at-least-10-chars"
import { parseArgs } from 'node:util';
import { loadConfig } from './config.ts';
import { openDb } from './db.ts';
import { createUser, findUserByEmail } from './auth.ts';

const { values } = parseArgs({ options: { email: { type: 'string' }, name: { type: 'string' }, password: { type: 'string' } } });
if (!values.email || !values.name || !values.password || values.password.length < 10) {
  console.error('Usage: npm run user:create -- --email <email> --name <name> --password <at least 10 characters>');
  process.exit(1);
}
const config = loadConfig();
const db = openDb(config.databasePath);
if (findUserByEmail(db, values.email)) {
  console.error(`An account for ${values.email} already exists.`);
  process.exit(1);
}
const user = createUser(db, values.email, values.name, values.password);
db.close();
console.log(`Created ${user.name} <${user.email}>. Sign in and use Create show; you will be its owner.`);
