// Packages dist/ as a content-only page + assets folder for publishing as a claude.ai artifact.
// Usage: npm run build && node scripts/package-web.mjs <outDir>
import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync, readdirSync } from 'node:fs';
const out = process.argv[2];
if (!out) throw new Error('usage: node scripts/package-web.mjs <outDir>');
rmSync(`${out}/assets`, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync('dist/assets', `${out}/assets`, { recursive: true });
const src = readFileSync('dist/index.html', 'utf8');
const head = src.match(/<head>([\s\S]*)<\/head>/)[1].replace(/\s*<meta[^>]*>/g, '').replace(/\s*<title>[^<]*<\/title>/, '');
const body = src.match(/<body>([\s\S]*)<\/body>/)[1];
writeFileSync(`${out}/chick-kin.html`, `<title>Chick Kin</title>\n<style>html,body{height:100%;margin:0;background:#2a1a10;color-scheme:dark}</style>\n${head.trim()}\n${body.trim()}\n`);
console.log(JSON.stringify(Object.fromEntries(readdirSync(`${out}/assets`).sort().map((f) => [`assets/${f}`, `assets/${f}`]))));
