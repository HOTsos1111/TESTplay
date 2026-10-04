import Phaser from 'phaser';
import { COPY } from '../data/copy';
import { Audio } from '../systems/AudioManager';
import { progress } from '../systems/ProgressStore';
import { panel } from '../ui/Backdrop';
import { centerMenu } from '../ui/layout';
import { isFullscreen, toggleFullscreen } from '../ui/fullscreen';
import { Button, MenuNav } from '../ui/Button';
import { COLOR, CSS, textStyle } from '../ui/theme';

/** Overlay launched on top of a paused GameScene. */
export class PauseScene extends Phaser.Scene {
  private chapter = 1;
  constructor() {
    super('Pause');
  }

  create(data: { chapter: number }): void {
    this.chapter = data.chapter ?? 1;
    this.add.rectangle(-400, 0, 2080, 720, COLOR.outline, 0.55).setOrigin(0);
    centerMenu(this);
    panel(this, 640, 375, 520, 580);
    this.add.text(640, 150, COPY.paused, textStyle(56, CSS.butter, 10)).setOrigin(0.5);

    const s = progress.state.settings;
    const audioLabel = () => `Sound: ${progress.state.settings.sfxVolume > 0 || progress.state.settings.musicVolume > 0 ? 'On' : 'Off'}`;
    const remembered = { music: s.musicVolume || 0.6, sfx: s.sfxVolume || 0.8 };
    const buttons: Button[] = [];
    buttons.push(new Button(this, 640, 260, COPY.resume, () => this.resume(), { width: 340, color: COLOR.coral }));
    buttons.push(new Button(this, 640, 345, COPY.tryAgain, () => this.restart(), { width: 340, height: 64, fontSize: 26 }));
    const audioBtn = new Button(this, 640, 425, audioLabel(), () => {
      const st = progress.state.settings;
      const on = st.sfxVolume > 0 || st.musicVolume > 0;
      if (on) progress.setSettings({ musicVolume: 0, sfxVolume: 0 });
      else progress.setSettings({ musicVolume: remembered.music, sfxVolume: remembered.sfx });
      const ns = progress.state.settings;
      Audio.setVolumes(ns.musicVolume, ns.sfxVolume);
      audioBtn.setText(audioLabel());
    }, { width: 340, height: 64, fontSize: 26, color: 0x6f86a8 });
    buttons.push(audioBtn);
    const fsLabel = () => (isFullscreen() ? 'Exit full screen' : 'Full screen');
    const fs = new Button(this, 640, 505, fsLabel(), () => {
      toggleFullscreen(this);
      this.time.delayedCall(400, () => fs.setText(fsLabel()));
    }, { width: 340, height: 64, fontSize: 26, color: 0x6f86a8 });
    buttons.push(fs);
    buttons.push(new Button(this, 640, 585, COPY.headHome, () => this.quit(), { width: 340, height: 64, fontSize: 26, color: 0x6f86a8 }));
    new MenuNav(this, buttons, () => this.resume());
    this.input.keyboard?.on('keydown-P', () => this.resume());
    this.add.text(640, 648, 'Esc or P to resume', textStyle(20, CSS.cream, 4)).setOrigin(0.5);
  }

  private resume(): void {
    this.scene.stop();
    this.scene.resume('Game');
  }

  private restart(): void {
    const cp = progress.state.checkpoint;
    this.scene.stop('Game');
    Audio.resumeMusic();
    this.scene.start('Game', { chapter: this.chapter, startAt: cp?.chapter === this.chapter ? 'encounter' : 'start' });
  }

  private quit(): void {
    Audio.resumeMusic();
    this.scene.stop('Game');
    this.scene.start('Title');
  }
}
