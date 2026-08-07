---
{
  "id": "design-vehicle-family",
  "name": "Populate a vehicle fleet library",
  "summary": "Add a new ENTRY to the procedural vehicle libraries the world-populators sample — a new aircraft livery scheme, a car paint, or a tuned frame preset within an existing family (fixed-wing-aircraft / ground-car / ground-box). Introspect the family via the meta-fabricator, author the candidate params, eyeball it with preview_vehicle_instance, then commit it to the registry so it flows into create_transportation_hub automatically. The THIRD sensibility above the workbench: author a FAMILY entry (a generator input), not a single artifact.",
  "valueHook": "Design a new airline livery or a regional-jet preset once and the airport starts spawning it — the fleet derives from the registry, so a new entry needs no populator edit.",
  "version": 1,
  "category": "world-building",
  "requires": { "protocols": [] },
  "parameters": [
    { "name": "intent", "prompt": "What are you adding to the fleet libraries? (e.g. 'a teal-and-gold widebody livery', 'a forest-green taxi paint', 'a stubby regional-jet preset')" },
    { "name": "family", "prompt": "Which family? fixed-wing-aircraft | ground-car | ground-box (or 'auto' to infer from the intent)", "default": "auto" }
  ],
  "mcpTools": { "mojulo": ["preview_vehicle_instance", "create_transportation_hub", "semantic_search"] },
  "outputContract": { "summary": "A new registry entry (livery scheme / paint / frame preset) committed to the vehicle source, previewed in /world, and confirmed in a populated hub.", "fields": ["family", "entry", "previewRef"] }
}
---

# Populate a vehicle fleet library

The workbench authors ONE artifact (an object, a world asset). This authors a **family entry** — an
input to a *generator*. The fixed-wing-aircraft, ground-car, and ground-box families are procedural:
the airport (`create_transportation_hub`) samples them to spawn its fleet. Growing the fleet means
**adding a registry row**, not modelling a vehicle. The meta-fabricator
(`control/lib/graph/meta-fabricator.js`) is the family layer you read and the registry is the single
source of truth — add an entry and the populators pick it up.

## 1. Introspect the family (what already exists)

Read `meta-fabricator.js` for the family you're targeting. Each family binds four facets:
**frame schema** (the net builder + its tunable params), **presets** (the named types), **decoration**
(livery / paint+hull / baked), and **spawn policy** (per-type weight + contexts). The introspection
API: `describeFamily(id)` → `{ types, decoration, tunables }`, `listDecorations(id)`,
`typesInFamily(id)`. Know what's there before you add to it.

| family | frame net | presets | decoration | lives in |
|---|---|---|---|---|
| fixed-wing-aircraft | `vehicle-fuselage-net.js` (tapered body of revolution + flat appendage cards) | airliner / widebody / regional / bizjet | livery scheme `{skin,belly,cheat,tail,wing,fin}` | `AIRCRAFT_FUSELAGE_NETS`, `AIRCRAFT_LIVERY_SCHEMES` |
| ground-car | `vehicle-swept-net.js` (superellipse sweep, independent sill/roof) | sedan / suv / taxi / opsWagon / limo / wagon | paint hex + hull name | `CAR_NETS`, `CAR_PAINT_SCHEMES`, `CAR_HULL_VARIANTS` |
| ground-box | `vehicle-swept-net.js` (box superellipse + loft profile) | cityBus / boxTruck / van / streetcar / GSE | baked into body/front/rear cards (no palette yet) | `SMOOTH_BOX_NETS` + the `*_BODY/_FRONT/_REAR` cards |

## 2. Pick the entry KIND (cheapest that satisfies the intent)

1. **New decoration (easiest — pure data).** A livery scheme (aircraft) or paint (car). No geometry.
   - aircraft → add a `{ name, skin, belly, cheat, tail, wing, fin }` object to `AIRCRAFT_LIVERY_SCHEMES`.
   - car → add a `{ name, body }` object to `CAR_PAINT_SCHEMES`.
2. **New frame preset (tune the existing net).** A new point in the family's parameter space — new
   `proportions` + `profile` + `appendages` (aircraft) or `geo` + `wid`/`zBot`/`zTop` (ground). Add
   the net entry, its cards if needed, AND a `VEHICLES` row in `vehicles-css3d.js`
   (`{ net, family, class, size, weight, contexts }`). The `family` + `contexts` are what wire it in:
   an aircraft row with `contexts:['airfield']` appears in the airport fleet automatically (the hub
   derives `AIRPORT_FLEET` from the family — no hub edit).
3. **New frame SHAPE (out of scope here).** A topology the net can't express — an airfoil wing, a
   propeller nacelle, a delta planform. That needs net/primitive work (the `loft` primitive, Phase 2
   in `meta-fabricator.plan.md`), not a registry entry. Stop and flag it.

## 3. Author + preview (eyeball before you commit)

For a decoration on an EXISTING preset, preview immediately — no source edit needed yet:

```
preview_vehicle_instance({ type: 'widebody', decoration: { scheme: 'teal' } })   // → /world (orbit)
preview_vehicle_instance({ type: 'sedan', decoration: { paint: '#1f4a35', hull: 'lowered' } })
```

Open the `worldUrl`, orbit, and check the silhouette + decoration read on the measured studio grid.
For a new livery/paint, iterate the palette values and re-preview until it reads. (A brand-new preset
isn't previewable by `type` until its `VEHICLES` row exists — add the row, then preview by its type.)

## 4. Commit the entry

Edit the source file from the table in §1 to add the entry. Keep it consistent with the neighbours
(same key shape, a believable `weight`, the right `contexts`). For a new sampled type, the spawn
weight is its relative frequency; `contexts` gates WHERE it spawns (`airfield` for apron aircraft,
`street`/`lot` for cars, etc.).

## 5. Confirm in a populated world

Mint a hub and look: `create_transportation_hub({ mode:'airport', seed: 7, density: 0.9 })`. The new
livery/preset should appear in the apron fleet (re-roll the seed a few times — sampling is weighted).

## Pitfalls
- **Decoration vs structure** — livery schemes recolour branding slots only; windows/glass/trim stay
  constant (they read as structure). Don't fold structural colours into a scheme.
- **Footprint & spacing** — a new aircraft preset's `proportions` drive its gate footprint; an
  oversized one may never fit a stand (the hub's OBB test rejects it). Sanity-check against the
  existing presets' lengths.
- **`size` multiplier** — leave `size:1` unless the net's own proportions aren't already real-world
  (the streetcar bakes its 2.5× length into the net, not `size`).
- **No new families here** — this catalyst adds ENTRIES within the three existing families. A new
  family (watercraft, rail) needs a new net builder + a `VEHICLE_FAMILIES` entry first.
