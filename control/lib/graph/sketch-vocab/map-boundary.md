---
{ "id": "map-boundary", "name": "Map boundary", "summary": "draw a map of a named place by fetching its boundary from an external gazetteer and projecting it to polygon marks; dark-theme by default to match the slate-900 app bg, with a light theme available for print-style output", "when": "user asks to see, draw, illustrate, or outline a country, state, region, city, or neighborhood — any time the answer is a map of a real-world place", "marks": ["polygon"], "phase": "p1" }
---

A map sketch is rendered polygon marks derived from a queried gazetteer.
Mojulo does NOT own boundaries — it fetches them from an external source,
projects them into the sketch's viewBox, and persists the polygons as a
normal `marks[]` manifest. The manifest carries a `geo` block recording
exactly which source, query, projection, and fetch time produced the polygons,
so a replay is auditable.

See `lite-template/integration/app-system/0530/MAP_ILLUSTRATOR_PRINCIPLES.md`
for the contract. The helper that does the work is
`control/lib/graph/geo/index.js → buildMapMarks`.

## When to use this card

- "Draw me a map of Sweden" → call `buildMapMarks({ source: 'natural-earth', query: 'Sweden', viewBox })`.
- "Outline the US states" → `level: 'admin-1'` against natural-earth.
- "Show me Söder, Stockholm" → `source: 'osm-nominatim'` (Natural Earth doesn't carry neighborhoods).
- Comparing two countries side-by-side → use `grid-layout` to lay out two panels, then call `buildMapMarks` per panel with its own viewBox-equivalent and merge the marks (offset the second panel's polygon points into the second cell).
- The user asks for roads, terrain, raster basemap → push back. This card draws boundary outlines only.

## When NOT to use this card

- The user wants an interactive map (clickable regions, hover labels, zoom). Push back — the sketch renderer is static SVG. The polygons carry stable `id`s so a future interactive renderer can light up, but that's not this surface.
- The user wants a choropleth (regions colored by data). Possible in a follow-up by post-processing the marks; not in v1.
- The user wants a sequence of maps (animation, timeline). Static.
- The answer is a paragraph ("Sweden borders Norway, Finland, and the Baltic Sea") — write the paragraph.

## Theme

The sketches page renders directly on the slate-900 app bg (`#111827`). Pick a theme that reads against THAT bg, not against white. The choice lives in `geo.theme` on the persisted manifest.

- `dark` (DEFAULT) — slate-800 land (`#1f2937`) on slate-600 strokes, slate-200 labels. Matches the rest of the sketch_vocab palette family (stacked-bar, donut-ring, stat-tile) so a map composes cleanly next to a chart.
- `light` — warm cream land (`#f3efe6`) on charcoal stroke, dark labels. Use for a print-style cartographic look (export-to-PDF, light-mode embed). Still legible on the dark page.

If the operator's intent is unclear, default to `dark`. Re-mint with `theme: 'light'` only when they explicitly ask for a cream/print look.

## Readability (key rules)

The full set lives in `MAP_ILLUSTRATOR_PRINCIPLES.md → Readability`. The high-leverage rules for composing a map:

- **Holes paint the sea, not white.** `palette.holeFill` matches the bg-adjacent tone so cutouts read as cutouts.
- **Stroke widths track viewBox scale.** Single-country sketch: 0.7–1 px. Multi-region board: 0.5–0.7 px. > 1.5 px reads "illustrated" not "cartographic."
- **Choropleth fills (data channel) need saturated mid-tones.** Pastel + small country = invisible against the dark bg. Anchor categorical palette: red `#dc2626`, blue `#0ea5e9`, yellow `#fcd34d`, purple `#a855f7`, orange `#fb923c`, teal `#0d9488`, lime `#a3e635`. Keep categorical sequences ≤ 7.
- **Text labels: 9–11 px minimum, color set per-region.** A 10 px label on `#dc2626` red needs `#fff`; the same label on slate-800 land takes `#e2e8f0`. Pick label color per choropleth fill.
- **Centroid-of-largest-ring is the default label anchor.** For C-shaped, archipelago, or coastal countries (Norway, Greece) the geometric centroid lands offshore. Override or suppress — never let a label render outside its polygon.
- **Legend cards carry their own bg.** Wrap legend swatches in a `rect` filled with `legendBg` (`#1e293b` for dark, `#f8fafc` for light) + a thin `legendStroke`. Without the carrier the labels disappear.

## Sources

Two sources ship in v1. Pick consciously — they encode different editorial choices about contested boundaries, and the manifest records which one was used.

- `natural-earth` (DEFAULT) — public-domain country (`admin-0`) and state/province (`admin-1`) boundaries at 1:50m resolution. Offline-friendly: first fetch caches the bulk file, all subsequent queries are network-free. Coarse: country outlines, not coastlines at municipality detail. Best for "draw me a country / a state."
- `osm-nominatim` — live OpenStreetMap geocoder. Granular: neighborhoods, parks, individual buildings. Rate-limited (1 req/sec public endpoint, must include a contact in `OSM_NOMINATIM_CONTACT`). Best for "draw me this specific named place that NE doesn't carry."

When unsure which source to pick — or when the query is politically contested (Taiwan, Crimea, Western Sahara, Kashmir) — surface the choice to the operator. Do not silently pick.

## Layout math

The map is the whole canvas. Pick a viewBox that matches the shape of the place:

- Country / state: a square (600 × 600) or near-square is fine — `buildMapMarks` fits the bbox to whichever dimension is the limiting factor and centers the result.
- A region with a strong long axis (Chile, Norway, Florida): match the viewBox aspect — Chile in 600 × 800 looks honest; Chile in 600 × 600 wastes most of the canvas.
- Multi-region board: lay a `grid` and treat each cell as its own mini-viewBox. Compute marks for each cell with a virtual viewBox of `{ width: cellW, height: cellH }`, then offset each polygon's points by `(cellX, cellY)`.

Projection:

- `equirectangular-bbox` (default) — fit the bbox linearly. Honest for one region at modest extent.
- `web-mercator` — preserves shape near the equator at the cost of stretch near the poles. Use for world maps or multi-region comparisons that span big lat ranges.

Simplification:

- `tolerancePx` defaults to 0.5 px. Lower (0.2) gives a more detailed outline but a much larger manifest; higher (1–2) flattens the outline for a sketchier look.
- The simplification budget is converted to source-degree space using the bbox + viewBox, so the same `tolerancePx` produces consistent visual smoothness regardless of how big the region is or how big the viewBox is.

## Example — Sweden via Natural Earth

```js
import { buildMapMarks } from '@/lib/graph/geo';

const result = await buildMapMarks({
  source: 'natural-earth',
  query: 'Sweden',
  viewBox: { width: 600, height: 800 },
  projection: 'equirectangular-bbox',
  tolerancePx: 0.5,
  theme: 'dark', // default; pass 'light' for print-style cream land
});

if (result.kind === 'ambiguous') {
  // Surface result.candidates to the operator and ask them to pick.
  // Re-call buildMapMarks with the disambiguated query.
}
if (result.kind === 'not-found') {
  // The source did not carry this place. Suggest the other source.
}

await createSketch({
  title: 'Sweden',
  manifest: {
    title: 'Sweden',
    viewBox: { width: 600, height: 800 },
    marks: result.marks,
    geo: result.geo,
  },
});
```

The returned `marks` are valid `polygon` marks the renderer already understands. The `geo` block is informational metadata — the validator type-checks it; the renderer ignores it.

## Disambiguation (ambiguous matches)

When `buildMapMarks` returns `kind: 'ambiguous'`, the source matched multiple places. The result carries `candidates: [{ id, label, hint }]` — surface them to the operator verbatim:

> "There are several places matching 'Springfield' — which do you mean?"
> 1. Springfield (Illinois, US)
> 2. Springfield (Missouri, US)
> 3. Springfield (Massachusetts, US)

Then re-call with the operator's pick as the query (e.g. `query: 'Springfield, Illinois'`). The card NEVER picks for the operator on ambiguous matches.

## Marks shape (for reference)

Each polygon mark looks like this — built by `buildMapMarks`, not hand-authored:

```json
{
  "kind": "polygon",
  "id": "SE",
  "role": "outer",
  "points": [[123.45, 678.90], ...],
  "fill": "#f3efe6",
  "stroke": "#2a2a2a",
  "strokeWidth": 1,
  "z": 10
}
```

Holes (a country containing an enclave) come back as separate polygons with `role: 'hole'`, a higher `z` (so they paint over the outer ring), and the hole fill colored the same as the page background — they read as cutouts. Don't try to fix this by hand; the helper handles it.

## Future affordances (not v1)

These are described in `MAP_ILLUSTRATOR_PRINCIPLES.md` and are explicitly out of scope for this card:

- Interactive hover / click / zoom
- Choropleth fills driven by data
- Animated transitions
- Bundled boundary data
- Live re-render when the source updates

The manifest carries enough metadata (region `id`, source, query, projection) that a future renderer can light up without a data migration.
