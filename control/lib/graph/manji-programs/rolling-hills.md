---
{
  "id": "rolling-hills",
  "label": "Rolling hills (terrain undulation)",
  "family": "surface-terrain",
  "aliases": ["countryside", "hills", "undulating terrain", "rolling green country", "pastoral landscape", "low hills"],
  "intents": ["surface", "terrain", "atmospheric-context", "depth-staging"],
  "topology": {
    "primitive": "wave-field",
    "shape": "horizontal-quad",
    "energy": "medium",
    "frequency": "low"
  },
  "reasoningUse": [
    "low-frequency large-amplitude terrain for pastoral landscape scenes",
    "the eye reads gentle hills receding into the distance, not a flat plane",
    "use beneath wide-shot landscapes, countryside compositions, or farm scenes"
  ],
  "boundaryContract": {
    "corners": ["NW", "NE", "SE", "SW"],
    "displacement": "gravity-perpendicular"
  },
  "manjiProgram": {
    "children": [
      {
        "kind": "wave-field",
        "corners": [
          "self/slot/NW",
          "self/slot/NE",
          "self/slot/SE",
          "self/slot/SW"
        ],
        "waves": [
          { "amplitude": 0.85, "cycles": { "u": 0.7, "v": 0.5 }, "phase": 0 },
          { "amplitude": 0.35, "cycles": { "u": 1.8, "v": 1.3 }, "phase": 0.9 }
        ],
        "samples": { "u": 20, "v": 14 },
        "style": { "stroke": "#4a7a4a", "width": 0.7 }
      }
    ]
  }
}
---

# Rolling hills (terrain undulation)

A medium-energy terrain surface with low-frequency large-amplitude
undulation. The eye reads gently rolling hills receding into the
camera — a pastoral countryside read. Mossy-green stroke (`#4a7a4a`)
signals grass / vegetation across discovery and render.

## Use when

Reach for rolling-hills when the scene needs natural ground that's
clearly NOT flat. Specific intents:

- **Wide pastoral landscapes** — farm country, English countryside,
  Tuscan hills. The undulation lets distant towns or buildings sit on
  the crest of a hill rather than on a flat plain.
- **Approaches to architecture** — a road winding through hills toward
  a cathedral, a castle on a rise, an abbey in a valley. The terrain
  shape stages the eye's path to the architectural focus.
- **Foreground / midground / background depth** — when
  `wide-shot-landscape` doesn't have enough environmental presence,
  rolling-hills underneath gives the landscape body.
- **Grouping figures across topography** — figures on different
  hilltops read as distinct social/spatial units.

When the ground should be flat (interior, plaza), use `flat-floor`. When
the energy should be water rather than land, use `calm-water` or
`choppy-sea`. For specifically grass texture (without hill shape), a
future `grass-plane` card with high-frequency low-amplitude waves would
fit better.

## Composition example

Apply beneath a wide pastoral landscape with a distant chapel:

```json
{
  "tree": {
    "id": "countryside",
    "programRef": "wide-shot-landscape",
    "children": [
      { "slot": "midground", "node": { "id": "chapel", ... } },
      { "slot": "foreground", "node": { "id": "farmhouse", ... } }
    ]
  },
  "waveFields": [
    {
      "corners": [
        "countryside/slot/left-frame",
        "countryside/slot/right-frame",
        "countryside/slot/horizon-anchor",
        "countryside/slot/foreground"
      ],
      "waves": [
        { "amplitude": 0.85, "cycles": { "u": 0.7, "v": 0.5 }, "phase": 0 },
        { "amplitude": 0.35, "cycles": { "u": 1.8, "v": 1.3 }, "phase": 0.9 }
      ],
      "samples": { "u": 20, "v": 14 },
      "style": { "stroke": "#4a7a4a", "width": 0.7 }
    }
  ]
}
```

The 4 corner anchors are pulled from the wide-shot-landscape card's
existing slot vocabulary — left-frame, right-frame, horizon-anchor,
foreground. The two-component wave sum produces a small number of
visible "hills" (large slow component) with finer undulation riding
on top (medium component).

## Provenance and influences

Romantic landscape painting — Constable, Turner's English landscapes,
the Hudson River School. Those traditions render rolling terrain with
explicit chiaroscuro shading on the hill flanks; wave-field gives the
geometry the shading would later be applied to. The mossy-green stroke
matches the standard convention for mid-distance unmowed pasture.

## Stays bespoke when

- **Mountainous terrain** with peaks, ridges, and exposed rock.
  Rolling-hills is gentle; high-amplitude mountains would need either
  much higher wave amplitudes (which break the bilinear quad assumption
  at the corners) or explicit per-peak inline geometry.
- **Specific known landscape** (a recognizable real valley, a specific
  mountain). One-off compositions belong to inline authoring, not
  library presets.
- **Forested terrain** where the trees themselves carry the visual load.
  Wave-field handles the ground; trees would be inline manji-trees or
  a future `forest-stand` card.
- **Water-dominated landscapes** — the rolling-hills card greens the
  surface; for water bodies use `calm-water` / `choppy-sea` instead.
