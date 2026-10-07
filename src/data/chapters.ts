import type { MusicKey } from '../systems/AudioManager';
import type { ThemeId } from '../systems/LevelTheme';

export interface ChapterDef {
  id: number;
  key: string;
  title: string;
  objective: string;
  opening: string;
  /** Short description of the ending encounter. */
  encounter: string;
  implemented: boolean;
  speedStart: number;
  speedEnd: number;
  chunks: string[];
  /** Legacy set-piece encounters, or 'boss' for the level's own boss (see data/bosses). */
  encounterId: 'trolley' | 'swarm' | 'pigeon' | 'boss' | null;
  /** Double jump is learned in Level 6; earlier levels never need it. */
  doubleJump: boolean;
  /** Background, obstacle skins and gate. */
  theme: ThemeId;
  /** Campaign level (1–9) whose asset guide dresses this chapter, if any. */
  art?: number;
  /** Scenery zones, starting at the given chunk index. */
  zones: { chunk: number; near: string; mid: string; indoor: boolean }[];
  music: MusicKey;
}

export const CHAPTERS: ChapterDef[] = [
  {
    id: 1,
    key: 'old_town',
    title: 'Deli Dash',
    objective: 'Leave the deli and cross the old-town lanes to the brick arch.',
    opening: 'One deli down. One whole city to go.',
    encounter: 'Don Crumb',
    implemented: true,
    speedStart: 350,
    speedEnd: 370,
    chunks: ['depot_start', 'jump_tyre', 'bark_intro', 'jump_gap', 'hop_or_leap', 'squirrel_intro', 'platforms_intro', 'crate_steps', 'depot_mix_a', 'speed_run', 'high_route', 'exit_gate'],
    encounterId: 'boss',
    doubleJump: false,
    theme: 'depot',
    art: 1,
    music: 'level01',
    zones: [],
  },
  {
    id: 2,
    key: 'warehouses',
    title: 'Crate Expectations',
    objective: 'Cross the loading yards and slip out past the loading bay.',
    opening: 'Mind the barrels. Duck the beams.',
    encounter: 'Forklift Frankie',
    implemented: true,
    speedStart: 355,
    speedEnd: 375,
    chunks: ['street_start', 'duck_intro', 'street_hydrants', 'street_bakery_boxes', 'street_awnings', 'street_gaps', 'street_squirrels', 'street_mix', 'street_market', 'squirrel_pair', 'exit_gate'],
    encounterId: 'boss',
    doubleJump: false,
    theme: 'depot',
    art: 2,
    music: 'level02',
    zones: [],
  },
  {
    id: 3,
    key: 'waterfront',
    title: 'Pier Pressure',
    objective: 'Follow the boardwalk and cross the broken pier.',
    opening: 'Sea air. Seagulls. Keep that tail spinning.',
    encounter: 'Captain Gull',
    implemented: true,
    speedStart: 355,
    speedEnd: 380,
    chunks: ['depot_start', 'hover_intro', 'jump_gap', 'hover_recharge', 'street_hover', 'platforms_intro', 'street_hover_squirrel', 'mixed_hover', 'street_gaps', 'exit_gate'],
    encounterId: 'boss',
    doubleJump: false,
    theme: 'depot',
    art: 3,
    music: 'level03',
    zones: [],
  },
  {
    id: 4,
    key: 'rail_yards',
    title: 'Track Tricks',
    objective: 'Navigate the tracks and leave through the viaduct gate.',
    opening: 'Duck the signals, hop the sleepers.',
    encounter: 'Switchback Badger',
    implemented: true,
    speedStart: 360,
    speedEnd: 385,
    chunks: ['street_start', 'street_awnings', 'high_route', 'duck_intro', 'crate_steps', 'street_mix', 'hop_or_leap', 'street_market', 'final_gauntlet', 'exit_gate'],
    encounterId: 'boss',
    doubleJump: false,
    theme: 'depot',
    art: 4,
    music: 'level04',
    zones: [],
  },
  {
    id: 5,
    key: 'industrial',
    title: 'Steam Team',
    objective: 'Get past the steam lines to the worksite shortcut.',
    opening: 'Bark at the right moment.',
    encounter: 'Boiler Brutus',
    implemented: true,
    speedStart: 360,
    speedEnd: 390,
    chunks: ['depot_start', 'bark_intro', 'street_bakery_boxes', 'depot_mix_a', 'burst_intro', 'squirrel_pair', 'mixed_hover', 'street_burst', 'high_route', 'exit_gate'],
    encounterId: 'boss',
    doubleJump: false,
    theme: 'depot',
    art: 5,
    music: 'level05',
    zones: [],
  },
  {
    id: 6,
    key: 'construction',
    title: 'Raise the Woof',
    objective: 'Climb through the unfinished building to downtown.',
    opening: 'New trick: press jump again in the air to DOUBLE JUMP!',
    encounter: 'Hardhat Hank',
    implemented: true,
    speedStart: 365,
    speedEnd: 390,
    chunks: ['street_start', 'double_intro', 'street_double', 'hover_recharge', 'duck_double_mix', 'street_hover', 'crate_steps', 'final_gauntlet', 'exit_gate'],
    encounterId: 'boss',
    doubleJump: true,
    theme: 'depot',
    art: 6,
    music: 'level06',
    zones: [],
  },
  {
    id: 7,
    key: 'downtown',
    title: 'Uptown Underdog',
    objective: 'Dodge the dogcatcher through the shops to the park gate.',
    opening: 'Big city. Bigger net.',
    encounter: 'Dogcatcher Net-O-Matic',
    implemented: true,
    speedStart: 370,
    speedEnd: 395,
    chunks: ['depot_start', 'street_double_duck', 'street_mix', 'burst_gauntlet', 'street_squirrels', 'duck_double_mix', 'street_final', 'exit_gate'],
    encounterId: 'boss',
    doubleJump: true,
    theme: 'depot',
    art: 7,
    music: 'level07',
    zones: [],
  },
  {
    id: 8,
    key: 'nature_park',
    title: 'Bark and Branch',
    objective: 'Cross the woodland trails and clear the goose bridge.',
    opening: 'That smell... home is close!',
    encounter: 'Honkzilla',
    implemented: true,
    speedStart: 370,
    speedEnd: 395,
    chunks: ['street_start', 'street_hover_squirrel', 'mixed_hover', 'squirrel_pair', 'street_burst_gauntlet', 'hover_recharge', 'street_double', 'final_gauntlet', 'exit_gate'],
    encounterId: 'boss',
    doubleJump: true,
    theme: 'depot',
    art: 8,
    music: 'level08',
    zones: [],
  },
  {
    id: 9,
    key: 'home',
    title: 'The Last Laugh',
    objective: 'Outsmart Squirrel one last time and get home.',
    opening: 'The red mailbox! Almost home!',
    encounter: 'Squirrel Boss',
    implemented: true,
    speedStart: 375,
    speedEnd: 400,
    chunks: ['depot_start', 'street_final', 'duck_double_mix', 'burst_gauntlet', 'street_double_duck', 'final_gauntlet', 'street_burst_gauntlet', 'high_route', 'exit_gate'],
    encounterId: 'boss',
    doubleJump: true,
    theme: 'depot',
    art: 9,
    music: 'level09',
    zones: [],
  },
];

export function chapterById(id: number): ChapterDef {
  const c = CHAPTERS.find((ch) => ch.id === id);
  if (!c) throw new Error(`Unknown chapter ${id}`);
  return c;
}
