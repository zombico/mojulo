---
{ "id": "spark-field", "name": "sparkField — rain, sparks, leaves, comic impact, fireworks", "summary": "small repeated falling/emitted particles whose individual glyph is simple", "when": "rain, welder sparks, leaf clusters in trees, comic/action impact streaks, fireworks, bounce/drop showers", "tier": "render-primitive", "marks": ["sparkField", "showerField"], "phase": "p1" }
---

`sparkField` lowers rain, welder sparks, falling leaves, action/comic impact
streaks, fireworks, and bounce/drop showers into ordinary line/polyline/polygon
marks. Like `fluidField`, particles inherit mandala camera perspective sizing.

## Shape

```
sparkField{
  role,
  mode?: "falling"|"from-center"|"surface-collision"|"bounce-then-drop"|"radial-fractal"|"firework-burst",
  medium?: "rain"|"spark"|"leaf"|"comic"|"shower"|"firework",
  basis?: { origin:[x,y,z], flow:[x,y,z], cross:[x,y,z], lift:[x,y,z],
            screenOrigin?, east?, north?, zenith?, unitScale?, depthScale?, width?, height? },
  emitter?: { origin?, from?, to?, width?, height?, spreadDegrees?, gravity? },
  population?: { count?, seed?, length?:[min,max], scale?:[min,max], opacity?:[min,max] },
  fractal?: { generations?, branching?:number|[min,max], lengthFalloff?, opacityFalloff?,
              angleJitter?, splitAt?:[min,max] },
  glyph?: { id?:"rain-streak"|"spark-streak"|"leaf-dash"|"comic-impact"|"ember-dot",
            strokeWidth?, stroke?, fill? },
  stroke?, fill?, z?
}
```

`showerField` is an alias.

## Mode picker

| Want                               | mode                |
| ---------------------------------- | ------------------- |
| Rain / falling leaves              | `"falling"`         |
| Simple radial bursts               | `"from-center"`     |
| Branching fireworks                | `"radial-fractal"` or `"firework-burst"` |
| Sparks leaving an impact edge      | `"surface-collision"` |
| Particles ricochet then fall       | `"bounce-then-drop"` |

Do not hand-author many rain/spark/leaf/firework lines. Declare the emitter,
seed, count, glyph id, basis, and optional fractal rules instead.
