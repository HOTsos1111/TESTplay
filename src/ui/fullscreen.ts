import Phaser from 'phaser';
import { DEPTH } from '../data/config';
import { CSS, textStyle } from './theme';

type FsDoc = Document & { webkitFullscreenEnabled?: boolean; webkitFullscreenElement?: Element | null };
type FsEl = HTMLElement & { webkitRequestFullscreen?: () => void };

/**
 * Full screen must start from a tap. Embedded viewers (an iframe without the
 * fullscreen permission) and iPhone browsers refuse it, so we check up front and
 * explain instead of failing silently.
 */
export function fullscreenAllowed(): boolean {
  const d = document as FsDoc;
  const el = document.documentElement as FsEl;
  const api = typeof el.requestFullscreen === 'function' || typeof el.webkitRequestFullscreen === 'function';
  const enabled = d.fullscreenEnabled ?? d.webkitFullscreenEnabled ?? false;
  return api && enabled;
}

export function isFullscreen(): boolean {
  const d = document as FsDoc;
  return !!(d.fullscreenElement ?? d.webkitFullscreenElement);
}

function lockLandscape(): void {
  const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
  o?.lock?.('landscape').catch(() => undefined);
}

/** Request full screen on the whole page (call from a tap/click handler). */
export function enterFullscreen(): Promise<boolean> {
  const el = document.documentElement as FsEl;
  try {
    if (el.requestFullscreen) {
      return el
        .requestFullscreen({ navigationUI: 'hide' })
        .then(() => {
          lockLandscape();
          return true;
        })
        .catch(() => false);
    }
    if (el.webkitRequestFullscreen) {
      el.webkitRequestFullscreen();
      return Promise.resolve(true);
    }
  } catch {
    // fall through
  }
  return Promise.resolve(false);
}

export function exitFullscreen(): void {
  const d = document as FsDoc & { webkitExitFullscreen?: () => void };
  if (d.exitFullscreen) void d.exitFullscreen().catch(() => undefined);
  else d.webkitExitFullscreen?.();
}

export const NOT_ALLOWED_MSG = 'This viewer blocks full screen. Open the link in Chrome or Safari, or ask for the standalone version.';

export function toggleFullscreen(scene: Phaser.Scene): void {
  if (isFullscreen()) {
    exitFullscreen();
    return;
  }
  if (!fullscreenAllowed()) {
    toast(scene, NOT_ALLOWED_MSG);
    return;
  }
  void enterFullscreen().then((ok) => {
    if (!ok) toast(scene, NOT_ALLOWED_MSG);
  });
}

/** Try full screen once on phones when play starts (a tap is in progress). */
export function autoFullscreen(scene: Phaser.Scene): void {
  if (!isFullscreen() && fullscreenAllowed() && scene.sys.game.device.input.touch) void enterFullscreen();
}

export function toast(scene: Phaser.Scene, text: string): void {
  const cam = scene.cameras.main;
  const t = scene.add
    .text(cam.scrollX + scene.scale.width / 2, 700, text, { ...textStyle(20, CSS.cream, 4), wordWrap: { width: 1100 } })
    .setOrigin(0.5, 1)
    .setDepth(DEPTH.overlay + 10);
  scene.tweens.add({ targets: t, alpha: 0, delay: 4200, duration: 400, onComplete: () => t.destroy() });
}
