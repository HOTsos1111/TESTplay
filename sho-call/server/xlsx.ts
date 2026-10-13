// Reads the first worksheet of an .xlsx file into a grid of strings.
import { readSheet } from 'read-excel-file/node';

const pad = (n: number) => String(n).padStart(2, '0');

function cellText(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) {
    // Time-only cells are stored on Excel's 1899-12-30 epoch day.
    if (v.getUTCFullYear() <= 1900) return `${pad(v.getUTCHours())}:${pad(v.getUTCMinutes())}${v.getUTCSeconds() ? `:${pad(v.getUTCSeconds())}` : ''}`;
    const date = `${v.getUTCFullYear()}-${pad(v.getUTCMonth() + 1)}-${pad(v.getUTCDate())}`;
    return v.getUTCHours() || v.getUTCMinutes() ? `${date} ${pad(v.getUTCHours())}:${pad(v.getUTCMinutes())}` : date;
  }
  return String(v);
}

export default async function readXlsxSheet(data: Buffer): Promise<string[][]> {
  const rows = await readSheet(data);
  return rows.map((row) => row.map(cellText));
}
