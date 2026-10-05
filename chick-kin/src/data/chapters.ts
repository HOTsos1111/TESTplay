// Five growth stages = five gameplay formats (brief §1, §8). Adulthood is the completion state, not a chapter.
import type { Stage } from './growth';
import type { Theme } from '../sim/types';

export interface ChapterInfo {
  stage: Stage; id: string; name: string; sub: string; icon: string; theme: Theme; music: string;
  format: string; blurb: string; learn: string[]; camera: string;
}

export const CHAPTERS: Record<Stage, ChapterInfo> = {
  1: { stage: 1, id: 'nest', name: 'Nest Scramble', sub: 'Early Days', icon: '🥚', theme: 'nest', music: 'nest', format: 'Close-quarters nest arena', camera: 'Close overhead',
    blurb: 'Tiny steps, big possibilities. Where it all begins!', learn: ['Move and hop', 'Collect crumbs', 'Nudge and tug'] },
  2: { stage: 2, id: 'coop', name: 'Coop Dash', sub: 'Learning', icon: '🏠', theme: 'coop', music: 'coop', format: 'Side-scrolling platform race', camera: 'Side view',
    blurb: 'Fluffy legs, big strides. Race your siblings through the coop!', learn: ['Run and jump', 'Duck under fences', 'Peck straw, push hay'] },
  3: { stage: 3, id: 'rafters', name: 'Rafter Rivals', sub: 'Exploring', icon: '🪶', theme: 'rafters', music: 'rafters', format: 'Vertical platform climb', camera: 'Dynamic side',
    blurb: 'Awkward wings, brave hearts. Flap and glide to the top!', learn: ['Short flaps', 'Glide', 'Rest to regain stamina'] },
  4: { stage: 4, id: 'farmyard', name: 'Farmyard Mischief', sub: 'Adventuring', icon: '🌻', theme: 'farmyard', music: 'farmyard', format: 'Top-down exploration & delivery', camera: 'Three-quarter',
    blurb: 'Young and clever. Scratch, carry and deliver across the yard!', learn: ['Scratch for treats', 'Carry and deliver', 'Vault, open gates, move props'] },
  5: { stage: 5, id: 'championship', name: 'Barnyard Championship', sub: 'Showtime', icon: '🏆', theme: 'championship', music: 'championship', format: 'Multi-event championship', camera: 'Event cameras',
    blurb: 'Almost grown. Race, perch and haul to become champion!', learn: ['Everything you have learned', 'Scored events', 'Win the Sibling Showdown'] },
};
