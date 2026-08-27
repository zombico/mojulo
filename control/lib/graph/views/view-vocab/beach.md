---
{
  "id": "beach",
  "name": "Beach",
  "family": "science",
  "entry": "create_view",
  "summary": "Mint an interactive ANIMATED SHORELINE — the sea rolling in and lapping onto a sloped sand beach, rendered in the traversable three.js World.",
  "when": "Reach for this on framing like 'water rippling to the shore / waves lapping a beach / an animated shoreline / a calm sea rolling onto sand / a coastline with surf'."
}
---

Mint an interactive ANIMATED SHORELINE — the sea rolling in and lapping onto a sloped sand beach, rendered in the traversable three.js World. The sibling of the `ocean` view: it rides the SAME surface channel (a grid mesh deformed every frame by a GERSTNER 'waveform sequence' — a superposition of moving wave trains, height Σ A·sin θ with the Gerstner horizontal pull that sharpens crests), but every wave train travels ONSHORE (toward +y) and the surface carries a `shore` descriptor so the swell SHOALS: as the bed rises to the waterline the wave height and slope taper to nothing (so the sea flattens into the sand instead of clipping through it), the shallows lighten to turquoise, and a foam SWASH line laps up the sand and retreats — the "rippling to the shore" beat. Accurate physics kept: deep-water dispersion ω = √(g·k), so longer waves travel faster. A static sand WEDGE (submerged toe → still waterline → dry dune) is Lambert-lit by a low sun, wet strand near the water reading darker than the dry berm. Three sea states: 'calm' (long, low, slow swell — the default 'slowly rippling' read), 'swell' (medium rollers), 'surf' (bigger, steeper waves that clearly build and break); an `amplitude` knob scales the whole sea. Served as a live, traversable three.js World at `/api/sketches/<ref>/world` (drag to ORBIT, scroll to zoom). You pass a tiny recipe (a sea state); the substrate stores ONLY the recipe (`manifest.kind === 'beach-view'`, no geometry) and regenerates the wave spectrum + sand wedge on render. ORBIT-ONLY object study: no CSS-3D `/scene` form; open the worldUrl. Reach for this on framing like 'water rippling to the shore / waves lapping a beach / an animated shoreline / a calm sea rolling onto sand / a coastline with surf'.

## Parameters

Pass these in `create_view`'s `params` object. `title`, `viewBox`, `scene`, `ref`, `folder_ref` are top-level `create_view` params and may be omitted from `params`.

- `title` (string) — Title for the resulting sketch artifact.
- `scenario` (string) — Sea state (default 'calm'): 'calm' (long slow swell — gentle lapping), 'swell' (medium rollers), 'surf' (bigger, steeper breaking waves).
- `amplitude` (number) — Wave-height multiplier (default 1; e.g. 0.5 calmer, 2 rougher).
- `scale` (number) — Overall size multiplier (default 1).
- `viewBox` (object) — Optional render size { width, height } (default 1120×780).
- `scene` (object) — Optional scene options, e.g. { bg: "#bfe0ee" } for the background (sky) colour.
- `ref` (string) — optional stable sketch ref.
- `folder_ref` (string) — optional sketch folder to file under.
