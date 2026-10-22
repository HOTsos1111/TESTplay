// Numbered itch.io build: bumps build-number.txt, builds with that number shown
// on the title screen, and zips dist/ as HomewardHound_Build_###.zip.
//   node scripts/package-itch.mjs [outDir]   (default: releases/)
//   Windows example: node scripts/package-itch.mjs "G:\My Drive\PARODEE GAMES\GAMES\Homeward Hound\HH_BUILDS"
import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const counter = resolve(root, 'build-number.txt');
const n = Number(readFileSync(counter, 'utf8').trim() || '0') + 1;
const tag = String(n).padStart(3, '0');
const outDir = resolve(process.argv[2] ?? resolve(root, 'releases'));
mkdirSync(outDir, { recursive: true });
execSync('npx tsc --noEmit && npx vite build', { cwd: root, stdio: 'inherit', env: { ...process.env, HH_BUILD: tag } });
const zip = resolve(outDir, `HomewardHound_Build_${tag}.zip`);
rmSync(zip, { force: true });
if (process.platform === 'win32') {
  // Windows has no zip command: use PowerShell's built-in archiver (index.html stays at the zip root).
  execSync(`powershell -NoProfile -Command "Compress-Archive -Path '${resolve(root, 'dist')}\\*' -DestinationPath '${zip}' -Force"`, { stdio: 'inherit' });
} else {
  execSync(`zip -qr "${zip}" .`, { cwd: resolve(root, 'dist'), stdio: 'inherit' });
}
writeFileSync(counter, `${n}\n`);
console.log(zip);
