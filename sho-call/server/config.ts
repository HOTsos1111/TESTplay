// Runtime configuration from environment variables (see .env.example).
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function loadDotEnv() {
  const file = resolve(process.cwd(), '.env');
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^"(.*)"$/, '$1');
  }
}

export interface Config {
  port: number;
  databasePath: string;
  allowedOrigins: string[];
  cookieSecure: boolean;
  demoLogin: boolean;
  production: boolean;
}

export function loadConfig(): Config {
  loadDotEnv();
  const env = process.env;
  return {
    port: Number(env.PORT ?? 8787),
    databasePath: env.DATABASE_PATH ?? './data/sho-call.db',
    allowedOrigins: (env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean),
    cookieSecure: env.COOKIE_SECURE === 'true',
    demoLogin: env.DEMO_LOGIN !== 'false',
    production: env.NODE_ENV === 'production',
  };
}
