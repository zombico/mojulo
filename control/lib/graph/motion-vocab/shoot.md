---
{
  "id": "shoot",
  "name": "Shoot plan (cameras as objects in a world, in After Effects terms)",
  "family": "motion",
  "entry": "create_shoot_plan",
  "summary": "Keyed cameras placed in a 3D world as visible objects — two-node or one-node, a lens in mm, Easy Ease / hold keys, a cut list; a key may follow a moving car, walker or mover. Drawn on the World page with its path; rendered by forge_motion.",
  "when": "Reach for this on 'set up a camera / plan the shots / a two-node camera / point of interest / 35mm / easy ease the key / show me the camera path / follow the car / chase cam / look through the camera'."
}
---

A shoot plan lives on a world's recipe (`manifest.shoot`). `create_shoot_plan { ref, plan }` writes it, `update_shoot_plan { ref, ops }` edits it, and the World page (`/api/sketches/<ref>/world`) draws every camera as an object: its frustum at the lens's field of view, the line to its point of interest, its motion path with a dot per frame (the spacing is the ease, as in an AE motion path), a diamond per key (white for hold), and a panel with the shots, a scrubber and LOOK THROUGH.

## After Effects → plan

| After Effects | Plan |
|---|---|
| Camera layer | `cameras[]` entry, `id` |
| Two-node camera (auto-orient toward point of interest) | `type: 'two-node'`, each key has `pos` + `poi` |
| One-node camera | `type: 'one-node'`, each key has `pos` + `yaw` / `pitch` (degrees; yaw 0 looks along +x, counter-clockwise; pitch + looks up) |
| Z rotation | `roll` (degrees; + banks the camera clockwise) |
| Preset (35mm, 50mm …) / focal length | `lens: '35mm'` or `focal_mm: 35` (film 36 mm wide, `film_mm` to change); `hfov` in degrees also reads |
| Keyframe at a time | a key `{ t, … }`, `t` in seconds of the world clock |
| Linear keyframe | `ease: 'linear'` (the default, as in AE) |
| Easy Ease (F9) | `ease: 'easy ease'` — speed 0, influence 33% on both sides of the key |
| Easy Ease In / Out | `ease: 'easy ease in'` (arrival) / `'easy ease out'` (departure) |
| Hold keyframe | `ease: 'hold'` — holds until the next key, then cuts to it |
| Spatial auto-bezier / linear | `path: 'smooth'` (default; curve through the keys at constant speed) / `'linear'` |
| Parent camera to a null / link POI to a layer | `pos` / `poi: { follow: 'car:2', offset: [x,y,z], frame: 'subject' }` |
| Cut between camera layers | `shots: [{ name, camera, span: [t0, t1] }]` |

A key missing `poi`, `lens` or `roll` keeps the previous key's. Coordinates are the world's own units, z up (the readout gives metres).

## Time

Key times and shot spans are the WORLD's clock. A shot shows the world over its span: shots in sequence cut a continuous action, and two shots over the same span are coverage of one action from two cameras. On the World page the plan drives the clock, so a cut replays the action, as in an edit.

## Following what moves

`create_shoot_plan { ref }` with no `plan` lists what a key can follow (`subjects_at: <seconds>` gives where each one is): `walker:<i>`, `car:<i>` (signalised traffic included: it stops at lights), `mover:<group>`. A followed key is read at the instant being shown; a segment between a fixed key and a followed one eases from the place onto the subject (a pickup) or off it. `frame: 'subject'` turns the offset with the subject's heading — x forward, y left, z up — so `[-3.5, 0, 1.3]` rides behind and above. Physics bodies and player- or AI-driven entities move live and cannot be followed ahead of play.

## Edits (`update_shoot_plan` ops)

`add_key { camera, key }` · `set_key { camera, t, to?, pos?, poi?, lens?, ease?, roll? }` · `remove_key { camera, t }` · `ease { camera, t? | times?, ease }` (no time = every key) · `retime { camera?, scale?, shift? }` (keys and that camera's shots) · `set_camera { camera, name?, lens?, path?, type? }` (flipping the type keeps the view) · `add_camera { camera, shot? }` · `remove_camera` · `add_shot { shot, at? }` · `set_shot` · `remove_shot` · `move_shot { shot, to }` · `set { fps }`.

## Readout (the machine gate)

`duration_s`; per camera `path_m`, `peak_speed_mps`, `lens_mm`, `follows`; `jumps` (frames where the camera teleports: a followed car wrapping its lane); `clearance.passes_through` (where a move crosses world geometry: static faces only). All advisory. Whether the shot reads is the operator's eyes gate on the World page.

## Example

```
{ cameras: [
    { id: 'crane', type: 'two-node', lens: '24mm', keys: [
      { t: 0, pos: [-16, -20, 24], poi: [20, 14, 0], ease: 'easy ease' },
      { t: 4, pos: [6, -7, 4], poi: [20, 12, 2], ease: 'easy ease' } ] },
    { id: 'chase', lens: '28mm', keys: [
      { t: 0, pos: [19, 9, 3.5], poi: { follow: 'car:3' }, ease: 'easy ease out' },
      { t: 3, pos: { follow: 'car:3', offset: [-3.5, 0, 1.3], frame: 'subject' }, poi: { follow: 'car:3', offset: [4, 0, 0], frame: 'subject' } } ] } ],
  shots: [ { name: 'Establishing', camera: 'crane', span: [0, 4] }, { name: 'Pick up the car', camera: 'chase', span: [0, 6] } ] }
```
