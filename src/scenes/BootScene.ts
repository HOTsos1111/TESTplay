import Phaser from 'phaser';
import { generateMissingArt, queueAssetFiles } from '../systems/AssetRegistry';
import { Audio } from '../systems/AudioManager';
import { progress } from '../systems/ProgressStore';
import { CSS, textStyle } from '../ui/theme';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    queueAssetFiles(this);
  }

  create(): void {
    this.cameras.main.setBackgroundColor(CSS.outline);
    const label = this.add.text(640, 340, 'Sniffing out the way home…', textStyle(30, CSS.cream)).setOrigin(0.5);
    const dots = this.add.text(640, 396, '', textStyle(30, CSS.butter)).setOrigin(0.5);
    let n = 0;
    this.time.addEvent({ delay: 120, loop: true, callback: () => dots.setText('●'.repeat((n++ % 3) + 1)) });
    // Let the loading indicator paint before generating art synchronously.
    this.time.delayedCall(60, () => {
      const missing = generateMissingArt(this);
      if (missing.length) console.warn('Missing art for keys:', missing);
      const s = progress.state.settings;
      Audio.setVolumes(s.musicVolume, s.sfxVolume);
      label.destroy();
      this.scene.start('Title');
    });
  }
}
