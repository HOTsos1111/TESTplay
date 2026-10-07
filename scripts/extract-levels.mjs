// Cuts every labelled piece out of the nine level asset guides
// (art-src/levels/HH_L0n_*.webp) into public/levels/l0n/<code>.webp.
//
// Each guide is a 4x4 grid of pieces on white, each with a printed label
// underneath. Labels are found as wide, short ink blobs; every other blob of
// art is given to the nearest label below it in the same row, so multi-part
// pieces (stone piles, shell volleys) stay together. The white page is removed
// by flooding in from the crop edges only, so white inside the art (eyes, the
// goose, cream highlights) is kept.
//   node scripts/extract-levels.mjs [preview-dir]
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

/** Grid order of the codes on every sheet (row by row). */
const CODES = ['a1', 'e1', 'e2', 'b1', 'h1', 'h2', 'h3', 'p1', 'p2', 'p3', 'fg1', 'fg2', 'mg1', 'mg2', 'bg1', 'bg2'];
const preview = process.argv[2];

const sheets = readdirSync('art-src/levels')
  .map((f) => /^HH_L0(\d)_.*\.webp$/.exec(f))
  .filter(Boolean)
  .map((m) => ({ n: Number(m[1]), url: `data:image/webp;base64,${readFileSync(`art-src/levels/${m[0]}`).toString('base64')}` }))
  .sort((a, b) => a.n - b.n);

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage();
const sizes = {};
for (const sheet of sheets) {
  const res = await page.evaluate(
    async ({ url, CODES, wantPreview }) => {
      const im = new Image();
      im.src = url;
      await im.decode();
      const W = im.width;
      const H = im.height;
      const cv = document.createElement('canvas');
      cv.width = W;
      cv.height = H;
      const c = cv.getContext('2d', { willReadFrequently: true });
      c.drawImage(im, 0, 0);
      const d = c.getImageData(0, 0, W, H).data;
      // Ink = anything clearly off-white.
      const ink = new Uint8Array(W * H);
      for (let p = 0; p < W * H; p++) {
        const r = d[p * 4];
        const g = d[p * 4 + 1];
        const b = d[p * 4 + 2];
        if (255 * 3 - r - g - b > 36) ink[p] = 1;
      }
      // Blobs on a dilated ink mask (merges letters of a label, parts of a drawing).
      const R = 5;
      const dil = new Uint8Array(W * H);
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          if (!ink[y * W + x]) continue;
          for (let dy = -2; dy <= 2; dy++) {
            const yy = y + dy;
            if (yy < 0 || yy >= H) continue;
            for (let dx = -R; dx <= R; dx++) {
              const xx = x + dx;
              if (xx >= 0 && xx < W) dil[yy * W + xx] = 1;
            }
          }
        }
      const lab = new Int32Array(W * H).fill(-1);
      const blobs = [];
      for (let s = 0; s < W * H; s++) {
        if (!dil[s] || lab[s] >= 0) continue;
        const id = blobs.length;
        const b = { x0: W, y0: H, x1: 0, y1: 0, n: 0 };
        const st = [s];
        lab[s] = id;
        while (st.length) {
          const p = st.pop();
          const x = p % W;
          const y = (p / W) | 0;
          b.n++;
          if (x < b.x0) b.x0 = x;
          if (x > b.x1) b.x1 = x;
          if (y < b.y0) b.y0 = y;
          if (y > b.y1) b.y1 = y;
          for (const q of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, y > 0 ? p - W : -1, y < H - 1 ? p + W : -1]) {
            if (q >= 0 && dil[q] && lab[q] < 0) {
              lab[q] = id;
              st.push(q);
            }
          }
        }
        blobs.push(b);
      }
      const bw = (b) => b.x1 - b.x0 + 1;
      const bh = (b) => b.y1 - b.y0 + 1;
      // The title block at the top of the sheet.
      const isTitle = (b) => b.y1 < 130 && b.x0 > 300 && b.x1 < W - 300;
      // Labels: one line of text, wide and short, below the title.
      // Words of a label come out as separate blobs; join words on the same line.
      const words = blobs.filter((b) => !isTitle(b) && b.y0 > 150 && bh(b) >= 12 && bh(b) <= 30 && bw(b) >= 24).sort((a, b) => a.x0 - b.x0);
      const lines = [];
      for (const wd of words) {
        const line = lines.find((l) => Math.abs(l.y0 - wd.y0) < 9 && wd.x0 - l.x1 < 32 && wd.x0 > l.x0);
        if (line) {
          line.x1 = Math.max(line.x1, wd.x1);
          line.y0 = Math.min(line.y0, wd.y0);
          line.y1 = Math.max(line.y1, wd.y1);
          line.words.push(wd);
        } else lines.push({ x0: wd.x0, y0: wd.y0, x1: wd.x1, y1: wd.y1, words: [wd] });
      }
      const labels = lines.filter((l) => bw(l) >= 110 && bw(l) / bh(l) > 5);
      const labelWords = new Set(labels.flatMap((l) => l.words));
      labels.sort((a, b) => a.y0 - b.y0);
      // Group labels into rows.
      const rows = [];
      for (const l of labels) {
        const row = rows.find((r) => Math.abs(r[0].y0 - l.y0) < 40);
        if (row) row.push(l);
        else rows.push([l]);
      }
      rows.forEach((r) => r.sort((a, b) => a.x0 - b.x0));
      if (rows.length !== 4 || rows.some((r) => r.length !== 4)) {
        const near = blobs.filter((b) => !isTitle(b) && b.y0 > 150 && bh(b) <= 60 && bw(b) >= 60).map((b) => [b.x0, b.y0, bw(b), bh(b)]);
        return { error: `found label rows ${rows.map((r) => r.length).join(',')} ${JSON.stringify(near)}` };
      }
      const art = blobs.filter((b) => !isTitle(b) && !labelWords.has(b) && b.n > 60);
      const groups = rows.flat().map((l) => ({ label: l, parts: [] }));
      const mid = (l) => (l.x0 + l.x1) / 2;
      // Ink count per column inside a blob, to find where touching drawings meet.
      const columnInk = (b, id) => {
        const col = new Array(b.x1 - b.x0 + 1).fill(0);
        for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) if (lab[y * W + x] === id && ink[y * W + x]) col[x - b.x0]++;
        return col;
      };
      // Big drawings first; small fragments (rings, crumbs, speed lines) then join the
      // nearest drawing in their row rather than whichever label is closest.
      const BIG = 4000;
      const sorted = [...art].sort((a, b) => b.n - a.n);
      const rowOf = (b) => {
        const cy = (b.y0 + b.y1) / 2;
        const ri = rows.findIndex((r) => r[0].y0 > cy);
        return ri < 0 || (ri > 0 && cy < rows[ri - 1][0].y1) ? -1 : ri;
      };
      for (const b of sorted) {
        const id = blobs.indexOf(b);
        if (b.n < BIG) {
          const ri = rowOf(b);
          if (ri < 0) continue;
          let near = null;
          let nd = Infinity;
          for (const g of groups) {
            if (!rows[ri].includes(g.label)) continue;
            for (const p of g.parts) {
              const dx = Math.max(0, p.x0 - b.x1, b.x0 - p.x1);
              const dy = Math.max(0, p.y0 - b.y1, b.y0 - p.y1);
              const dd = Math.hypot(dx, dy);
              if (dd < nd) {
                nd = dd;
                near = g;
              }
            }
          }
          if (near && nd < 40) {
            near.parts.push({ id, x0: b.x0, x1: b.x1, y0: b.y0, y1: b.y1 });
            continue;
          }
        }
        const cy = (b.y0 + b.y1) / 2;
        // Row: the first label row whose labels sit below this blob's centre.
        const ri = rows.findIndex((r) => r[0].y0 > cy);
        if (ri < 0) continue;
        if (ri > 0 && cy < rows[ri - 1][0].y1) continue;
        const inside = rows[ri].filter((l) => mid(l) >= b.x0 && mid(l) <= b.x1);
        if (inside.length >= 2) {
          // Touching drawings: cut at the emptiest column between each pair of labels.
          const col = columnInk(b, id);
          const cuts = [b.x0];
          for (let k = 0; k < inside.length - 1; k++) {
            let bx = Math.round(mid(inside[k]));
            for (let x = Math.round(mid(inside[k])); x <= Math.round(mid(inside[k + 1])); x++) if (col[x - b.x0] < col[bx - b.x0]) bx = x;
            cuts.push(bx);
          }
          cuts.push(b.x1 + 1);
          inside.forEach((l, k) => groups.find((g) => g.label === l).parts.push({ id, x0: cuts[k], x1: cuts[k + 1] - 1, y0: b.y0, y1: b.y1 }));
          continue;
        }
        const cx = (b.x0 + b.x1) / 2;
        let best = null;
        let bd = Infinity;
        for (const l of rows[ri]) {
          const dist = Math.abs(mid(l) - cx);
          if (dist < bd) {
            bd = dist;
            best = l;
          }
        }
        groups.find((g) => g.label === best).parts.push({ id, x0: b.x0, x1: b.x1, y0: b.y0, y1: b.y1 });
      }
      // Tighten split parts to the ink they actually contain.
      for (const g of groups)
        for (const p of g.parts) {
          let y0 = H;
          let y1 = 0;
          let x0 = W;
          let x1 = 0;
          for (let y = p.y0; y <= p.y1; y++)
            for (let x = p.x0; x <= p.x1; x++)
              if (lab[y * W + x] === p.id && ink[y * W + x]) {
                if (y < y0) y0 = y;
                if (y > y1) y1 = y;
                if (x < x0) x0 = x;
                if (x > x1) x1 = x;
              }
          Object.assign(p, { x0, x1, y0, y1 });
        }
      const out = [];
      groups.forEach((g, i) => {
        if (!g.parts.length) return;
        const pad = 6;
        const x0 = Math.max(0, Math.min(...g.parts.map((p) => p.x0)) - pad);
        const y0 = Math.max(0, Math.min(...g.parts.map((p) => p.y0)) - pad);
        const x1 = Math.min(W - 1, Math.max(...g.parts.map((p) => p.x1)) + pad);
        const y1 = Math.min(H - 1, Math.max(...g.parts.map((p) => p.y1)) + pad);
        const w = x1 - x0 + 1;
        const h = y1 - y0 + 1;
        const t = document.createElement('canvas');
        t.width = w;
        t.height = h;
        const tc = t.getContext('2d', { willReadFrequently: true });
        tc.drawImage(cv, -x0, -y0);
        const id = tc.getImageData(0, 0, w, h);
        const px = id.data;
        // Pixels of other drawings that fall in this rectangle are not ours.
        const isMine = (owner, x, y) => g.parts.some((p) => p.id === owner && x >= p.x0 && x <= p.x1 && y >= p.y0 && y <= p.y1);
        // Flood the page white in from the edges.
        const white = (q) => 255 * 3 - px[q * 4] - px[q * 4 + 1] - px[q * 4 + 2] < 60;
        const bg = new Uint8Array(w * h);
        const st = [];
        for (let x = 0; x < w; x++) st.push(x, x + (h - 1) * w);
        for (let y = 0; y < h; y++) st.push(y * w, y * w + w - 1);
        for (const q of st) if (white(q)) bg[q] = 1;
        const stack = st.filter((q) => bg[q]);
        while (stack.length) {
          const q = stack.pop();
          const x = q % w;
          const y = (q / w) | 0;
          for (const r of [x > 0 ? q - 1 : -1, x < w - 1 ? q + 1 : -1, y > 0 ? q - w : -1, y < h - 1 ? q + w : -1]) {
            if (r >= 0 && !bg[r] && white(r)) {
              bg[r] = 1;
              stack.push(r);
            }
          }
        }
        for (let q = 0; q < w * h; q++) {
          const x = q % w;
          const y = (q / w) | 0;
          const owner = lab[(y0 + y) * W + (x0 + x)];
          if (bg[q] || (owner >= 0 && !isMine(owner, x0 + x, y0 + y))) px[q * 4 + 3] = 0;
        }
        // Railings, arches and frames enclose bits of page: clear those too, but only
        // on props and scenery (characters keep their white eyes and feathers).
        if (/^(p\d|mg\d|fg\d|bg\d|h2)$/.test(CODES[i])) {
          const pure = (q) => px[q * 4] >= 244 && px[q * 4 + 1] >= 244 && px[q * 4 + 2] >= 244;
          const seen = new Uint8Array(w * h);
          for (let s0 = 0; s0 < w * h; s0++) {
            if (bg[s0] || seen[s0] || !pure(s0)) continue;
            const comp = [s0];
            seen[s0] = 1;
            for (let k = 0; k < comp.length; k++) {
              const q = comp[k];
              const x = q % w;
              const y = (q / w) | 0;
              for (const r of [x > 0 ? q - 1 : -1, x < w - 1 ? q + 1 : -1, y > 0 ? q - w : -1, y < h - 1 ? q + w : -1]) {
                if (r >= 0 && !seen[r] && !bg[r] && pure(r)) {
                  seen[r] = 1;
                  comp.push(r);
                }
              }
            }
            if (comp.length >= 300)
              for (const q of comp) {
                bg[q] = 1;
                px[q * 4 + 3] = 0;
              }
          }
        }
        // Soften the cut edge: pixels next to the removed page get partial alpha from their whiteness.
        for (let q = 0; q < w * h; q++) {
          if (!px[q * 4 + 3]) continue;
          const x = q % w;
          const y = (q / w) | 0;
          const edge = (x > 0 && bg[q - 1]) || (x < w - 1 && bg[q + 1]) || (y > 0 && bg[q - w]) || (y < h - 1 && bg[q + w]);
          if (edge) {
            const lum = (px[q * 4] + px[q * 4 + 1] + px[q * 4 + 2]) / 3;
            px[q * 4 + 3] = Math.max(0, Math.min(255, Math.round((255 - lum) * 4)));
          }
        }
        tc.putImageData(id, 0, 0);
        out.push({ code: CODES[i], w, h, x: x0, y: y0, png: t.toDataURL('image/png'), webp: t.toDataURL('image/webp', 0.9) });
      });
      let prev = null;
      if (wantPreview) {
        const p = document.createElement('canvas');
        p.width = W;
        p.height = H;
        const pc = p.getContext('2d');
        pc.fillStyle = '#556';
        pc.fillRect(0, 0, W, H);
        for (const o of out) {
          const im2 = new Image();
          im2.src = o.png;
          await im2.decode();
          pc.drawImage(im2, o.x, o.y);
          pc.strokeStyle = '#ff0';
          pc.strokeRect(o.x, o.y, o.w, o.h);
          pc.fillStyle = '#ff0';
          pc.font = 'bold 18px sans-serif';
          pc.fillText(o.code, o.x + 4, o.y + 18);
        }
        prev = p.toDataURL('image/png');
      }
      return { out, prev };
    },
    { url: sheet.url, CODES, wantPreview: !!preview },
  );
  if (res.error) {
    console.error(`L0${sheet.n}: ${res.error}`);
    process.exitCode = 1;
    continue;
  }
  const dir = `public/levels/l0${sheet.n}`;
  mkdirSync(dir, { recursive: true });
  for (const o of res.out) {
    if (o.code === 'a1') continue;
    writeFileSync(`${dir}/${o.code}.webp`, Buffer.from(o.webp.split(',')[1], 'base64'));
    sizes[`l0${sheet.n}_${o.code}`] = [o.w, o.h];
  }
  if (preview) {
    mkdirSync(preview, { recursive: true });
    writeFileSync(`${preview}/l0${sheet.n}.png`, Buffer.from(res.prev.split(',')[1], 'base64'));
  }
  console.log(`L0${sheet.n}: ${res.out.length} pieces`);
}
writeFileSync('src/data/levelArtSizes.json', JSON.stringify(sizes, null, 0) + '\n');
await browser.close();
