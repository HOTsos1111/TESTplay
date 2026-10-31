# PUGATORY in 3D

The pug hero, armed to the teeth, howling while four demon cats circle him.

**`pugatory.glb` (~1.4 MB) is the whole thing:** one self-contained binary glTF 2.0 file. Geometry, materials and
animation are all embedded; no textures, no external files, no extensions, so no Draco or meshopt decoder is
needed. It passes the Khronos glTF Validator with 0 errors, warnings or notes.

- About 65k triangles, 30 materials, 39 nodes. Y up, metres; the pug is ~0.45 m tall and faces +Z on the origin.
  The cats fly in a ~1.3 m circle around him.
- Gear: spiked collar, tactical vest and straps, shotgun-shell bandolier, shoulder gatling with spinning
  barrels, rocket pod, drum magazine with ammo belt, combat knife, three grenades.
- One looping 6-second clip, **Howl**: breathing and a blink, a wind-up, then a full howl (head back, jaw open,
  eyes squeezed shut, gatling spinning up). Low-opacity sound rings ripple out of his mouth and across the floor,
  and the cats get blown back before drifting in again.
- The rings fade by thinning to nothing as they grow, so the fade works in any viewer without the
  `KHR_animation_pointer` extension.

## Rebuild

```bash
cd webar/pugatory
npm install
node build-pugatory.mjs
```

Everything is made in `build-pugatory.mjs`. Change shapes, colours or timings there and rebuild.
