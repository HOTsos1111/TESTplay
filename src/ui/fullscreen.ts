import Phaser from 'phaser';
import { DEPTH } from '../data/config';
import { CSS, textStyle } from './theme';

/**
 * Full screen must start from a tap or click. Some hosts (an app's in-app
 * viewer, iPhone Safari) refuse it; then we say so instead of failing silently.
 */
export function isFullscreen(scene: Phaser.Scene): boolean {
  return scene.scale.isFullscreen;
}

export function toggleFullscreen(scene: Phaser.Scene): void {
  const sm = scene.scale;
  if (sm.isFullscreen) {
    sm.stopFullscreen();
    return;
  }
  if (!sm.fullscreen.available) {
    toast(scene, 'Full screen is not available here. Try opening the link in Chrome or Safari.');
    return;
  }
  const onFail = () => toast(scene, 'Full screen was blocked here. Try opening the link in Chrome or Safari.');
  sm.once(Phaser.Scale.Events.FULLSCREEN_FAILED, onFail);
  sm.once(Phaser.Scale.Events.ENTER_FULLSCREEN, () => {
    sm.off(Phaser.Scale.Events.FULLSCREEN_FAILED, onFail);
    const orientation = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
    orientation?.lock?.('landscape').catch(() => undefined);
  });
  sm.startFullscreen({ navigationUI: 'hide' });
}

/** Try full screen once on phones when play starts (a tap is in progress). */
export function autoFullscreen(scene: Phaser.Scene): void {
  const sm = scene.scale;
  if (!sm.isFullscreen && sm.fullscreen.available && scene.sys.game.device.input.touch) {
    try {
      sm.startFullscreen({ navigationUI: 'hide' });
      const orientation = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
      orientation?.lock?.('landscape').catch(() => undefined);
    } catch {
      // Ignored: the host refused; the game still fills the window.
    }
  }
}

function toast(scene: Phaser.Scene, text: string): void {
  const cam = scene.cameras.main;
  const t = scene.add
    .text(cam.scrollX + scene.scale.width / 2, 690, text, textStyle(20, CSS.cream, 4))
    .setOrigin(0.5, 1)
    .setDepth(DEPTH.overlay + 10)
    .setScrollFactor(1);
  scene.tweens.add({ targets: t, alpha: 0, delay: 3200, duration: 400, onComplete: () => t.destroy() });
}
