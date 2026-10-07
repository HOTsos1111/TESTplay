/**
 * The illustrated opening, one entry per page in reading order. `panels` lists
 * the x positions (as a fraction of the image width) where each extra comic
 * panel starts, so multi-panel pages can reveal left to right.
 */
import type { SfxKey } from '../systems/AudioManager';

export interface StorySlide {
  file: string;
  panels?: number[];
  sfx?: SfxKey;
}

export const STORY_SLIDES: StorySlide[] = [
  { file: 'story/01.webp', sfx: 'squeak' },
  { file: 'story/02.webp', sfx: 'squirrel' },
  { file: 'story/03.webp', sfx: 'squirrel_angry' },
  { file: 'story/04.webp', sfx: 'jump' },
  { file: 'story/05.webp', sfx: 'hit' },
  { file: 'story/06.webp', sfx: 'squeak' },
  { file: 'story/07.webp', sfx: 'bark' },
  { file: 'story/08.webp', sfx: 'boss_hit' },
  { file: 'story/09.webp', panels: [0.312, 0.684] },
  { file: 'story/10.webp', panels: [0.322, 0.68] },
  { file: 'story/11.webp', panels: [0.313, 0.681] },
  { file: 'story/12.webp', panels: [0.498], sfx: 'parcel' },
  { file: 'story/13.webp', sfx: 'boss_clear' },
];
