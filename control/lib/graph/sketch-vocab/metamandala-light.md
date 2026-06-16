---
{ "id": "metamandala-light", "name": "polygonizer.metamandala.lightSources — deterministic light rays", "summary": "named directional/spot/point light sources that resolve into scene.light.direction and optional debug rays", "when": "deterministic light rays matter — directional sun, spotlight, pinhole/laser beam experiments, soft-window diffusion, rim-light treatment, or any case where the shading direction must come from a declared source", "tier": "render-primitive", "marks": [], "phase": "p1" }
---

Treat light source as a metamandala concern when deterministic rays matter.
One angle around the origin is enough for directional light; `spreadDegrees`
creates a cone.

## Shape

```
polygonizer.metamandala.lightSources = [{
  role,
  kind: "directional"|"spot"|"point",
  origin: [x,y,z?],
  angleDegrees?,
  direction?,
  spreadDegrees?,
  intensity?,
  debug?,
  diffusion?: {
    enabled?,
    beam?: "slice"|"soft-window"|"wide-ambient"|"grazing-rake"
          | { mode:"pinhole"|"stripe"|"cone"|"soft-window", widthPx?, profile?, sampleBudget? },
    rays?, bounces?, falloff?, minPower?, originSpread?,
    effects?: ("tone"|"rim"|"aura")[],
    debug?
  }
}]
```

## What Rendrant does with it

- Resolves the first primary light into `scene.light.direction` before
  shading/highlights.
- Emits debug rays with `metamandalaLightDebug:true` when requested.
- Optionally runs pure-vector diffusion that annotates polygon faces with
  `lightActivation` and emits simple activation effects.

## Pinhole / beam experiments

For deterministic pinhole/beam experiments, set
`scene.ambientLight:{intensity}` and
`diffusion.beam:{mode:"pinhole", widthPx, profile:"laser", sampleBudget:1}`.
Impact brightness is ambient plus accumulated ray energy; fluence scales
with `widthPx` under fixed ray intensity.

## Mandala skin transparency

For objects subject to light rays, distinguish SVG opacity from mandala
skin transparency:

- Use `opacity` for visual representation.
- Use `skinTransparency`/`mandalaSkinTransparency` for ray behavior:
  - `0` blocks/absorbs light rays
  - `1` lets rays pass through unencumbered
  - `-1` reflects rays like a mirror even if the visible shape is opaque
    or highly drawn.

## Gravity / support / sticky boots

Use `polygonizer.metamandala.gravity` when a visible body should land on a
support fact. Declare `gravity.supports[]` as surfaces (prefer
`kind:"fromHitbox"` for math-space support) and `gravity.bodies[]` as
body/support edges. Body `includeRoles` move with the body, but
`shadowRoles` remain receiver-owned surface artifacts.

Use the **sticky boots** metaconcept when a coherent floaty form should
stick to a floor/support without changing its internal construction:
compute one boot-to-support delta, move the included body marks as a group,
and leave shadows/receiver effects/internal proportions alone. Until
`stickyBoots` is first-class, express it with `metamandala.relaxation` or
`gravity` using a synthetic boot/support role.

For post-solve placement, use `polygonizer.metamandala.relaxation.enabled`
with rules that move a target role family onto a resolved `surfaceRole`.
Use `surface.face:"top"` when the support should mean the top plane of a
solid rather than every contact edge in the support volume.

## Note: meru alias

`polygonizer.meru` is accepted as the future-facing name for local
support/light/depth basis; Rendrant normalizes it into
`polygonizer.metamandala` so existing support, light, gravity, and
relaxation machinery still applies.
