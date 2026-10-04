/**
 * Procedural temporary score: small-band cartoon loops (bass, clarinet-ish
 * lead, muted brass, light kit). Each token is an eighth note:
 *   C4 / F#3 = note, "." = rest, "-" = hold previous note,
 *   k / s / h = kick / snare / hat (drum parts).
 * The "home" melody recurs across tracks as the leitmotif.
 */
export interface TrackDef {
  bpm: number;
  length: number;
  parts: { instrument: 'lead' | 'bass' | 'brass' | 'kick' | 'snare' | 'hat'; notes: (number | null)[] }[];
}

const NOTE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

function parse(src: string): (number | null)[] {
  return src
    .replace(/\|/g, ' ')
    .trim()
    .split(/\s+/)
    .map((tok) => {
      if (tok === '.') return null;
      if (tok === '-') return -1;
      if (tok === 'k' || tok === 's' || tok === 'h') return 60;
      const m = /^([A-G])(#|b)?(\d)$/.exec(tok);
      if (!m) throw new Error(`Bad note ${tok}`);
      const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
      return 12 * (Number(m[3]) + 1) + NOTE[m[1]] + acc;
    });
}

function track(bpm: number, parts: Record<string, string>): TrackDef {
  const parsed = Object.entries(parts).map(([instrument, src]) => ({
    instrument: instrument as TrackDef['parts'][number]['instrument'],
    notes: parse(src),
  }));
  const length = Math.max(...parsed.map((p) => p.notes.length));
  for (const p of parsed) {
    if (length % p.notes.length !== 0) throw new Error(`Part ${p.instrument} length ${p.notes.length} does not divide ${length}`);
    const base = [...p.notes];
    while (p.notes.length < length) p.notes.push(...base);
  }
  return { bpm, length, parts: parsed };
}

const HOME_MOTIF =
  'G4 - E4 - G4 - C5 - | B4 - A4 - G4 - - - | A4 - F4 - A4 - D5 - | C5 - B4 - C5 - - - |' +
  'E5 - D5 - C5 - A4 - | G4 - E4 - C4 - D4 - | E4 - G4 - A4 - B4 - | C5 - - - . . . . ';

export const MUSIC = {
  title: track(112, {
    lead: HOME_MOTIF,
    bass:
      'C3 . G2 . C3 . G2 . | G2 . D3 . G2 . D3 . | F2 . C3 . F2 . C3 . | C3 . G2 . C3 . G2 . |' +
      'A2 . E3 . A2 . E3 . | C3 . G2 . C3 . G2 . | F2 . C3 . G2 . D3 . | C3 . G2 . C3 . . . ',
    brass: '. . E4 . . . E4 . | . . D4 . . . D4 . | . . F4 . . . F4 . | . . E4 . . . E4 . ',
    hat: '. h . h . h . h',
    kick: 'k . . . k . . .',
  }),
  depot: track(150, {
    lead:
      'C5 . E5 . G5 . E5 . | F5 . D5 . B4 - . . | C5 . E5 . G5 . C6 . | B5 . G5 . A5 - . . |' +
      'G4 - E4 - G4 . C5 . | B4 . A4 . G4 - . . | A4 . B4 . C5 . D5 . | E5 . D5 . C5 - . . ',
    bass:
      'C3 . E3 . G3 . A3 . | G2 . B2 . D3 . G2 . | C3 . E3 . G3 . E3 . | F2 . A2 . C3 . F2 . |' +
      'C3 . E3 . G3 . E3 . | G2 . B2 . D3 . B2 . | F2 . G2 . A2 . B2 . | C3 . G2 . C3 . . . ',
    brass: '. . . E4 . . . E4 | . . . D4 . . . F4 ',
    kick: 'k . . . k . . . ',
    snare: '. . s . . . s . ',
    hat: 'h h h h h h h h',
  }),
  chase: track(168, {
    lead:
      'A4 . A4 C5 . A4 E5 . | D5 . C5 . B4 . G#4 . | A4 . A4 C5 . A4 E5 . | F5 . E5 . D5 . E5 - |' +
      'A5 . G5 . F5 . E5 . | D5 . C5 . B4 . E5 . | A4 . C5 . E5 . A5 . | G#5 - E5 - . . . . ',
    bass:
      'A2 A2 . A2 E2 . A2 . | E2 E2 . E2 B2 . E2 . | A2 A2 . A2 E2 . A2 . | F2 F2 . F2 C3 . F2 . |' +
      'F2 F2 . F2 C3 . F2 . | E2 E2 . E2 B2 . E2 . | A2 A2 . A2 E2 . A2 . | E2 E2 . E2 G#2 . E2 . ',
    brass: '. C4 . . . C4 . . | . B3 . . . B3 . . ',
    kick: 'k . . k k . . . ',
    snare: '. . s . . . s s ',
    hat: 'h h h h h h h h',
  }),
  home: track(104, {
    lead: HOME_MOTIF,
    bass:
      'C3 - - - G2 - - - | G2 - - - D3 - - - | F2 - - - C3 - - - | C3 - - - G2 - - - |' +
      'A2 - - - E3 - - - | C3 - - - G2 - - - | F2 - - - G2 - - - | C3 - - - - - - - ',
  }),
} satisfies Record<string, TrackDef>;
