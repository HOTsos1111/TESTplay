import Phaser from 'phaser';
import { DEPTH } from '../data/config';
import { COPY } from '../data/copy';
import { Audio } from '../systems/AudioManager';
import { progress } from '../systems/ProgressStore';
import { Backdrop, panel } from '../ui/Backdrop';
import { Button, MenuNav } from '../ui/Button';
import { COLOR, CSS, textStyle } from '../ui/theme';

const pct = (v: number) => `${Math.round(v * 100)}%`;

export class SettingsScene extends Phaser.Scene {
  private backdrop!: Backdrop;
  private from = 'Title';
  private confirmReset = false;

  constructor() {
    super('Settings');
  }

  create(data: { from?: string }): void {
    this.from = data.from ?? 'Title';
    this.confirmReset = false;
    this.backdrop = new Backdrop(this, 0.55, 15);
    panel(this, 640, 380, 760, 560).setDepth(DEPTH.hud);
    this.add.text(640, 60, COPY.settings, textStyle(54, CSS.butter, 10)).setOrigin(0.5).setDepth(DEPTH.hud);

    const buttons: Button[] = [];
    const row = (y: number, label: string, get: () => number, set: (v: number) => void) => {
      this.add.text(330, y, label, textStyle(28)).setOrigin(0, 0.5).setDepth(DEPTH.hud);
      const val = this.add.text(760, y, pct(get()), textStyle(28, CSS.cream)).setOrigin(0.5).setDepth(DEPTH.hud);
      const change = (d: number) => {
        set(Math.round(Math.min(1, Math.max(0, get() + d)) * 10) / 10);
        val.setText(pct(get()));
        const s = progress.state.settings;
        Audio.setVolumes(s.musicVolume, s.sfxVolume);
        Audio.play('bark');
      };
      buttons.push(new Button(this, 670, y, '–', () => change(-0.1), { width: 64, height: 56, fontSize: 32 }).setDepth(DEPTH.hud));
      buttons.push(new Button(this, 850, y, '+', () => change(0.1), { width: 64, height: 56, fontSize: 32 }).setDepth(DEPTH.hud));
    };
    row(160, 'Music', () => progress.state.settings.musicVolume, (v) => progress.setSettings({ musicVolume: v }));
    row(240, 'Sound effects', () => progress.state.settings.sfxVolume, (v) => progress.setSettings({ sfxVolume: v }));

    const hitLabel = () => `Show hitboxes: ${progress.state.settings.showHitboxes ? 'On' : 'Off'}`;
    const hit = new Button(this, 640, 330, hitLabel(), () => {
      progress.setSettings({ showHitboxes: !progress.state.settings.showHitboxes });
      hit.setText(hitLabel());
    }, { width: 420, height: 60, fontSize: 24, color: 0x6f86a8 });
    buttons.push(hit);
    buttons.push(new Button(this, 640, 405, 'Replay opening', () => this.scene.start('Story', { next: 'settings' }), { width: 420, height: 60, fontSize: 24 }));

    const reset = new Button(this, 640, 480, 'Reset progress', () => {
      if (!this.confirmReset) {
        this.confirmReset = true;
        reset.setText('Tap again to erase everything').setFocused(true);
        return;
      }
      progress.reset();
      this.confirmReset = false;
      reset.setText('Progress erased');
      this.time.delayedCall(700, () => reset.setText('Reset progress'));
    }, { width: 420, height: 60, fontSize: 22, color: COLOR.coral });
    buttons.push(reset);

    if (!progress.available) {
      this.add.text(640, 545, 'Saving is unavailable in this browser.', textStyle(20, CSS.coral, 4)).setOrigin(0.5).setDepth(DEPTH.hud);
    }
    buttons.push(new Button(this, 640, 610, COPY.back, () => this.back(), { width: 240, height: 58, fontSize: 24, color: 0x6f86a8 }).setDepth(DEPTH.hud));
    for (const b of buttons) b.setDepth(DEPTH.hud);
    new MenuNav(this, buttons, () => this.back());
  }

  private back(): void {
    this.scene.start(this.from);
  }

  update(_t: number, dms: number): void {
    this.backdrop.update(Math.min(dms / 1000, 0.1));
  }
}
