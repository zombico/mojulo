---
{
  "id": "river",
  "name": "River",
  "family": "science",
  "entry": "create_view",
  "summary": "Mint a winding RIVER that flows one direction through terrain it has carved into a valley — six kinds (creek / river / gorge / canal / lazy / lava), rendered in the traversable three.js World.",
  "when": "Reach for this on framing like 'a winding river / a river flowing through a valley / a mountain creek / a canyon river / a canal / a lazy lowland river / a lava flow / carve a river into terrain'."
}
---

Mint a winding RIVER that flows one direction through terrain it has CARVED into a valley, rendered in the traversable three.js World. The fluid sibling of `ocean` / `beach`: instead of open water it rides the surface channel's `river` mode — the water follows a winding centreline, its level DESCENDING downstream (so it flows downhill), with ripples + foam streaks + drifting leaves all sliding one way, and the water grid culled to the winding ribbon so the mesh IS the river. Underneath, rolling fBm terrain is carved into the river's valley (bed + sloping banks along the same centreline), Lambert-shaded grass / rock / sandy-bank, so the water sits in real topography and fills to the banks. Accurate-in-spirit: the water surface descends downstream, banks always rise above the water (no spill), debris drifts at the current speed.

Six KINDS — one primitive at different points in its parameter space (winding, width, flow speed, carve depth, gradient, palette):
- `creek` — narrow, fast, clear, shallow, tightly winding.
- `river` — the default: a broad blue-green river, moderate flow.
- `gorge` — a deep-carved canyon, dark fast water, steep rock banks.
- `canal` — near-straight, hard-edged, calm.
- `lazy` — wide, slow, glassy, gently meandering lowland water.
- `lava` — a molten flow: a hot SELF-EMISSIVE palette, slow viscous drift, scorched banks, dusk sky.

Same fractal-generation philosophy as the other views: pass a tiny recipe (a kind + seed); the substrate stores ONLY the recipe (`manifest.kind === 'river-view'`, no geometry) and regenerates the whole valley + flow deterministically (seeded phases + hash noise, no dice) on render. Served as a live, traversable three.js World at `/api/sketches/<ref>/world` (drag to ORBIT, scroll to zoom). ORBIT-ONLY object study: no CSS-3D `/scene` form; open the worldUrl. Reach for this on framing like 'a winding river / a canyon river / a mountain creek / a canal / a lazy lowland river / a lava flow'.

## Parameters

Pass these in `create_view`'s `params` object. `title`, `viewBox`, `scene`, `ref`, `folder_ref` are top-level `create_view` params and may be omitted from `params`.

- `title` (string) — Title for the resulting sketch artifact.
- `scenario` (string) — Which kind (default 'river'): 'creek', 'river', 'gorge', 'canal', 'lazy', 'lava'.
- `seed` (integer) — Same (scenario, seed, scale) → byte-identical valley; a new seed shifts the winding + hills coherently (the river kind and its character hold).
- `scale` (number) — Overall size multiplier (default 1; 0.4–3).
- `viewBox` (object) — Optional render size { width, height } (default 1120×780).
- `scene` (object) — Optional scene options, e.g. { bg: "#cfe6f2" } for the sky colour (lava defaults to a dusk sky).
- `ref` (string) — optional stable sketch ref.
- `folder_ref` (string) — optional sketch folder to file under.
