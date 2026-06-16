---
{ "id": "fluid-field", "name": "fluidField — smoke/vapor/aura/dust/liquid/fire/stream/wallpaper", "summary": "seeded 3D motion-glyph population that lowers into ordinary polyline/blob marks", "when": "smoke, vapor, aura, dust, liquid, fire, stream, ribbon, abstract wallpaper swishes — anything where many local motion glyphs should be generated rather than hand-authored", "tier": "render-primitive", "marks": ["fluidField", "swirlField"], "phase": "p1" }
---

`fluidField` lowers a seeded 3D fluid/motion-glyph population into ordinary
polyline/blob marks. The model names the medium, basis, seed, and broad
population/glyph ranges; Rendrant deterministically chooses centers,
handedness, opacity, stroke paths, and optional soft masses. Perspective
sizing is part of the field camera — farther glyph centers shrink and fade
using the same mandala `depthScale` that projects their positions. Set
`perspectiveSizing:false` only for deliberately flat wallpaper graphics.

## Shape

```
fluidField{
  role,
  medium?: "smoke"|"vapor"|"wallpaper-swirl"|"ribbon"|"aura"|"liquid"|"stream"|"fire",
  basis?: { origin:[x,y,z], flow:[x,y,z], lift:[x,y,z], cross:[x,y,z],
            screenOrigin?, east?, north?, zenith?, unitScale?, depthScale?,
            length?, spread?, liftAmount?, perspectiveSizing? },
  population?: { count?, seed?, scale?:[min,max], opacity?:[min,max],
                 handedness?:"alternate-biased"|"random"|"clockwise"|"counterclockwise" },
  flameSources?: [{ role?, origin:[x,y,z], radius?, radiusMode?:"seeded-opposed"|"random",
                    radiusJitter?, coverageScale?, lickCount?:number|[min,max],
                    spread?, alongJitter?, liftJitter? }],
  glyph?: { id?: "hook-cloud-swirl"|"free-space-swish"|"current-carrier"|"bulb-seaweed-flame",
            turns?:[min,max], radius?:[min,max], height?:[min,max], tailLength?:[min,max],
            curveAmount?:[min,max], swirlAmount?, swirlTurns?, sourceCoverageScale?,
            outline?, points?, strokeWidth?, wobble?, softMass?, coreFill?,
            gradientFill?:{enabled?, kind?:"radial"|"linear", stops?:[{offset,color,opacity}], independentLighting?},
            coreFillGradient?:{enabled?, kind?, stops?},
            volumetricFill?:{enabled?, opacity?, fill?, leftFill?, rightFill?, blur?},
            edgeSkin?:{enabled?, outline?, stroke?, strokeWidth?, insideStroke?, insideStrokeWidth?, insideBlur?, valueBudget?} },
  lowering?: { softMass?:"blob"|false, coreFill?, outline? },
  effects?: { pastamaker?: [...] },
  stroke?, fill?, z?
}
```

`swirlField` is the smoke-flavored compatibility form of `fluidField`; use
`fluidField` for new broad free-space swirls.

## Fire (with named sources)

Use `medium:"fire"` with `glyph.id:"bulb-seaweed-flame"`. Declare natural
`flameSources` first (wick, match head, torch head, burning log knot, ember
crack); give each source `radius` to scope licks across the full lit source
point; each source deterministically spawns `lickCount` translucent licks
with hard-lit outside edge, fuzzy inside heat edge, optional gradient fill
independent from the lighting field, and optional volumetric side fills. If
no `flameSources` are supplied, the old `population` field still seeds
licks directly. Use `lickCount:2` with `radiusMode:"seeded-opposed"` when a
single combustion point should emit two licks from different parts of its
source radius; `sourceCoverageScale` or `flameSources[].coverageScale` keeps
the bulb wide enough to cover the lit point while preserving aspect ratio.
In source-owned edge-skin mode prefer `outline:false` so the flame is
carried by gradients, light edges, and translucent volume.

## Pastamaker garnish

`effects.pastamaker` runs deterministic dies along each generated glyph
path/head/base/envelope:

- `noisySpaghetti` — braided rivers, streams, clustered wires, hairlike
  current, shared fluid dynamics; `field.kind:"alongFluidGlyph"` with
  `density`/`length`/`alignment` controls. Add `field.avoid` circles/rects
  with `padding`/`falloff`/`strength` so strands route around rocks, posts,
  islands, holes, or silhouettes.
- `stringSpawn` — pasta-die-like aperture emitting path strings with
  attached glyphs. Pair `field.kind:"alongPath"` with
  `die.glyph.id:"bead"|"leaf"|"spark"|"dash"|"thorn"` for bead garlands,
  vines with leaves, wires with sparks, thorn trails, or symbolic strings
  without hand-placing every glyph. Add `die.cohere.enabled:true` when
  fibers should vote a coherent skin/clothing polygon into existence; use
  `cohere.envelope:"stripHull"` for drapery/sleeves/belts, `"alphaHull"`
  for organic canopy/fur/vine masses, `"convexHull"` for the safest broad
  skin. For natural cloth, add `die.cohere.fabric.enabled:true` with
  `mode:"drape"`, `stiffness`, optional `pleats.count/amplitude`, and
  optional `avoid` obstacles. For patterned cloth, add
  `die.cohere.fabric.pattern.enabled:true` with `kind:"stripe"|"dot"|"tartan-lite"`.
  For armor, add `die.cohere.fabric.armor.enabled:true`;
  `fit:"volumizer-cast"` for fitted plates, `fit:"blobpla"` for chunky
  shoulder pads and seated pads.
- `bubbling` — recursive midpoint bubble fills with `sizingScaleRamp` and
  `consistencySize` controls. Use `field.kind:"outwardFill"` when two seed
  bubbles should recursively fill a bounded space without a line; use
  `fillBox` only when row/lane structure is intended.
- `kingKrispies` — anchor-shaped noisy circle constellations for
  Kirby-krackle energy/noise; `anchorCount`/`anchorScale`/`anchorSeparation`
  drive the few large circles, smaller bubbles orbit them. White fill on
  black panel/background is the alt classic read.
- `iguana` — close-packed continuous circle field from a three-circle
  tangent growth rule. Use `field.kind:"fillBox"`, `corner`, `spacing`,
  dark background, tunable `r`/`rNoise`. Omit `count` for full fill;
  supply `count` only for intentional partial fills.
- `fuzzyPeach` / `spikeBanana` / `arcPatch` — fuzz/heat/highlight garnish
  around glyph head/base/envelope.
- `preset:"fernCurl"` — natural alternating leaf/tendril curls.

## When to reach for it

- iPhone/Android-style abstract background swishes: `medium:"wallpaper-swirl"`
  with `glyph.softMass:false` so the field lowers to pure fluid ribbons.
- Rivers/streams/clustered wires/hairlike current: `medium:"stream"`,
  `glyph.softMass:false`, a long `tailLength`, and a noisySpaghetti effect
  instead of hand-authoring many strands.

Do not hand-author dozens of wisps, swishes, flame licks, bubbles, or strands
when a seeded `fluidField` can carry the motion.
