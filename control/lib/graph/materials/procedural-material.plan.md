# procedural-material — texture-free vertex-colour materials

A programmatic material system for baked world faces: the Wii/PS2-era metal look (hand-shaded diffuse +
baked lighting + brushed mottle + weathering) expressed entirely as **per-corner vertex colours** — no
textures, no shaders. It is a peer to `landscape/surface-textures.js` (procedural PNG tiles): same intent
(give a surface identity cheaply), different mechanism (vertex colours instead of a `map`).

## How to use it (the capability)

Any mesh world face can opt in by carrying a `material` field. The generic world render path
([world-scene.js](../worlds/world-scene.js) → `resolveFaceMaterials`) tessellates the face and colours
every vertex — no colour math in the builder.

```js
// a plain flat-tinted quad + a preset tag — the channel does the rest
{ corners:[...], fill:'#9aa0aa', doubleSided:true, material:'weathered-hull' }

// or an object with overrides
{ corners:[...], fill:'#c8a03c', material:{ kind:'brushed-steel', grid:6, wear:1.4, tint:'#c8a03c', seed:7 } }
```

Presets ([procedural-material.js](procedural-material.js) `MATERIAL_PRESETS`): `gradient-plate`,
`brushed-steel`, `brushed-hull`, `weathered-hull`, `weathered-heavy`. Object overrides:
`kind, grid, ramp, cloud, wear, tint, seed, lit`.

Builders can also call `resolveFaceMaterials(faces)` directly (offline renders) or `stampMaterial(faces, m)`
to tag a whole list.

## The layers (composable, all deterministic)

1. **base** — the `tint` (or face `fill`) lambert-shaded by the face normal (`lit:false` to skip)
2. **ramp** — a top-lit vertical gradient over the model's *global* z-extent (cohesive across faces)
3. **brushed** — anisotropic seeded value-noise → soft brushed-metal cloud
4. **weather** — rust patches (broad tint) + grime drips (dark vertical streaks), gravity-biased low

Add a new phenomenon (scorch, decals, edge-chipping, faction paint) as another function in the shade
stack — it reads position/normal/noise and nudges the vertex colour. That is the whole extension model.

## Invariants

- **Deterministic**: seeded value noise only (never `Math.random`) → a recipe re-renders byte-identical.
- **Additive**: a face list with no `material` is returned untouched (same reference); every existing
  world is byte-for-byte unchanged.
- **Composes** with the baked AO (`vao`) and specular (`spec`) channels — material sets colour, they
  modulate it. Both carried through tessellation.
- **Engine seam**: the render primitive is `cornerFills` (per-corner vertex colour) in
  [face-mesh.js](../figures/face-mesh.js); this module is the authoring layer over it.

## Cost / the offline↔live split

Tessellation multiplies face count by `grid²`. `resolveFaceMaterials` caps grid at `MAX_GRID` (8) as a
runaway guard, but a big world of high-grid material faces + an AO bake is expensive to render and can
exhaust a dev server. Rule of thumb: **grid 8 + AO for offline hero renders (PNG/MP4 turntables);
grid ≤4, AO off for live orbitable worlds.**

## Origin

Grew out of the mobile-suit "Wii mech" spikes (`lib/graph/mobile-suit/wii-mech-*.spike.gen.test.js`):
gradient plates → stacked greeble panels → brushed cloud → weathering. Promoted here so it is a
first-class capability available to every world (compose_world bases, controllable, edifice, …), not a
spike-local trick.
