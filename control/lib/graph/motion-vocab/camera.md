---
{
  "id": "camera",
  "name": "Camera motion (over a manji-tree subject)",
  "family": "motion",
  "entry": "forge_motion",
  "summary": "Move a CAMERA over a single manji-tree subject (a stored sketch, the figure rig, or a terrain world) — turntable / orbit / push_in / dolly_zoom / flythrough — rendered to a flipbook SVG + GIF.",
  "when": "Reach for this on 'spin it / a turntable / orbit it / fly through / zoom in on / a slow push in on the figure'."
}
---

CAMERA motions move a camera over a SINGLE manji-tree subject. `worldUp` is the Zenith–Nadir axis, so the same orbit/dolly code that framed a figure also frames a canyon. The subject's own `camera.worldFraming` is the BASE shot; the motion perturbs it. Renders a self-contained CSS flipbook SVG (durable) + an animated GIF; `export:'mp4'` bakes a downloadable H.264 beside the SVG.

## Subject

`subject.sketch_ref` — a stored sketch (`sk_…`) whose `manifest.kind` is `manji-tree`; OR `subject.manji_tree` — an inline manji-tree manifest (tree / waveFields / camera / …). (For a traversable three.js world subject — city / hub / room / terrain / planet — use the `world` family instead.)

## Shot

`shot.motion` (one of): `turntable` / `orbit` lock the centred subject under a shared (union) viewBox while the camera circles; `push_in` / `dolly_zoom` / `flythrough` re-frame into a fixed film frame.

`shot.params`:
- `orbit` — `{ from, to }` degrees.
- `push_in` / `dolly_zoom` — `{ end_scale }` (<1 = closer).
- `flythrough` — REQUIRES `{ keyframes: [{ pos, lookAt, fov }, …] }` (≥2).
- optional across camera shots: `{ camera_position, look_at, fov, width, height, gif_width, bg }`.
- `frames` (default per motion), `fps` (default 12), `loop` (default true).

## Chemistry / structure note (the deck-vs-camera fork)

If a concept is a 3D object that must ROTATE to be understood (a molecule, a lattice, a mechanism), use a camera `turntable`/`orbit` here rather than a deck. Ball-and-stick = lathes (a ball = a dome-profile lathe `[{t:0,radius:0},{t:0.5,radius:R},{t:1,radius:0}]` about a short axis; a rod = a constant-radius lathe between two atom centres). Give each lathe `style:{ fill:'vexar', fillColor:'#hex' }` for LIT shaded solids (default is wireframe); optional manifest `light:{ direction, ambient, diffuse }`. The atomic BOND is a `vajra` primitive (two outer spheres + a thin hub); chirality / a double helix / DNA is the `taiji` primitive (a SIGNED `twist`). Multi-atom molecules and chiral helices INTERPENETRATE / self-fold, so they belong on this BAKED turntable (it depth-sorts every frame) — but a SINGLE convex solid that never self-occludes can instead spin live via a `solid-turntable`.

## Worked example

```
{ subject: { sketch_ref: 'sk_…' }, shot: { motion: 'turntable' } }
```
