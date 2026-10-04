/**
 * Procedural temporary score: small-band cartoon loops (bass, clarinet-ish
 * lead, muted brass, light kit). Each token is an eighth note:
 *   C4 / F#3 = note, "." = rest, "-" = hold previous note,
 *   k / s / h = kick / snare / hat (drum parts).
 * The "home" melody recurs across tracks as the leitmotif.
 */
export type Instrument = 'lead' | 'bass' | 'brass' | 'pluck' | 'kick' | 'snare' | 'hat' | 'block';

export interface TrackDef {
  bpm: number;
  /** 0..0.5: how late off-beat eighths land (swing feel). */
  swing?: number;
  length: number;
  parts: { instrument: Instrument; notes: (number | null)[] }[];
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
      if (tok === 'k' || tok === 's' || tok === 'h' || tok === 'w') return 60;
      const m = /^([A-G])(#|b)?(\d)$/.exec(tok);
      if (!m) throw new Error(`Bad note ${tok}`);
      const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
      return 12 * (Number(m[3]) + 1) + NOTE[m[1]] + acc;
    });
}

/** Part keys may carry a digit suffix (pluck1, pluck2…) to layer one instrument. */
function track(bpm: number, parts: Record<string, string>, swing = 0): TrackDef {
  const parsed = Object.entries(parts).map(([key, src]) => ({
    instrument: key.replace(/\d+$/, '') as Instrument,
    notes: parse(src),
  }));
  const length = Math.max(...parsed.map((p) => p.notes.length));
  for (const p of parsed) {
    if (length % p.notes.length !== 0) throw new Error(`Part ${p.instrument} length ${p.notes.length} does not divide ${length}`);
    const base = [...p.notes];
    while (p.notes.length < length) p.notes.push(...base);
  }
  return { bpm, swing, length, parts: parsed };
}

const CHORD: Record<string, [string, string, string]> = {
  C: ['C4', 'E4', 'G4'],
  G: ['B3', 'D4', 'G4'],
  G7: ['B3', 'F4', 'G4'],
  F: ['A3', 'C4', 'F4'],
  Am: ['A3', 'C4', 'E4'],
  Dm: ['A3', 'D4', 'F4'],
  E: ['G#3', 'B3', 'E4'],
  D7: ['A3', 'C4', 'F#4'],
};

/**
 * Banjo comping: one voice of each bar's chord on the given rhythm
 * (X = strum, . = rest), eight eighths per bar.
 */
function comp(chords: string[], voice: 0 | 1 | 2, rhythm = '. . X . . . X .'): string {
  const r = rhythm.split(/\s+/);
  return chords.map((c) => r.map((x) => (x === 'X' ? CHORD[c][voice] : '.')).join(' ')).join(' | ');
}

const HOME_MOTIF =
  'G4 - E4 - G4 - C5 - | B4 - A4 - G4 - - - | A4 - F4 - A4 - D5 - | C5 - B4 - C5 - - - |' +
  'E5 - D5 - C5 - A4 - | G4 - E4 - C4 - D4 - | E4 - G4 - A4 - B4 - | C5 - - - . . . . ';
const HOME_CHORDS = ['C', 'G', 'F', 'C', 'Am', 'C', 'F', 'C'];

const DEPOT_CHORDS = ['C', 'G7', 'C', 'F', 'C', 'G', 'F', 'C', 'Am', 'D7', 'G', 'G7', 'C', 'F', 'G7', 'C'];
const CHASE_CHORDS = ['Am', 'E', 'Am', 'Dm', 'Dm', 'E', 'Am', 'E'];

export const MUSIC = {
  title: track(112, {
    lead: HOME_MOTIF,
    bass:
      'C3 . G2 . C3 . G2 . | G2 . D3 . G2 . D3 . | F2 . C3 . F2 . C3 . | C3 . G2 . C3 . G2 . |' +
      'A2 . E3 . A2 . E3 . | C3 . G2 . C3 . G2 . | F2 . C3 . G2 . D3 . | C3 . G2 . C3 . . . ',
    pluck1: comp(HOME_CHORDS, 0),
    pluck2: comp(HOME_CHORDS, 1),
    pluck3: comp(HOME_CHORDS, 2),
    hat: '. h . h . h . h',
    kick: 'k . . . k . . .',
  }, 0.28),
  depot: track(150, {
    lead:
      'C5 . E5 . G5 . E5 . | F5 . D5 . B4 - . . | C5 . E5 . G5 . C6 . | B5 . G5 . A5 - . . |' +
      'G4 - E4 - G4 . C5 . | B4 . A4 . G4 - . . | A4 . B4 . C5 . D5 . | E5 . D5 . C5 - . . |' +
      'A4 . C5 . E5 . A5 . | G5 . F#5 . F5 . D5 . | G4 - B4 - D5 - G5 - | F5 . E5 . D5 - . . |' +
      'E5 . G5 . C6 . G5 . | A5 . F5 . C5 . A4 . | G4 . A4 . B4 . D5 . | C5 - - - . . . . ',
    bass:
      'C3 . E3 . G3 . A3 . | G2 . B2 . D3 . F3 . | C3 . E3 . G3 . E3 . | F2 . A2 . C3 . A2 . |' +
      'C3 . E3 . G3 . E3 . | G2 . B2 . D3 . B2 . | F2 . G2 . A2 . B2 . | C3 . G2 . C3 . E3 . |' +
      'A2 . C3 . E3 . C3 . | D3 . F#3 . A3 . C3 . | G2 . B2 . D3 . B2 . | G2 . A2 . B2 . D3 . |' +
      'C3 . E3 . G3 . E3 . | F2 . A2 . C3 . A2 . | G2 . B2 . D3 . F3 . | C3 . G2 . C3 . . . ',
    pluck1: comp(DEPOT_CHORDS, 0),
    pluck2: comp(DEPOT_CHORDS, 1),
    pluck3: comp(DEPOT_CHORDS, 2),
    brass: '. . . . . . . . | . . . . . . . . | . . . . . . . . | . . . . . E5 F5 G5 ',
    kick: 'k . . . k . . . ',
    snare: '. . s . . . s . ',
    hat: 'h h h h h h h h',
    block: '. . . . . . . . | . . . . . . . . | . . . . . . . . | . . . . . w . w ',
  }, 0.2),
  chase: track(168, {
    lead:
      'A4 . A4 C5 . A4 E5 . | D5 . C5 . B4 . G#4 . | A4 . A4 C5 . A4 E5 . | F5 . E5 . D5 . E5 - |' +
      'A5 . G5 . F5 . E5 . | D5 . C5 . B4 . E5 . | A4 . C5 . E5 . A5 . | G#5 - E5 - . . . . ',
    bass:
      'A2 A2 . A2 E2 . A2 . | E2 E2 . E2 B2 . E2 . | A2 A2 . A2 E2 . A2 . | D2 D2 . D2 A2 . D2 . |' +
      'D2 D2 . D2 A2 . D2 . | E2 E2 . E2 B2 . E2 . | A2 A2 . A2 E2 . A2 . | E2 E2 . E2 G#2 . E2 . ',
    pluck1: comp(CHASE_CHORDS, 0, '. X . X . X . X'),
    pluck2: comp(CHASE_CHORDS, 2, '. X . X . X . X'),
    brass: '. . . . . . . . | . . . . . . . . | . . . . . . . . | A4 . A4 . G#4 - . . ',
    kick: 'k . . k k . . . ',
    snare: '. . s . . . s s ',
    hat: 'h h h h h h h h',
    block: '. . . . . . . . | . . . . . . w w ',
  }),
  home: track(100, {
    lead: HOME_MOTIF,
    bass:
      'C3 - - - G2 - - - | G2 - - - D3 - - - | F2 - - - C3 - - - | C3 - - - G2 - - - |' +
      'A2 - - - E3 - - - | C3 - - - G2 - - - | F2 - - - G2 - - - | C3 - - - - - - - ',
    pluck1: comp(HOME_CHORDS, 0, 'X . X . X . X .'),
    pluck2: comp(HOME_CHORDS, 1, 'X . X . X . X .'),
    pluck3: comp(HOME_CHORDS, 2, 'X . X . X . X .'),
  }, 0.25),
} satisfies Record<string, TrackDef>;
