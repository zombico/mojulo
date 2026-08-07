---
{ "id": "wisp-field", "name": "wispField — will-o-wisp / ghost light", "summary": "one drifting aura body plus a small mote cloud", "when": "will-o-wisp, ghost-light, fairy lantern, spirit orb — anywhere a soft aura should drift with a sparse particle halo", "tier": "render-primitive", "marks": ["wispField"], "phase": "p1" }
---

`wispField` is a composite convenience over `fluidField` + `sparkField`. It
lowers into an aura fluidField body plus sparkField motes, preserving
`wispFieldRole`/`wispComponent` metadata. Not a renderer primitive of its
own — but compose it as one when the prompt calls for a single drifting
spirit/light orb.

## Shape

```
wispField{
  role,
  color?, glow?, seed?,
  basis?: { origin:[x,y,z], flow?[x,y,z], cross?, lift?,
            screenOrigin?, unitScale?, depthScale? },
  body?: { count?, scale?, opacity?, radius?, turns?, tailLength?, strokeWidth?, softMass? },
  motes?: { count?, length?, scale?, opacity?, spreadDegrees?, glyphId? },
  drift?: { flow? }
}
```

## When to reach for it

- A single ghost-light / will-o-wisp / fairy lantern that drifts and trails
  a few sparks.
- Quiet magic emanations from a held object.

For broad smoke/aura clouds, use `fluidField` directly; for dense bursts,
use `sparkField`. `wispField` is the composite shorthand.
