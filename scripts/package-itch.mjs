// Numbered itch.io build: bumps build-number.txt, builds with that number shown
// on the title screen, and zips dist/ as HomewardHound_Build_###.zip.
//   node scripts/package-itch.mjs [outDir]   (default: releases/)
//   Windows example: node scripts/package-itch.mjs "G:\My Drive\PARODEE GAMES\GAMES\Homeward Hound\HH_BUILDS"
import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { zipDir } from './zip-dir.mjs';

const root = resolve(import.meta.dirname, '..');
const counter = resolve(root, 'build-number.txt');
const n = Number(readFileSync(counter, 'utf8').trim() || '0') + 1;
const tag = String(n).padStart(3, '0');
const outDir = resolve(process.argv[2] ?? resolve(root, 'releases'));
mkdirSync(outDir, { recursive: true });
execSync('npx tsc --noEmit && npx vite build', { cwd: root, stdio: 'inherit', env: { ...process.env, HH_BUILD: tag } });
const zip = resolve(outDir, `HomewardHound_Build_${tag}.zip`);
rmSync(zip, { force: true });
zipDir(resolve(root, 'dist'), zip);
writeFileSync(counter, `${n}\n`);
console.log(zip);
