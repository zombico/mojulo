---
{ "id": "vehicle-glyph-language", "name": "recipe.kind = \"vehicleGlyphLanguage\"", "summary": "grounded vehicle grammar — allocate road/rail support surfaces first, then mount bus/train/truck payloads on shared chassis primitives", "when": "bus, train, truck, tram, rail car, depot lane, station platform, freight scene, transit scene, or vehicle-focused prompts that need reusable grounding and deterministic support allocation", "tier": "recipe", "marks": [], "phase": "p1" }
---

`recipe.kind = "vehicleGlyphLanguage"` is authoring shorthand for transit and
vehicle scenes where grounding, support budget, and repeated structure matter
more than one-off hand-drawn silhouettes.

## Retrieval contract

Use:

- `polygonizer/vehicle-glyph-registry.js` for concepts and variation axes.
- `polygonizer/vehicle-mandala-planner.js` for road/rail/platform surface
  allocation and diagnostics.
- `polygonizer/vehicle-manji.js` for deterministic grounded primitives
  (wheel stickers, chassis manji, rectangular payload, rail head-car plan,
  bus facade decorators, truck cab/trailer payloads).

## Authoring rule

1. Select 1-6 concept ids from vehicle registry by intent.
2. Allocate each concept into support surfaces (road/rail/platform/yard) before
   visible marks.
3. Instantiate grounded chassis first, then payload body, then facade details.
4. Keep wheel keep-outs and slot allocations respected.
5. Emit normal renderer marks only (`polygon`, `line`, `text`, etc.).

## Mandala allocation rule

The plan shape should remain inspectable:

```
vehicleMandalaPlan = {
  surfaces: [{ id, kind, contract, rect, maxCoverage }],
  allocations: [{ conceptId, surfaceId, slot, area, parameters }],
  diagnostics: { unplacedCount, collisionCount, underfilledSurfaces, readable }
}
```

## Composition examples

Road transit:

```
concepts = [
  "vehicle.bus.side-slab",
  "vehicle.chassis.grounded-manji"
]
```

Rail transit:

```
concepts = [
  "vehicle.rectangular-wheeled.payload",
  "vehicle.chassis.grounded-manji"
]
```

Mixed depot:

```
concepts = [
  "vehicle.bus.side-slab",
  "vehicle.rectangular-wheeled.payload",
  "vehicle.chassis.grounded-manji"
]
```

Freight lane:

```
concepts = [
  "vehicle.truck.long-haul",
  "vehicle.rectangular-wheeled.payload"
]
```

## Avoid

- Do not skip support allocation and directly draw many floating vehicles.
- Do not switch grounding grammar between bus and train variants.
- Do not place facade decorators into wheel keep-out ranges.
- Do not render truck prompts as bus slabs; preserve the cab/trailer split and
  coupling gap.
