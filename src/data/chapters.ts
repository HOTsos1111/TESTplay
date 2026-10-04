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
  encounterId: 'trolley' | null;
  /** Scenery zones, starting at the given chunk index. */
  zones: { chunk: number; near: string; mid: string; indoor: boolean }[];
  music: 'depot' | 'title';
}

export const CHAPTERS: ChapterDef[] = [
  {
    id: 1,
    key: 'depot',
    title: 'Special Delivery',
    objective: 'Escape the depot and reach the street exit.',
    opening: "That definitely wasn't our street.",
    encounter: 'The dogcatcher and his capture trolley',
    implemented: true,
    speedStart: 340,
    speedEnd: 400,
    chunks: [
      'depot_start',
      'jump_tyre',
      'jump_gap',
      'hop_or_leap',
      'platforms_intro',
      'bark_intro',
      'squirrel_intro',
      'duck_intro',
      'depot_mix_a',
      'hover_intro',
      'hover_recharge',
      'double_intro',
      'burst_intro',
      'crate_steps',
      'squirrel_pair',
      'mixed_hover',
      'duck_double_mix',
      'burst_gauntlet',
      'speed_run',
      'high_route',
      'final_gauntlet',
      'exit_gate',
    ],
    encounterId: 'trolley',
    music: 'depot',
    zones: [
      { chunk: 0, near: 'depot_near', mid: 'depot_mid', indoor: true },
      { chunk: 4, near: 'depot_near_sorting', mid: 'depot_mid', indoor: true },
      { chunk: 9, near: 'depot_near_cold', mid: 'depot_mid', indoor: true },
      { chunk: 13, near: 'depot_near_yard', mid: 'depot_mid_yard', indoor: false },
      { chunk: 18, near: 'depot_near_street', mid: 'depot_mid_yard', indoor: false },
    ],
  },
  {
    id: 2, key: 'shopping_street', title: 'Small Dog, Big City', objective: 'Cross the shopping street to the park gate.',
    opening: 'Home is somewhere past all these shoes.', encounter: 'The pigeon captain',
    implemented: false, speedStart: 340, speedEnd: 390, chunks: [], encounterId: null, music: 'depot', zones: [],
  },
  {
    id: 3, key: 'city_park', title: 'Fowl Play', objective: 'Cross the park to the residential shortcut.',
    opening: 'Nice pond. Unfriendly goose.', encounter: 'The bridge goose',
    implemented: false, speedStart: 350, speedEnd: 400, chunks: [], encounterId: null, music: 'depot', zones: [],
  },
  {
    id: 4, key: 'back_alleys', title: 'Alley Oops', objective: 'Find a route through the back alleys.',
    opening: 'My nose says shortcut. My eyes say bins.', encounter: 'The raccoon and the junk cart',
    implemented: false, speedStart: 360, speedEnd: 420, chunks: [], encounterId: null, music: 'depot', zones: [],
  },
  {
    id: 5, key: 'neighbourhood', title: 'Familiar Territory', objective: 'Reach your own neighbourhood.',
    opening: 'I know that fence!', encounter: 'A race with the yard dog',
    implemented: false, speedStart: 370, speedEnd: 440, chunks: [], encounterId: null, music: 'depot', zones: [],
  },
  {
    id: 6, key: 'home', title: 'Almost Home', objective: 'Reach the garden gate.',
    opening: "Almost home. Of course he's back.", encounter: "The dogcatcher's contraption",
    implemented: false, speedStart: 380, speedEnd: 460, chunks: [], encounterId: null, music: 'depot', zones: [],
  },
];

export function chapterById(id: number): ChapterDef {
  const c = CHAPTERS.find((ch) => ch.id === id);
  if (!c) throw new Error(`Unknown chapter ${id}`);
  return c;
}
