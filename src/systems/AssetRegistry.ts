import type Phaser from 'phaser';
import { ASSET_MANIFEST } from '../data/assetManifest';
import { generateHeroArt } from './art/heroArt';
import { generateSceneArt } from './art/sceneArt';
import { generateWorldArt } from './art/worldArt';

/** Queue real asset files for every manifest entry that is no longer a placeholder. */
export function queueAssetFiles(scene: Phaser.Scene): void {
  for (const a of ASSET_MANIFEST) {
    if (!a.placeholder) scene.load.image(a.key, a.file);
  }
}

/** Generate procedural placeholder art for any key not supplied as a file. */
export function generateMissingArt(scene: Phaser.Scene): string[] {
  generateHeroArt(scene);
  generateWorldArt(scene);
  generateSceneArt(scene);
  return ASSET_MANIFEST.filter((a) => !scene.textures.exists(a.key)).map((a) => a.key);
}

/** Display scale for art: replacements and placeholders are both authored at 2×. */
export const ART_SCALE = 0.5;
