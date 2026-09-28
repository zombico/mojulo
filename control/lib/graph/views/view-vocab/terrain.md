---
{
  "id": "terrain",
  "name": "Terrain world",
  "family": "world",
  "entry": "compose_world",
  "summary": "Turn a painted landscape into a WORLD at real scale — ground in metres you walk (1.7 m eye), fly (speed grows with height) and pull back to see whole. The World page carries the recipe and builds the terrain around the camera: fine underfoot, coarse far off…",
  "when": "Reach for this on framing like 'mountains I can walk / fly over', 'make this landscape a world', 'a real-scale valley / escarpment / canyon to explore', 'cliffs I can stand under'."
}
---

Turn a painted landscape into a WORLD at real scale: ground in metres that you walk (1.7 m eye, walking pace), fly (speed grows with height above the ground) and pull back from to see the whole thing. The painting's own terrain comes along: its heartbeat or `elevation`, its `landform` (peaks, strata, scarps, joints, talus), its `erosion`, its palette and its stone. Below the painting's grid, a fracture-rough detail law carries the ground down to footstep scale, rougher on bare rock than on soil. The World page carries the RECIPE, not a mesh, and builds the terrain around the camera: fine near, coarse far, capped in memory. Exports (GLB, USD, 3MF, STL, the engines) and stills get a baked mesh of the whole world. Served at `/api/sketches/<ref>/world`; open it and use walk / fly (WASD, Space, Shift) or drag to orbit. The bookmarks are `ground`, `aerial` and `world`, plus `planet` with `planet` set.

## Parameters

Pass these via `compose_world`'s `overrides`. `seed`, `title`, `ref`, `folder_ref` are top-level `compose_world` params.

- `from` (object, required) — the painted landscape the world is made from: an inline painted-landscape recipe (`{ heartbeat | elevation, splatch, landform?, erosion?, rocks?, seed? }`, see `get_view_vocab({ id: 'painted-landscape' })`), or `{ ref: '<painted-landscape sketch>' }` to promote a stored one. A ref follows its source: edit the painting, and the world changes with it.
- `span` (number, metres; default 2400) — how many metres the painting's width covers. Heights scale by the same factor, so a 4-unit cliff in the painting stands 400 m at the default. A smaller span gives a valley; a larger one gives a range.
- `relief` (number; default 1) — vertical exaggeration on top of the span's scale.
- `horizon` (`'plain'` default | `'sea'` | `'none'`) — how the ground continues past the painting: rolling land eased down from its edges, a sea (the painting's `waterLevel` or its low ground), or nothing (the world ends at its edge).
- `planet` (`true` or `{ radius }`, metres; default radius 8 × span) — wrap the world onto a small planet you can fly up from and see whole from orbit. The painting sits at the north pole, undistorted. Past it, continents and seas run on around the globe, lit by the painting's sun, so there is a night side. High up, the sky gives way to space and a rim of air; the `planet` bookmark looks at it from three radii out. Walk stays near the painting: gravity is straight down, true there and increasingly false far across the globe.
- `detail` (`false` or `{ rock?, soil?, hurst?, crossover?, min? }`, metres) — the footstep-scale roughness. It defaults from the painting's grid: a few metres on bare rock, a fraction of that on soil, Hurst 0.8, from four grid cells down to 0.5 m. `false` gives the grid's smooth facets.
- `spawn` ([x, y], metres) — where the walk starts. Default: the painting's foreground, looking into it.
- `place` (list) — other sketches stood on the ground: `{ ref, at: [x, y], size?: metres | [w, d] (20), height?, facing?: 'N'|'E'|'S'|'W', turn?, sink? }`. Each is fitted into its footprint and seated at the lowest ground under it, less `sink`. A castle on a slope buries its downhill side instead of floating.
- `lod` (`{ minSize?, split?, maxChunks? }`) — the page's terrain budget. Defaults: the finest chunk is 32 m (1 m between vertices), split 1.6, at most 520 chunks (about 15 MB).

The world frame is metres, z up. The painting's centre is the origin, its width runs along x (±span/2), and its near side (the painting's foreground) is +y. The painting's talus scree comes along as instanced boulders.

## Recipes

- Promote a painting: `compose_world({ base: 'terrain', overrides: { from: { ref: '<painted-landscape>' } } })`.
- An escarpment to walk under: `overrides: { from: { heartbeat: 'gentle-roughness', splatch: 'verdure-trio', landform: [{ op: 'scarp', path: [[-16,-5],[0,-9],[16,-8]], throw: 4.5, side: 'right' }, { op: 'strata', thickness: 0.6 }, { op: 'talus', scree: 0.12 }] } }`.
- An alpine range at 6 km: `overrides: { span: 6000, from: { heartbeat: 'rocky-irregular', splatch: 'glacier-trio', landform: [{ op: 'peaks', height: 9, center: [0,-12], radius: 20 }, { op: 'joints', rock: 'granite', spacing: 0.9 }, { op: 'talus' }], erosion: true } }`.
- A world you can orbit: add `planet: true` (or `{ radius: 30000 }`); with `horizon: 'sea'` the painting becomes a coast.
- A tower on the rim: add `place: [{ ref: '<a solid or building>', at: [0, -800], size: 30 }]`.
