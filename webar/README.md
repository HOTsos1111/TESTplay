# Homeward Hound in 3D (WebAR)

The game's dachshund hero as a small, animated 3D model, made to be placed in AR in a web browser.

| File | Size | Use |
| --- | --- | --- |
| `hound.glb` | ~78 KB | Main file. Meshopt + quantized (`EXT_meshopt_compression`, `KHR_mesh_quantization`). three.js, model-viewer, 8th Wall, Babylon, A-Frame (with the meshopt decoder). |
| `hound-draco.glb` | ~57 KB | Fallback for viewers that only support Draco (`KHR_draco_mesh_compression`). |
| `index.html` | | Viewer page with an AR button (model-viewer: WebXR, Android Scene Viewer, iOS Quick Look). |

- About 11k triangles, 8 flat-colour materials (palette from `art-src/hero.png`), no textures.
- Real-world size: about 0.5 m nose to tail, standing on the floor at the origin, facing +Z.
- One looping 4-second clip, **Idle**: breathing, a curious head tilt, ear sway, tail wag and a blink.

## Rebuild

```bash
cd webar
npm install
node build-hound.mjs
```

All geometry and animation are made in `build-hound.mjs`. Change shapes, colours or timings there and rebuild.

## Try it

Serve this folder over HTTPS and open `index.html` on a phone (AR needs HTTPS). For a quick local look:
`npx serve webar`.

iOS Quick Look uses USDZ. model-viewer converts the GLB on the fly, but the animation doesn't carry over.
For an animated iPhone version, export `hound.usdz` from Reality Converter and add `ios-src="hound.usdz"`.
