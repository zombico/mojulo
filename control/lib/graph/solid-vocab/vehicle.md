---
{
  "id": "vehicle",
  "name": "Vehicle instance (preview)",
  "family": "vehicle",
  "entry": "mint_solid",
  "summary": "Preview a single meta-fabricator VEHICLE family instance — a registered type + optional decoration — on the workbench's measured studio grid, orbitable at /world.",
  "when": "Reach for this on framing like 'preview / show a plane / bus / car', 'try the teal livery on a widebody', 'render a sedan in crimson', 'eyeball a vehicle candidate before committing it to a fleet library'."
}
---

Preview one meta-fabricator VEHICLE family instance on the workbench's measured studio grid — orbitable at `/world`. A family instance is a registered vehicle TYPE plus an optional DECORATION. This is the eyeball-before-you-commit step of populating a fleet library: render a candidate (a tuned preset, a new livery scheme, a car paint/hull) and check the silhouette + decoration read, then commit it to the registry. The substrate stores ONLY the tiny recipe (`manifest.kind === 'vehicle-instance'`) and regenerates the vehicle deterministically on render. To DROP a vehicle into a populated world, use the transportation-hub composer instead.

Families + their presets and decoration vocabularies come from the meta-fabricator:

- **fixed-wing-aircraft** — `type`: `airliner` | `widebody` | `regional` | `bizjet`; decoration `{ scheme }` by livery name (classic / teal / crimson / forest / ember / royal / sky / sand) or index.
- **ground-car** — `type`: `sedan` | `suv` | `taxi` | `opsWagon`; decoration `{ paint: '#hex', hull }` (hull: standard / coupe / chopped / wide / narrow / lowered / lifted).
- **ground-box** — `type`: `cityBus` | `boxTruck` | `streetcar` | `beltLoader` …; baked livery, no scheme (decoration ignored).

## Spec shape

`title`, `ref`, `folder_ref` are top-level mint params; everything else goes in `spec`.

- `type` (string, **required**) — the registered vehicle preset to render (e.g. `airliner`, `widebody`, `regional`, `bizjet`, `sedan`, `suv`, `taxi`, `cityBus`, `boxTruck`, `streetcar`). Unknown types are rejected with the list of families/presets.
- `decoration` (object) — family-appropriate. Aircraft: `{ scheme }` (a livery name or index). Cars: `{ paint: '#hex', hull }`. Box vehicles ignore it (livery baked into the body cards). Omit for the authored default.
- `pose` (object) — optional render pose: `{ scale?, heading? }` (heading in radians). Default centred, scale 1.
- `viewBox` (object) — optional render viewBox `{ width, height }` (default 900×900).

Orbit-only — no preset CSS-3D scene shots. Returns `{ ok, ref, worldUrl, url, stats }`.

## Worked example

```
{
  kind: 'vehicle',
  title: 'teal widebody candidate',
  spec: {
    type: 'widebody',
    decoration: { scheme: 'teal' }
  }
}
```
