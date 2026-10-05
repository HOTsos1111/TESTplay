import Phaser from 'phaser';
import { VIEW } from './data/config';
import { BootScene } from './scenes/BootScene';
import { ChapterMapScene } from './scenes/ChapterMapScene';
import { GameScene } from './scenes/GameScene';
import { HowToScene } from './scenes/HowToScene';
import { PauseScene } from './scenes/PauseScene';
import { ResultsScene } from './scenes/ResultsScene';
import { SettingsScene } from './scenes/SettingsScene';
import { StoryScene } from './scenes/StoryScene';
import { TitleScene } from './scenes/TitleScene';
import { UpgradeScene } from './scenes/UpgradeScene';
import { Audio } from './systems/AudioManager';
import { registerTestHook } from './systems/debug';
import { gameWidthFor } from './ui/layout';
import { enterFullscreen, fullscreenAllowed, isFullscreen } from './ui/fullscreen';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: VIEW.width,
  height: VIEW.height,
  backgroundColor: '#302331',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  input: { activePointers: 4 },
  // Audio is procedural Web Audio managed by AudioManager.
  audio: { noAudio: true },
  disableContextMenu: true,
  render: { antialias: true, roundPixels: false },
  scene: [BootScene, TitleScene, StoryScene, HowToScene, ChapterMapScene, GameScene, PauseScene, ResultsScene, UpgradeScene, SettingsScene],
});

// Match the game's width to the screen's shape so wide phones are filled edge to edge.
const fitWidth = () => {
  // Size from the actual play area (it can be smaller than the window inside an app viewer).
  const box = document.getElementById('game')?.getBoundingClientRect();
  const w = gameWidthFor(box?.width || window.innerWidth, box?.height || window.innerHeight);
  if (game.scale.width !== w) game.scale.setGameSize(w, VIEW.height);
};
window.addEventListener('resize', fitWidth);
window.addEventListener('orientationchange', () => setTimeout(fitWidth, 200));
game.events.once(Phaser.Core.Events.READY, fitWidth);

// On phones, snap to full screen on the first tap (it must happen inside the tap itself).
const firstTap = () => {
  window.removeEventListener('touchend', firstTap);
  if (!isFullscreen() && fullscreenAllowed()) void enterFullscreen();
};
window.addEventListener('touchend', firstTap, { passive: true });
document.addEventListener('fullscreenchange', () => setTimeout(fitWidth, 150));

// Browsers only allow audio after a user gesture.
const unlock = () => Audio.unlock();
for (const ev of ['pointerdown', 'keydown', 'touchend']) window.addEventListener(ev, unlock, { passive: true });

document.addEventListener('visibilitychange', () => {
  if (document.hidden) Audio.suspend();
  else Audio.resume();
});

// Keep the page from scrolling or zooming while playing.
document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
window.addEventListener('keydown', (e) => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
});

registerTestHook('scenes', () => game.scene.getScenes(true).map((s) => s.scene.key));
registerTestHook('manager', () => game.scene);
registerTestHook('audio', () => Audio);
registerTestHook('listeners', () => {
  const g = game.scene.getScene('Game');
  return {
    hidden: game.events.listenerCount(Phaser.Core.Events.HIDDEN),
    blur: game.events.listenerCount(Phaser.Core.Events.BLUR),
    pointerdown: g.input?.listenerCount(Phaser.Input.Events.POINTER_DOWN) ?? 0,
    keys: Object.keys(g.input?.keyboard?.keys ?? {}).filter((k) => (g.input!.keyboard!.keys as unknown[])[Number(k)]).length,
    objects: g.children?.length ?? 0,
  };
});
