---
{
  "id": "edifice",
  "name": "Edifice (bespoke building)",
  "family": "structure",
  "entry": "mint_solid",
  "summary": "Mint a bespoke inhabitable BUILDING — a graph of MASSES joined by CONCOURSES, placed by relation; walkable + .glb; livability surfaced but never enforced.",
  "when": "Reach for this on 'design/build a bespoke building / a campus / a connected building complex / a custom <building type>'."
}
---

Mint a BESPOKE inhabitable building authored as a GRAPH. An edifice is the building-scale sibling of the object workbench: where the workbench bonds object monomers, an edifice composes MASSES (footprint + floors + facade + roof + interior) connected by CONCOURSES (halls), placed by RELATION — a root mass anchored absolutely, the rest sitting *on* a neighbour (mass B east of mass A). It is the "workbench for buildings": the metaprinciple (recipe → plan → baked faces) applied to the one-off buildings the frozen generators (fractal-city / school / hub) don't produce. The substrate stores ONLY the recipe (`kind === 'edifice'`, no geometry) and regenerates it deterministically on render — a walkable, dependency-free World at `/api/sketches/<ref>/world` plus a `.glb` export. The recipe is validated by PLANNING it at mint: a bad placement, or a concourse between two masses that don't face each other, throws at mint rather than failing at render. Livability and reachability are ASSESSED and SURFACED in the mint response, but the building is minted regardless — a user's building is theirs (advisory, never gated).

Reach for this on 'design/build a bespoke building / a campus / a connected building complex / a custom <building type>'.

## Spec shape

`title`, `seed`, `theme`, `viewBox`, `ref`, `folder_ref` are top-level params; the building itself is `masses` (required) + `concourses` + `entrance`.

```
{
  masses: [                              // required, non-empty — the building volumes
    { id,                                // unique mass id (referenced by concourses + other masses' on.anchor)
      footprint: { w, d },               // ground footprint in feet (required)
      floors,                            // storey count (~11ft each); drives mass height (required)
      at: [x, y],                        // absolute placement (feet) — the ROOT mass only
      on: { anchor, side, align, gap },  // relative placement — every non-root mass
      form,                              // 'rect' (default) | 'round' (reserved for a future increment)
      facade: { material, rhythm,        // the exterior skin (required)
                glass, frame },
      roof,                              // 'flat' or a pitched form name
      interior: { kernel } }             // { kernel: 'open' } — a walkable hollow shell (default 'open')
  ],
  concourses: [                          // optional — halls that fuse masses into ONE building
    { from, to, width }
  ],
  entrance,                              // mass id the spawn point + reachability check start from
  seed,                                  // determinism seed (default 1)
  theme,                                 // suggested-defaults theme id (default 'earth-temperate')
  viewBox: { width, height }
}
```

## Masses

Each mass is a volume with a footprint, a storey count, an exterior skin, and a placement. Exactly one mass — the root — carries `at`; every other mass sits `on` a neighbour.

- `id` (string) — unique mass id, referenced by concourses and by other masses' `on.anchor`.
- `footprint` (`{ w, d }`, required) — ground footprint in feet.
- `floors` (integer, required) — storey count (each ~11ft); drives the mass height.
- `at` (`[x, y]`) — absolute placement in feet; the ROOT mass only. Use `on` for the rest.
- `on` (`{ anchor, side, align, gap }`) — relative placement against a neighbour. `anchor` (a mass id) and `side` (`N` | `S` | `E` | `W`) are required; `align` is `start` | `center` | `end` (also accepts `N`/`S`/`E`/`W`); `gap` is the spacing in feet. Reads as "mass B sits `side` of `anchor`".
- `form` — `'rect'` (default) | `'round'` (reserved for a future increment).
- `facade` (`{ material, rhythm, glass, frame }`, required) — the exterior skin. `material` is `glass` | `brick` | `concrete`; `rhythm` is `curtain` | `punched` | `banded` | `pier` | `grid`; `glass` is the glass tint hex (or the brick BODY colour when `material=brick`); `frame` is the mullion / structure hex.
- `roof` — `'flat'` or a pitched form name (`mission` / `modern-shed` / `manor` / `bungalow` / `farmhouse` / `colonial`).
- `interior` (`{ kernel }`) — the interior kernel; `{ kernel: 'open' }` is a walkable hollow shell. Default `'open'`.

## Concourses

A concourse fuses two masses into ONE walkable building. Each derives a corridor in the gap between the two masses' facing walls and punches a doorway in both — so the masses stop being separate volumes and become a connected building.

- `from` / `to` (mass ids, required) — the two masses to join. They must be placed apart on one axis so they FACE each other; a concourse between non-facing masses throws at mint.
- `width` (number) — hall width in feet (default 10).

## Placement, theme, entrance

- `entrance` — the mass whose interior the spawn point and reachability check start from (default the first mass).
- `seed` (integer) — determinism seed (default 1). Same recipe + seed re-renders byte-identically.
- `theme` (string) — a suggested-defaults theme id (default `'earth-temperate'`); every facade / roof is overridable per mass regardless.

## Worked example

A two-tower campus: a glass-curtain root tower, a brick-punched wing sitting to its east, joined by a hall so they become one walkable building. Pass `kind: 'edifice'` with this recipe as `spec`:

```
{
  masses: [
    { id: 'tower', footprint: { w: 60, d: 60 }, floors: 8, at: [0, 0],
      facade: { material: 'glass', rhythm: 'curtain', glass: '#8fb7c9', frame: '#33414a' },
      roof: 'flat', interior: { kernel: 'open' } },
    { id: 'wing', footprint: { w: 90, d: 45 }, floors: 3,
      on: { anchor: 'tower', side: 'E', align: 'center', gap: 24 },
      facade: { material: 'brick', rhythm: 'punched', glass: '#9a5a44', frame: '#2e2019' },
      roof: 'modern-shed', interior: { kernel: 'open' } }
  ],
  concourses: [
    { from: 'tower', to: 'wing', width: 12 }
  ],
  entrance: 'tower',
  theme: 'earth-temperate',
  seed: 1
}
```

Returns `{ ok, ref, worldUrl, sceneUrl, url, stats, advisory, note? }` — `stats` reports `{ masses, concourses, maxFloors, footprintFt }`, `advisory` is the per-check livability/reachability readout, and `note` (present only when there are defects) restates them and confirms the building was minted anyway. Nothing here refuses a building: the checks are surfaced, never gated.
