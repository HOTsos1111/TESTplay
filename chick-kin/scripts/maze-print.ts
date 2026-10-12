import { braidedMaze } from '../src/data/levels/kit';
const [w, h, seed] = process.argv.slice(2).map(Number);
console.log(braidedMaze(w, h, seed, { braid: 0.8, extraOpen: 4, lowWalls: 0.14, clearing: [w - 2, h - 2, w + 2, h], startRow: true }).join('\n'));
