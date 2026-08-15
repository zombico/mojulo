---
{
  "id": "carved-solid",
  "name": "Carved solid",
  "family": "object",
  "entry": "mint_solid",
  "summary": "Mint a carved, metalified 3D solid from any vector outline or text — a chrome/gold wordmark, an extruded logo, a beveled icon; material + inner glow + outer fx layers.",
  "when": "Reach for this on '3D metal logo / extruded chrome text / carved wordmark / beveled badge / metalify this shape'."
}
---

Mint a CARVED, METALIFIED 3D solid from any vector outline — a chrome/gold wordmark, an extruded logo, a beveled icon. The outline is EXTRUDED with a rounded bevel and shaded as smooth metal (vexar diffuse + a specular highlight); holes (letter counters, ring centres) carve through the form. Two shape sources feed the one primitive: an SVG path `d` string (any vector shape — logos, icons, symbols) or a text string carved from a font (any UTF-8 the font covers, optionally a `.ttf` you name). The substrate stores ONLY the recipe (`manifest.kind === 'carved-solid'`, no geometry) and re-renders it deterministically: a still SVG at `/api/sketches/<ref>/svg`, plus — when an effect animates — a looping GIF baked into the sketch's outcome folder. A bad path, a missing font, or a bad effect fails at mint, not at view time.

The look composes FOUR independent layers — name them and they stack: the MATERIAL (surface finish), the INNER glow (luminosity on the form), the outer FX (effects outside the silhouette), and the CAMERA. Reach for this on framing like '3D metal logo / extruded chrome text / carved wordmark / beveled badge / metalify this shape'.

## Spec shape

`title`, `ref`, and `folder_ref` are top-level mint params; everything below is the recipe.

```
{
  shape:      { path } | { text, font? },   // required — the vector outline
  style?:     { depth?, bevel?, bevelSteps?, weight?, blocky?, slant?, tracking?, curveSteps? },
  material?:  '<preset>' | '#rrggbb' | { preset?, base?, ambient?, diffuse?, specular?, shininess?, emissive?, cel?, opacity? },
  metal?:     '<preset>' | '#rrggbb',       // legacy alias for material
  inner?:     'glow' | 'glow:<preset>' | { effect:'glow', preset?, ... },
  fx?:        '<effect>' | { effect, preset?, pathing?, ... } | [ ... ],
  camera?:    { yaw?, fov? },
  background?: true | false,
  animate?:   false | { frames?, fps? }
}
```

## Shape (required)

The vector outline. One of two forms:

- `shape.path` — an SVG path `d` string (M L H V C S Q T Z; arcs approximated). Any vector shape: logos, icons, symbols.
- `shape.text` — a string to carve from a font (any UTF-8 the font covers).
- `shape.font` — optional `.ttf` path for text (defaults to a system bold face).

## Style

All optional geometry knobs:

- `depth` (number) — extrusion depth.
- `bevel` (number) + `bevelSteps` (integer) — the rounded edge and its subdivision.
- `weight` (number) — bolder/thinner outline.
- `blocky` (number) — grid-snap to N → chunky, low-res reading.
- `slant` (number) — italic slant.
- `tracking` (number) — text spacing.
- `curveSteps` (integer) — curve flattening resolution.

## Material

A shading MODEL, not just a tint — metal is one family among many. Pass a preset name, a `#rrggbb` (a satin finish in that color), or an object `{ preset?, base?, ambient?, diffuse?, specular?, shininess?, emissive?, cel?, opacity? }` to fine-tune.

- Metallic presets: `gold` / `steel` / `chrome` / `bronze` / `silver` / `copper` / `gunmetal`.
- Matte / non-metal: `matte` / `plaster` / `stone` / `wood` / `rubber` / `plastic` / `satin`.
- Stylized: `glass` (translucent) / `neon` (self-lit glow) / `cel` (banded toon).
- `metal` is a legacy alias for `material` (a metallic preset or `#rrggbb`).

## Inner

Luminosity ON the form — a SEPARATE layer from material. `'glow'` | `'glow:<preset>'` | `{ effect:'glow', preset?, color?, emission?, rim?, bloom?, pulse? }`. Glow presets: `soft` / `neon` / `ember` / `rim` / `pulse`.

## Fx

Outer effect(s) routed along the contour, OUTSIDE the silhouette — a string, an object `{ effect, preset?, pathing?, ...overrides }`, or an ARRAY of these that stack. Effects and their presets:

- `overgrow` — vine / moss / ivy.
- `electric` — crackle / arc / storm / filament / snake / prowl / surge.
- `ice` — encase / shards / rime.
- `flame` — engulf / lick / blaze.

## Camera & frame

- `camera` — `{ yaw (deg, 3/4 view), fov (deg) }`.
- `background` (boolean) — dark grade behind the solid (default true; false → transparent).
- `animate` — motion GIF control. Omit → auto (a GIF when the effect animates: electric / flame / ice shimmer / pulse glow); `false` → still only; `{ frames, fps }` → tune it.

## Worked example

An extruded chrome wordmark with an ember inner glow and a licking-flame outer effect, rendered from a 3/4 camera:

```
{
  title: 'FORGE',
  shape:    { text: 'FORGE' },
  style:    { depth: 22, bevel: 3, weight: 1.1, tracking: 2 },
  material: 'chrome',
  inner:    'glow:ember',
  fx:       { effect: 'flame', preset: 'lick' },
  camera:   { yaw: 24, fov: 32 }
}
```

Returns `{ ok, ref, url, svgUrl, gifUrl? }` — `gifUrl` is present when an animated effect baked a looping GIF into the outcome folder.
