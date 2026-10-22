// Minimal zip writer (no dependencies). Entry names always use forward slashes:
// Windows PowerShell's Compress-Archive writes backslashes, which itch.io can't serve.
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { crc32, deflateRawSync } from 'node:zlib';

function listFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...listFiles(p));
    else out.push(p);
  }
  return out;
}

/** Zips every file under `dir` into `zipPath`, with paths relative to `dir` (index.html at the root). */
export function zipDir(dir, zipPath) {
  const locals = [];
  const central = [];
  let offset = 0;
  for (const file of listFiles(dir)) {
    const name = Buffer.from(relative(dir, file).split(/[\\/]/).join('/'), 'utf8');
    const data = readFileSync(file);
    const packed = deflateRawSync(data, { level: 9 });
    // Already-compressed files (videos, images) are stored when deflate doesn't help.
    const stored = packed.length >= data.length;
    const body = stored ? data : packed;
    const crc = crc32(data);
    const head = Buffer.alloc(30);
    head.writeUInt32LE(0x04034b50, 0);
    head.writeUInt16LE(20, 4); // version needed
    head.writeUInt16LE(0x0800, 6); // UTF-8 names
    head.writeUInt16LE(stored ? 0 : 8, 8);
    head.writeUInt32LE(0, 10); // time/date
    head.writeUInt32LE(crc, 14);
    head.writeUInt32LE(body.length, 18);
    head.writeUInt32LE(data.length, 22);
    head.writeUInt16LE(name.length, 26);
    head.writeUInt16LE(0, 28);
    locals.push(head, name, body);

    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0);
    cen.writeUInt16LE(0x031e, 4); // made by: Unix, so permissions below are honoured
    cen.writeUInt16LE(20, 6);
    cen.writeUInt16LE(0x0800, 8);
    cen.writeUInt16LE(stored ? 0 : 8, 10);
    cen.writeUInt32LE(0, 12);
    cen.writeUInt32LE(crc, 16);
    cen.writeUInt32LE(body.length, 20);
    cen.writeUInt32LE(data.length, 24);
    cen.writeUInt16LE(name.length, 28);
    cen.writeUInt32LE((0o100644 << 16) >>> 0, 38); // regular file, rw-r--r--
    cen.writeUInt32LE(offset, 42);
    central.push(cen, name);
    offset += head.length + name.length + body.length;
  }
  const cenSize = central.reduce((n, b) => n + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(central.length / 2, 8);
  end.writeUInt16LE(central.length / 2, 10);
  end.writeUInt32LE(cenSize, 12);
  end.writeUInt32LE(offset, 16);
  writeFileSync(zipPath, Buffer.concat([...locals, ...central, end]));
}
