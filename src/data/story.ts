/**
 * The illustrated opening, one entry per page in reading order. `panels` lists
 * the x positions (as a fraction of the image width) where each extra comic
 * panel starts, so multi-panel pages can reveal left to right.
 */
import type { SfxKey } from '../systems/AudioManager';

export interface StorySlide {
  file: string;
  /** Narration shown over the page; \n starts a new line. */
  text: string;
  panels?: number[];
  sfx?: SfxKey;
}

export const STORY_SLIDES: StorySlide[] = [
  { file: 'story/01.webp', text: 'In a sunny little garden, a little hound hugged his favourite squeaky toy and drifted off to dream.', sfx: 'squeak' },
  { file: 'story/02.webp', text: 'But over the fence, two bright eyes were watching.\nSquirrel had spotted something he simply had to borrow.', sfx: 'squirrel' },
  { file: 'story/03.webp', text: 'With a tiptoe and a tug, Squirrel snatched the toy.\n“Squeak!” it said. And away he went!', sfx: 'squirrel_angry' },
  { file: 'story/04.webp', text: 'Over the fence flew Squirrel, with the toy tucked tight.\nBehind him, the garden was quiet. Too quiet.', sfx: 'jump' },
  { file: 'story/05.webp', text: 'The little hound woke with a stretch and a yawn.\nThen he looked at his empty paws. His toy was gone!', sfx: 'hit' },
  { file: 'story/06.webp', text: 'He listened with his floppy ears.\nFar away came a tiny squeak. He knew that sound!', sfx: 'squeak' },
  { file: 'story/07.webp', text: 'There was his toy, waiting inside a big van.\nOne little hop, and he could bring it home.', sfx: 'bark' },
  { file: 'story/08.webp', text: 'But just as he reached it—SLAM!\nThe doors shut tight. Outside, Squirrel giggled.', sfx: 'boss_hit' },
  { file: 'story/09.webp', text: 'The van rumbled past familiar houses, leafy paths and busy shops.\nThe little hound watched his home slip farther away.', panels: [0.312, 0.684] },
  { file: 'story/10.webp', text: 'Past tall cranes, puffing chimneys and clattering trains they went.\nThe city grew bigger, and the little hound felt smaller.', panels: [0.322, 0.68] },
  { file: 'story/11.webp', text: 'At last, the van stopped beside Dax n Pipers Deli.\nThe dogcatcher went for a sandwich. The little hound had an idea.', panels: [0.313, 0.681] },
  { file: 'story/12.webp', text: 'He wiggled his little tail through the bars. Click!\nOut he leapt, with his precious toy held tight.', panels: [0.498], sfx: 'parcel' },
  { file: 'story/13.webp', text: 'Up flew the sandwich! Away ran the hound!\nSomewhere beyond this great big city, his family was waiting.\nIt was time to find his way home.', sfx: 'boss_clear' },
];
