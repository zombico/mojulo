---
{
  "id": "dungeon",
  "name": "Dungeon",
  "family": "world",
  "entry": "compose_world",
  "summary": "Mint a torch-lit fantasy INTERIOR from a tiny { chambers, tunnels } graph RECIPE — organic round chambers at elevation joined by sloping tunnels, walkable and .glb-exportable.",
  "when": "Reach for this on framing like 'make a dungeon / a cave / a cavern network / a crypt / a lair / a torch-lit underground level / a walkable cave system', and for fire in one: 'braziers / wall torches / a fireball trap / green witch-fire' (`fire`)."
}
---

Mint a torch-lit fantasy INTERIOR from a tiny graph RECIPE. A dungeon is a network of CHAMBERS joined by TUNNELS, laid out in 3D with ELEVATION — deliberately the opposite of the flat generative house/room generators: organic, not-flat, open-ended (caves now; castle interiors, crypts, mines later). The one invariant is "there is a ceiling and a floor" — it's an interior — but no surface is assumed flat: floors undulate, walls bulge, ceilings vault, and a fire per chamber plus glows along each tunnel are TRACED over the rock so the relief self-shadows. The substrate stores ONLY the recipe (`manifest.kind === 'dungeon'`, no geometry) and regenerates it deterministically on render: a walkable, dependency-free three.js World (WASD + mouse-look + gravity + wall collision, spawned in the first chamber) at `/api/sketches/<ref>/world`, plus a `.glb` export via the model tool. Structural validity (a tunnel to an unknown chamber, an unknown material name) fails at mint; the movement-flow check (a sealed chamber with no exit) is advisory only — surfaced, never gated.

Reach for this on framing like 'make a dungeon / a cave / a cavern network / a crypt / a lair / a torch-lit underground level / a walkable cave system'.

## Spec shape

Pass everything via `compose_world`'s `overrides` (identity base — overrides ARE the mint params). `seed`, `title`, `ref`, `folder_ref` are top-level `compose_world` params.

```
{
  chambers: [
    { id, at: [x, y], elevation?, radius?, height?,
      wall?, floor?, ceiling?, relief?, seed?,
      reliefAmp?, floorAmp?, ceilingAmp?,
      palette?, material?, texture? }
  ],
  tunnels: [
    { from: id, to: id, style?, radius?, clearance?,   // style 'tube'
      width?, height?,                                  // style 'corridor'
      base?, material?, texture? }
  ],
  style?:    { palette?, material?, texture?, tunnel?: { base?, material?, texture? } },
  lighting?: { ambient?, tint?, fireColor?, fireIntensity?, gain?, reflectivity? },
  fire?:     true | { sources?, embers?, smoke?, light? },
  walk?:     { speed?, minEye?, gravity?, radius?, spawn?, ground?, yaw? } | false,
  viewBox?:  { width, height }
}
```

## Chambers

A chamber is a round volume with floor + wall + ceiling, translated to its `elevation`.

- `id` (string) — name other chambers' tunnels reference. Defaults to `chamber-<i>`.
- `at` ([x, y]) — footprint center in world units. Default `[0, 0]`.
- `elevation` (number) — floor z. Chambers at different elevations get RAMPING tunnels. Default 0.
- `radius` / `height` (numbers) — default 7 / 9.
- `wall` — `'cave'` (bulging rock) | `'flat'`. Default `'cave'`.
- `floor` — `'wave'` (undulating) | `'flat'`. Default `'wave'`.
- `ceiling` — `'dome'` (vaulted) | `'flat'`. Default `'dome'`.
- `relief` — `'golden'` (phyllotaxis bump field) | `'rolling'`. Default `'golden'`.
- `seed` (integer) — the chamber's relief seed (deterministic; default `i + 2`).
- `reliefAmp` / `floorAmp` / `ceilingAmp` (numbers) — amplitude dials for wall bulge / floor wave / ceiling vault.

## Tunnels

A tunnel carves a MOUTH in each chamber wall it joins and bridges them; it slopes freely, reading as a ramp between elevations.

- `from` / `to` (chamber ids) — an unknown id throws at mint.
- `style` — `'tube'` (enclosed round rock tube at floor + radius height) | `'corridor'` (airsealed box passage: flat walkable floor, side walls, ceiling — the walkable choice). Default `'tube'`.
- `radius` (number) — tube radius, and the corridor's size basis. Default 2.2.
- `clearance` (number, tube) — mouth oversize factor. Default 1.45.
- `width` / `height` (numbers, corridor) — default `2*radius` / `2.4*radius`.

## Style bible (palette + material + texture)

Spec-level `style` applies to every chamber/tunnel; per-chamber/per-tunnel fields override. Defaults reproduce the historic cave browns byte-identically.

- `palette` — albedo hex per surface: `{ floor?, wall?, ceiling? }` (defaults `#6f5a40` / `#7d6750` / `#9a866a`).
- `material` — a finish from the material shelf, per surface (`{ floor?, wall?, ceiling? }`) or one bare value for all three. A value is a shelf name (`gold`, `steel`, `chrome`, `bronze`, `silver`, `copper`, `gunmetal`, `matte`, `plaster`, `stone`, `wood`, `rubber`, `plastic`, `satin`, `glass`, `neon`, `cel`), a `'#hex'` tint, or `{ preset, …overrides }`. Adds live specular in /world and PBR factors in the .glb. Unknown names throw at mint.
- `texture` — a surface-textures TILE per surface (`{ floor?, wall?, ceiling?, scale? }`) or one bare key for all three: `rock-cave` (baseline cavern rock), `rock-granite`, `rock-sandstone`, or any key from the surface-textures shelf (`defineRockTile` mints custom tones). The tile multiplies the traced fire bake per face (texel × baked light, the 6th-gen "painted diffuse over Gouraud" read) in /world and the .glb; walls map along the ring, floor/ceiling by world XY. `scale` is world units per tile repeat (default 2.4). Tunnels inherit the style's `wall` key unless they name their own. Unknown keys throw at mint. Absent ⇒ bare fills, as before.
- `style.tunnel` — `{ base?: '#hex', material?, texture? }` defaults for every tunnel.

- `audio` (object) — Optional world AUDIO channel (generic across every base; resolved on the live /world path): { soundtrack?: { beatsRef: '<stored beats ref>' } or an inline beats recipe (compositions loop), sfx?: { beatsRef? | cues?, on? }, footsteps?: true|{ step, jump, land }, wind?: true|{ level, freq }, bindings? (soundtrack channel macros) }. Validated at mint — an unknown beats ref or invalid recipe REFUSES the mint rather than storing a world that fails to render. Vocabulary: get_beats_vocab({ id: 'audio-beats' }).

## Lighting

- `ambient` (default 0.2), `tint` ([r,g,b] multipliers, warm by default).
- `fireColor` ([r,g,b], default `[1, 0.56, 0.24]`), `fireIntensity` (default 1.7). These colour the light baked into the walls; on their own the chamber fires are glows. For flames you can see — braziers, torches on the walls, flicker on the bake — use `fire` (below).
- `gain` (default 1.55), `reflectivity` (default 0.6) — the traced-diffusion bake dials.

## Fire

`fire: true` lights the dungeon with live fire: each chamber's fire becomes a brazier (an iron bowl on three legs, coals glowing), and each tunnel's two lights become torches in brackets on alternate walls. The flames puff and wander, throw embers, smoke against the ceiling, and their flicker plays over the light the bake already put on the walls. `{ sources: [{ kind, at: [x, y, z], size?, phi? }] }` adds fires anywhere (`kind`: `candle`, `torch`, `brazier`, `campfire`); `embers: false` and `smoke: false` leave those out; `light` (1) scales how far the fires light. `color` colours fire as fireworks are coloured, by a metal salt in the flame: `sodium` yellow, `calcium` orange, `strontium` red, `lithium` crimson, `barium` and `boron` green, `copper` blue, `potassium` lilac, a mix (`{ strontium: 1, copper: 0.5 }`), or `'#rrggbb'` for a fire no salt gives (magic, ghost-light); on `fire` it colours every fire (and the bake takes the hue, so the walls glow in it), on a source just that one. A coloured flame burns clean (`soot`, 0–1, keeps some ordinary yellow); `smokeColor: '#rrggbb'` gives a source a signal smoke. `life` (kindle, die back) and `flares` (a whoosh now and then) make a fire burn up and down; `kind: 'fireball'` with `path: { from, to, speed?, arc?, every?, delay? }` is a trap or a spell: a ball of fire down a corridor every few seconds, trailing its tail and bursting where it lands. Live World page only; exports keep the baked light and the point lights they already get. For a high-resolution still in Blender Cycles, the Blender pack (`export_model({ ref, format: 'blender', fire_t })`, or `node scripts/export-blender.mjs --ref <ref> --fire-t <seconds>` with its machine gate) carries the fire at that instant: each flame as an OpenVDB volume of light, its smoke, embers, a light per fire and its props, and `import_mojulo.py -- --mode render --res 3840x2160` renders it (the pack's README has the dials).

## Worked example

The canonical hub-and-spokes (from the spike): a hub with three spoke chambers at varied elevations, joined by airsealed corridors.

```
compose_world({
  base: 'dungeon',
  title: 'hub caverns',
  overrides: {
    chambers: [
      { id: 'hub',   at: [0, 0],    elevation: 0,    radius: 7,   height: 9 },
      { id: 'west',  at: [-17, 5],  elevation: -2.5, radius: 6,   height: 8 },
      { id: 'east',  at: [15, -3],  elevation: -4,   radius: 6,   height: 8 },
      { id: 'north', at: [3, 18],   elevation: -1.5, radius: 5.5, height: 7.5 }
    ],
    tunnels: [
      { from: 'hub', to: 'west',  style: 'corridor' },
      { from: 'hub', to: 'east',  style: 'corridor' },
      { from: 'hub', to: 'north', style: 'corridor' }
    ],
    lighting: { ambient: 0.2, fireIntensity: 1.7, gain: 1.55 }
  }
})
```

Returns `{ ok, ref, worldUrl, url, recipe, stats: { chambers, tunnels, faces, spawn }, advisory }` — `advisory` is the movement-flow readout (`{ impairment, necessary, preferential, ok }`; a sealed chamber is flagged, never refused). Themes: no theme lowering yet — use `overrides` (the mars-colony pack's material axis lands here later).

For engine handoff, `walk.spawn` is the feet position and `walk.ground` sets the
height of the fallback ground plane. Set it below the lowest chamber in a descending
cave so the fallback does not block the sloping passages. Geometry remains the floor.
`walk.yaw` (degrees, counter-clockwise from +x seen from above) is the seat's facing;
an engine spawns the player looking that way. Any walkable kind accepts these three.
