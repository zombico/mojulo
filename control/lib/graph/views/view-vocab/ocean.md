---
{
  "id": "ocean",
  "name": "Ocean",
  "family": "science",
  "entry": "create_view",
  "summary": "Mint an interactive ANIMATED OCEAN SURFACE — a live sea that heaves and rolls, rendered in the traversable three.js World.",
  "when": "Reach for this on framing like 'animate an ocean / ocean waves / a stormy sea / water surface waves / a rolling swell'.",
  "retired_tool": "create_ocean_view"
}
---

Mint an interactive ANIMATED OCEAN SURFACE — a live sea that heaves and rolls, rendered in the traversable three.js World. The surface is a grid mesh deformed every frame by a GERSTNER 'waveform sequence': a superposition of moving wave trains (height Σ A·sin θ, with the Gerstner horizontal pull that sharpens crests and broadens troughs), lit by a sun so it catches highlights, with foam on the whitecaps and red/gold buoys that ride the swell — tracing the circular orbital motion of the water. Accurate physics: deep-water dispersion ω = √(g·k), so longer waves travel faster. Three sea states: 'swell' (long, low, smooth — a calm ocean), 'chop' (short steep wind waves, foamy), 'storm' (big mixed seas, whitecaps); an `amplitude` knob scales the whole sea. Served as a live, traversable three.js World at `/api/sketches/<ref>/world` (drag to ORBIT, scroll to zoom). You pass a tiny recipe (a sea state); the substrate stores ONLY the recipe (`manifest.kind === 'ocean-view'`, no geometry) and regenerates the wave spectrum on render. ORBIT-ONLY object study: no CSS-3D `/scene` form; open the worldUrl. Reach for this on framing like 'animate an ocean / ocean waves / a stormy sea / water surface waves / a rolling swell'.

## Parameters

Pass these in `create_view`'s `params` object. `title`, `viewBox`, `scene`, `ref`, `folder_ref` are top-level `create_view` params and may be omitted from `params`.

- `title` (string) — Title for the resulting sketch artifact.
- `scenario` (string) — Sea state (default 'swell'): 'swell' (long smooth), 'chop' (short steep wind waves), 'storm' (big whitecaps).
- `amplitude` (number) — Wave-height multiplier (default 1; e.g. 0.5 calmer, 2 rougher).
- `scale` (number) — Overall size multiplier (default 1).
- `viewBox` (object) — Optional render size { width, height } (default 1120×780).
- `scene` (object) — Optional scene options, e.g. { bg: "#0a1a2e" } for the background colour.
- `ref` (string) — optional stable sketch ref.
- `folder_ref` (string) — optional sketch folder to file under.
