---
{
  "id": "painted-landscape",
  "name": "Painted Landscape",
  "family": "world",
  "entry": "compose_world",
  "summary": "Mint a painterly Lambert-shaded landscape by picking one named glyph per family — heartbeat (geometry), splatch (palette), optional structures/scene (scatter), camera, sky — with seeded sampling inside each glyph's declared ranges.",
  "when": "Reach for this when the user wants a landscape that reads as 'painted' — receding hills, dunes, water, terraced fields, a starry night over a meadow — without authoring waveforms or hex stops.",
  "retired_tool": "create_painted_landscape"
}
---

Mint a painterly Lambert-shaded landscape by picking one named glyph per family. The
substrate resolves glyph → recipe, seeded sampling picks concrete wave parameters within the
heartbeat's declared ranges, the splatch's three seed colors derive a balanced 4-stop palette
via luminance-sorted interpolation, and the structure-glyph's seeded layout scatters obelisks
/ boxes that sit on the elevated wave surface. Renders back-to-front, borderless, as
flat-Lambert polygons. Persists with `manifest.kind === 'painted-landscape'`; served as an
SVG by `/api/sketches/<ref>/svg`.

**Closed-vocabulary discipline** — the model never authors raw waves or hex. Every glyph is a
named card; **the catalogues are NOT in this card**: discover glyphs by intent via
`semantic_search({ kinds: ['painted_landscape'] })` (heartbeat / splatch / camera / scene /
sky families), then pass the card's `id` as the named glyph.

## Parameters

Pass these via `compose_world`'s `overrides` (deep-merged over the theme pack). `seed`,
`title`, `ref`, `folder_ref` are top-level `compose_world` params.

- `heartbeat` (string) — named geometry recipe. `[sine-stack]` cards read as periodic
  (terraces, swell, ribbed forms); `[fbm]` cards read as natural (meadows, dunes, glaciers).
  fBm is the default for naturalistic terrain.
- `splatch` (string) — named palette recipe (3 seed colors → 4-stop ramp, luminance-sorted).
  Palette is independent of seed.
- `structures` (string) — optional ARCHITECTURAL scatter glyph (box / obelisk; ruins,
  monuments, villages). Omit for pure terrain; use `scene` for nature fill.
- `scene` (string) — the BIOME FILL + completion unit for NATURE landscapes (cone / canopy /
  boulder / tuft scattered per depth band, with a heartbeat+splatch affinity hint). Reach for
  a scene (not structures) when the landscape should read as forest / meadow / coast / alpine.
- `seed` (string) — same `(heartbeat, splatch, structures, seed)` → byte-identical scene; new
  seed → coherent variation (phases and placements shift; palette and counts hold).
- `light` ({ x, y, z }) — overrides the heartbeat's default light. `z` (elevation) also drives
  the sky's full day → dusk → night arc; NEGATIVE `z` is night (enables stars / moon / aurora).
- `sky` — ON BY DEFAULT (derived zenith→horizon gradient + haze). `false` for flat background;
  a sky-card id string (`'starry-night'`, `'golden-sun'`, `'harvest-moon'`) for a preset; or an
  object with `clouds` (`coverage` / `altitude` / `breaks` / `style` / `volume` / `fade`),
  `sun`, `stars`, `moon` (`phase` / `paraselene` / `blend`), and night phenomena `aurora` /
  `comet` / `meteors` (night-gated on negative `light.z`). Adornments paint BEHIND clouds — a
  sun behind a `breaks` clearing reads as god-rays.
- `camera` (string) — camera-glyph card id locking vanishing points + foreshortening
  (`top-down-survey`, `low-angle-hero`, `wide-cinematic`; default ≈ `medium-survey`).
- `renderStyle` (string) — `painterly` (default; stroke=fill cinematic blocks) /
  `topographic` (dark cell borders; vector-map look) / `wireframe` (no fill; outrun-grid look;
  always sky-less). Orthogonal to heartbeat and splatch.
- `heartbeatOverrides` ({ waves?, samples? }) — per-component `ampScale` / `cuScale` /
  `cvScale` multipliers applied before seeded sampling, and `{ u, v }` cell-density override.
  "This heartbeat but quieter / steeper" without inventing a new heartbeat.
- `paletteOverrides` ({ stops?, positions?, gamma? }) — replace derived stops with explicit
  hex, reposition the 4 stops on the ramp, or reshape the Lambert→ramp brightness curve. The
  three are orthogonal; the splatch stays named and deterministic.

Pairing guidance: `top-down-survey` + `topographic` + chart splatches for topo-map output;
`low-angle-hero` + structure glyphs for monumental reads; `wide-cinematic` + cinematic
splatches under `painterly`.
