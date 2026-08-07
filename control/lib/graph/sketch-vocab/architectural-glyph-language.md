---
{ "id": "architectural-glyph-language", "name": "recipe.kind = \"architecturalGlyphLanguage\"", "summary": "architecture and urban structure grammar — retrieve concepts, compose parts, mix rectilinear and radial wrap-net towers, then vary parameters instead of copying spike sheets", "when": "architecture, city, skyline, skyscraper, urban street, facade, radial tower, cylindrical tower, balcony, roof, pagoda, torii, public realm, road, bus stop, shopfront, gas station, cell tower, power tower, construction site, harbor, stadium, refinery, farm, field, court, pool, podium, or other built-structure prompts that should use reusable structural glyphs with variation", "tier": "recipe", "marks": [], "phase": "p1" }
---

`recipe.kind = "architecturalGlyphLanguage"` is authoring shorthand for built
environment scenes. Use it when the prompt asks for buildings, infrastructure,
public realm objects, roads, civic spaces, farms, stadiums, shipyards,
refineries, construction sites, storefronts, balconies, roofs, or architectural
doodads.

For cityscapes and skylines, the model may mix building massing concepts before
emitting details:

- `building.facade-wrap-tower` - angular/rectilinear tower using
  `facade-wrap-net.js`; address space is `face + bay + floor`.
- `building.radial-wrap-tower` - cylindrical/radial tower using
  `radial-wrap-net.js`; address space is `theta segment + floor`.

Use both in the same mandala when the prompt calls for a varied downtown,
skyscraper cluster, heroic tower district, or angular-plus-round skyline. The
mandala planner allocates these as `buildingMass` and `radialBuildingMass`
surfaces, not as loose facade doodads.

## Retrieval contract

Read `polygonizer/architecture-glyph-registry.js` as the concept source. Use
`polygonizer/architecture-mandala-planner.js` as the zero-vector allocation
step when multiple structures must share a scene. The generated facade-glyph SVG
sheets are examples, not presets. Do not copy a sheet verbatim unless the user
explicitly asks for that exact test artifact.

Each concept has:

```
{
  id,
  family,
  aliases,
  parts,
  placement,
  variationAxes,
  renderHints,
  composeWith,
  exampleRefs
}
```

## Authoring rule

Pick concepts by intent, then instantiate their parts with varied parameters.
The shape should be structurally deterministic but not visually identical:

1. Select 2-8 compatible concept ids from the registry.
2. Solve placement/contracts first: building face, sidewalk edge, lot pad,
   building mass, radial building mass, field perimeter, dock edge, utility
   easement, plaza center, roof top.
3. Expand named parts: posts, beams, roof caps, facade cells, rails, signs,
   cabinets, tanks, paths, field marks, deck tiers.
4. Sample variation axes: count, density, style, height, rail policy, roof
   curve, signal orientation, pipe density, tower levels, text labels.
5. Emit ordinary polygonizer marks with `data-role`-style part names where
   possible so the object remains inspectable.

## Mandala allocation rule

Before visible marks, allocate concepts onto support surfaces:

```
architectureMandalaPlan = {
  surfaces: [
    { id, kind, contract, rect, maxCoverage }
  ],
  allocations: [
    { conceptId, surfaceId, surfaceKind, slot, area, parts, parameters }
  ],
  diagnostics: {
    unplacedCount,
    collisionCount,
    underfilledSurfaces,
    overBudgetSurfaces,
    readable
  }
}
```

Use the plan to answer: does each object have support, does it fit, did it
consume real facade/sidewalk/lot/field budget, and is the scene filled enough to
read. Balconies reserve facade cells; bus stops consume sidewalk length; gas
stations consume lot pads; stadium walls consume venue perimeter; rectilinear
skyscrapers reserve `buildingMass` and carry a `facadeWrap` plan; cylindrical
skyscrapers reserve `radialBuildingMass` and carry a `radialWrap` plan; utility
towers reserve footing/easement area.

## Composition examples

Urban block:

```
concepts = [
  "urban.sidewalk-road",
  "facade.storefront-podium",
  "urban.traffic-signals",
  "urban.bus-stop-shelter",
  "urban.hydrant-utility"
]
```

Mixed skyline:

```
concepts = [
  "urban.sidewalk-road",
  "building.facade-wrap-tower",
  "building.radial-wrap-tower",
  "facade.storefront-podium",
  "civic.public-realm-kit"
]
```

Rural farm:

```
concepts = [
  "farm.farmyard-core",
  "farm.tracted-field",
  "residential.low-rise-house",
  "path.sined-pasta"
]
```

Industrial waterfront:

```
concepts = [
  "industrial.harbor-shipyard",
  "industrial.pipe-refinery",
  "infrastructure.power-tower"
]
```

Japanese-inspired civic scene:

```
concepts = [
  "roof.curved-asian-tier",
  "roof.top-triangle-repeat",
  "civic.torii-gate",
  "path.sined-pasta",
  "civic.public-realm-kit"
]
```

## Avoid

- Do not treat `exampleRefs` as canonical outputs.
- Do not hand-place many unrelated tiny fragments before solving the support
  surface.
- Do not use one fixed balcony/window/roof rhythm when the prompt leaves room
  for variation.
- Do not make towers as flat silhouettes when the registry specifies four legs,
  rings, bracing, or depth cues.
