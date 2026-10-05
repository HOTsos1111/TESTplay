// Canonical chick classes (brief §4, §6). Relative tuning is a starting hypothesis for playtesting.

export type ChickClass = 'speedy' | 'mighty' | 'nimble';
export const CLASSES: readonly ChickClass[] = ['speedy', 'mighty', 'nimble'];

export interface ClassTuning {
  run: number;      // run speed multiplier
  push: number;     // pushing force multiplier
  jump: number;     // jump HEIGHT multiplier
  flap: number;     // flap endurance multiplier
  bumpRes: number;  // bump resistance multiplier
}

export interface ClassInfo {
  id: ChickClass;
  name: string;
  epithet: string;
  route: 'gold' | 'red' | 'teal';
  routeName: string;
  ability: 'AB-01' | 'AB-02' | 'AB-03';
  /** Plumage palette used by the procedural model, UI portraits and FX. */
  colors: { body: number; belly: number; wing: number; tuft: number; face: number; accent: string; ui: string; uiDark: string };
  look: string;
  strengths: string[];
  weaknesses: string[];
  tuning: ClassTuning;
  /** UI stat bars, 0..1 */
  bars: { speed: number; strength: number; agility: number };
  icon: string; // short glyph used alongside colour so class identity is not colour-only
}

export const CLASS_INFO: Record<ChickClass, ClassInfo> = {
  speedy: {
    id: 'speedy', name: 'Speedy', epithet: 'The Fast One', route: 'gold', routeName: 'Gold sprint route',
    ability: 'AB-01',
    colors: { body: 0xf7c23c, belly: 0xffe49a, wing: 0xeeac2a, tuft: 0xff7a55, face: 0xffdb7a, accent: '#f5b82e', ui: '#f2b632', uiDark: '#b5761a' },
    look: 'Golden-yellow, slim oval body, swept-back coral tuft.',
    strengths: ['Great at speed', 'Quick moves'], weaknesses: ['Not as strong'],
    tuning: { run: 1.2, push: 0.75, jump: 0.95, flap: 0.9, bumpRes: 0.85 },
    bars: { speed: 0.95, strength: 0.35, agility: 0.6 },
    icon: '⚡',
  },
  mighty: {
    id: 'mighty', name: 'Mighty', epithet: 'The Strong One', route: 'red', routeName: 'Red shove route',
    ability: 'AB-02',
    colors: { body: 0xd8473a, belly: 0xf08a72, wing: 0xb02a2a, tuft: 0xc0232b, face: 0xf3a088, accent: '#d8473a', ui: '#de4a3c', uiDark: '#8f2222' },
    look: 'Rich warm red, broad round body, crimson wings and tuft, salmon face and chest.',
    strengths: ['Excellent strength', 'Hard to bump'], weaknesses: ['Slower than others', 'Lower jump'],
    tuning: { run: 0.85, push: 1.3, jump: 0.85, flap: 0.85, bumpRes: 1.3 },
    bars: { speed: 0.4, strength: 0.95, agility: 0.45 },
    icon: '✊',
  },
  nimble: {
    id: 'nimble', name: 'Nimble', epithet: 'The Agile One', route: 'teal', routeName: 'Teal aerial route',
    ability: 'AB-03',
    colors: { body: 0xc8b2ee, belly: 0xefe6ff, wing: 0xa98fe0, tuft: 0x22b5ad, face: 0xe4d8fb, accent: '#8f78d6', ui: '#3bb8b0', uiDark: '#1f7a75' },
    look: 'Pale lavender, petite light body, teal tuft.',
    strengths: ['Great at agility', 'Tricky high paths'], weaknesses: ['Not as strong', 'Easy to bump'],
    tuning: { run: 1.0, push: 0.75, jump: 1.2, flap: 1.25, bumpRes: 0.75 },
    bars: { speed: 0.6, strength: 0.35, agility: 0.95 },
    icon: '❋',
  },
};

export interface AbilityInfo { id: string; name: string; cls: ChickClass; cooldown: number; duration: number; summary: string; byStage: string[] }

export const ABILITIES: Record<ChickClass, AbilityInfo> = {
  speedy: {
    id: 'AB-01', name: 'Zoomies', cls: 'speedy', cooldown: 6, duration: 0.65,
    summary: 'Short ground dash. Walls stay solid.',
    byStage: ['Quick scuttle', 'Dash', 'Running flap launch', 'Dash and snatch', 'Full Zoomies'],
  },
  mighty: {
    id: 'AB-02', name: 'Fluff Bump', cls: 'mighty', cooldown: 7, duration: 0.3,
    summary: 'Forward nudge: moves props, breaks straw, staggers a sibling.',
    byStage: ['Sturdy nudge', 'Shove', 'Perch brace', 'Heavy shove', 'Full Fluff Bump'],
  },
  nimble: {
    id: 'AB-03', name: 'Fancy Feathers', cls: 'nimble', cooldown: 6, duration: 0.4,
    summary: 'Quick evasive hop; dodges sibling bumps.',
    byStage: ['Springy hop', 'Double hop', 'Controlled glide', 'Vault and dodge', 'Full Fancy Feathers'],
  },
};
