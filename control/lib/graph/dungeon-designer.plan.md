# dungeon-designer

The fantasy-interior primitive. A **dungeon** is a network of **chambers** joined by
**tunnels**, laid out in 3D with **elevation**. It renders fantasy-like, open-ended
spaces — caves now; castle interiors, crypts, mines later.

## Why it's its own primitive (vs. houses/rooms)

`suite-layout` + the box `buildRoomShellFaces` path generate **regular built space**:
axis-aligned rooms, flat floors/walls/ceilings, doorways on a corridor line. That's
the right model for houses, offices, apartments — *flat, rectilinear, generative*.

`dungeon-designer` is the opposite end: **organic, open-ended, dynamic**. The one
invariant it keeps from built space is **there is a ceiling and a floor** (it's an
*interior*, not an open landscape/sky). Everything else is loosened:

- floors may undulate (wave / rubble) — or be flat,
- walls may bulge and recede (cave rock; later, tiled castle stonework) — or be flat,
- ceilings may vault (inner dome; later, groin vaults, beams) — or be flat.

The point is NOT that surfaces are never flat — a hall can have a flat floor and a
tiled wall. The point is that **the primitive refuses to ASSUME the regularities that
real built space relies on**, because fantasy interiors break them:

- no global gravity-normal "up" floor — chambers sit at arbitrary elevations and
  passages ramp between them;
- no uniform ceiling height, no axis alignment, no one footprint shape;
- no procedural-built-space rules (doorway-on-a-corridor-line, rooms-tile-a-grid) —
  geometry is placed explicitly from the graph, not derived from building conventions.

So "flat" is a per-surface *option*, never a load-bearing assumption. Everything is
driven by a **graph spec** (`{chambers, tunnels}`) — a dungeon is data, not hand-placed
geometry, and not procedurally inferred from real-world constraints.

## Model

```
spec = {
  chambers: [
    { id, at:[x,y], elevation:z, radius, height,
      wall:'cave'|'flat', floor:'wave'|'flat', ceiling:'dome'|'flat',
      relief:'golden'|'rolling', seed,
      reliefAmp?, floorAmp?, ceilingAmp? }
  ],
  tunnels: [
    { from:id, to:id, radius?, style?:'tube', clearance? }
  ],
  lighting: { ambient?, tint?, fireColor?, fireIntensity?, gain?, reflectivity? },
}
```

- **chamber** — a volume with floor + wall + ceiling, built by `buildRoundRoomShellFaces`
  (round today), translated to its `elevation`. Surface STYLES are pluggable strings.
- **tunnel** — carves a **mouth** in each chamber wall it joins (`wallOmitArcs`) at the
  azimuth toward the neighbour, and bridges the mouths with a rock **tube** at floor
  level — so it slopes (a ramp) when the chambers differ in elevation.
- **lighting** — a fire per chamber + glows along each tunnel, **traced** (occluded by
  the rock relief, bounced, pooled) → the fantasy mood, and self-shadowing that makes
  the relief read as carved.

## Views

- `renderDungeonWorld(spec)` — a walkable three.js World (WASD + mouse, gravity, wall
  collision), spawned in the first chamber. Fully enclosed; traverse chamber→tunnel→
  chamber across elevations.
- `renderDungeonSection(spec)` — the **ant-farm** cutaway: open-top chambers sliced at
  the section plane so the whole colony reads as one cross-section.

## Pipeline

`planDungeon(spec)` → resolves chambers + tunnel mouths + tube endpoints + spawn +
bounds. `buildDungeonFaces(plan, {section})` → builds chamber shells (with carved
mouths) + tubes, bakes the traced fire lighting, returns the lit face list. The render
fns pad triangles → quads for the World mesh builder and emit.

## Geometry kernels it composes (in scene-css3d.js)

- `buildRoundRoomShellFaces` — chamber shell (wall/floor/ceiling), `relief:'golden'`,
  `wallOmitArcs` (carved mouths), `ceilingSurface:'dome'`, `floorSurface:'wave'`.
- `waveCaveFaces` / `polarDiscFaces` — the relief tessellation kernels (golden bump
  fields scattered by 1/φ + the 137.5° phyllotaxis sunflower).
- `bakeSceneDiffusion` — traced torch/fire light.

## Roadmap (next)

1. **Texture tiles** — skin the relief facets with material tiles (rock, brick,
   flagstone, dressed stone) via `surface-textures.js`. Each facet already carries a
   `normal` + UV-able quad; the styles (`wall:'cave'|'castle'`, a `material` field) are
   the seam.
2. ~~**Airseal the hallways**~~ — DONE (basic): `tunnel.style:'corridor'` builds an
   enclosed box passage (flat walkable floor + side walls + ceiling, floor material),
   ramping between elevations; the carved mouth is sized under the corridor so the mesh
   covers the hole. NOT mitered to the curved wall yet — it overshoots into the rock
   (sealed but ugly outside). Next: miter the corridor end to the chamber wall, and
   skin it with material tiles instead of flat fill.
3. **Castle interiors** — non-cave chamber styles: rectangular halls, pillared rooms,
   vaulted ceilings; flat-but-tiled floors. The "not flat" stays optional per surface.
4. **Graph authoring** — validate(spec); a from-seed generator (rooms-and-corridors)
   so a dungeon can be minted procedurally.
5. **Non-round chambers** — generalize the chamber footprint (the surface→world mapping
   already supports it; round is one mapping).

## Status

Done: graph spec → chambers at elevation, carved tunnel mouths, sloping tube tunnels,
traced fire lighting, walkable World + ant-farm section. Spikes:
`dungeon-designer.spike.gen.test.js` (canonical), and the journey spikes
`cave-world` / `cave-network` / `cave-walk`.
