---
{
  "id": "dungeon",
  "name": "Dungeon",
  "family": "world",
  "entry": "compose_world",
  "summary": "Mint a torch-lit fantasy INTERIOR from a tiny { chambers, tunnels } graph RECIPE — organic round chambers at elevation joined by sloping tunnels, walkable and .glb-exportable.",
  "when": "Reach for this on framing like 'make a dungeon / a cave / a cavern network / a crypt / a lair / a torch-lit underground level / a walkable cave system'."
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
      palette?, material? }
  ],
  tunnels: [
    { from: id, to: id, style?, radius?, clearance?,   // style 'tube'
      width?, height?,                                  // style 'corridor'
      base?, material? }
  ],
  style?:    { palette?, material?, tunnel?: { base?, material? } },
  lighting?: { ambient?, tint?, fireColor?, fireIntensity?, gain?, reflectivity? },
  walk?:     { speed?, minEye?, gravity?, radius? } | false,
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

## Style bible (palette + material)

Spec-level `style` applies to every chamber/tunnel; per-chamber/per-tunnel fields override. Defaults reproduce the historic cave browns byte-identically.

- `palette` — albedo hex per surface: `{ floor?, wall?, ceiling? }` (defaults `#6f5a40` / `#7d6750` / `#9a866a`).
- `material` — a finish from the material shelf, per surface (`{ floor?, wall?, ceiling? }`) or one bare value for all three. A value is a shelf name (`gold`, `steel`, `chrome`, `bronze`, `silver`, `copper`, `gunmetal`, `matte`, `plaster`, `stone`, `wood`, `rubber`, `plastic`, `satin`, `glass`, `neon`, `cel`), a `'#hex'` tint, or `{ preset, …overrides }`. Adds live specular in /world and PBR factors in the .glb. Unknown names throw at mint.
- `style.tunnel` — `{ base?: '#hex', material? }` defaults for every tunnel.

## Lighting

- `ambient` (default 0.2), `tint` ([r,g,b] multipliers, warm by default).
- `fireColor` ([r,g,b], default `[1, 0.56, 0.24]`), `fireIntensity` (default 1.7).
- `gain` (default 1.55), `reflectivity` (default 0.6) — the traced-diffusion bake dials.

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
