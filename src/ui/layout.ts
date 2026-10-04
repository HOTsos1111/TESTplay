import Phaser from 'phaser';
import { VIEW } from '../data/config';

/**
 * The game is 720 px tall and between 1280 and VIEW.maxWidth wide, matching the
 * screen's shape so wide phones are filled edge to edge. Menus are laid out on
 * the 1280 design width and centred by scrolling their camera.
 */
export function extraWidth(scene: Phaser.Scene): number {
  return Math.max(0, scene.scale.width - VIEW.width);
}

/** Centre 1280-wide menu content and keep it centred on resize. */
export function centerMenu(scene: Phaser.Scene, onLayout?: (width: number, left: number) => void): void {
  const apply = () => {
    const extra = extraWidth(scene);
    scene.cameras.main.setScroll(-extra / 2, 0);
    onLayout?.(scene.scale.width, -extra / 2);
  };
  apply();
  scene.scale.on(Phaser.Scale.Events.RESIZE, apply);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.scale.off(Phaser.Scale.Events.RESIZE, apply));
}

/** Pick the game width for the current window shape. */
export function gameWidthFor(windowW: number, windowH: number): number {
  if (windowH <= 0) return VIEW.width;
  const w = Math.round((VIEW.height * windowW) / windowH);
  return Math.min(VIEW.maxWidth, Math.max(VIEW.width, w));
}
