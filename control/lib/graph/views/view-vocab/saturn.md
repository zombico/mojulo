---
{
  "id": "saturn",
  "name": "Planets of the Solar System",
  "family": "science",
  "entry": "create_view",
  "summary": "Mint a PLANET of the solar system — Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus or Neptune — OR a GALLERY stepper through all eight, rendered by a per-pixel ray-tracing fragment shader (the same shader path as the black hole).",
  "when": "Reach for this on framing like 'show me Saturn / the planets / a solar system gallery / Jupiter's Great Red Spot / Earth / Mars / Uranus on its side'.",
  "retired_tool": "create_saturn_view"
}
---

Mint a PLANET of the solar system — Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus or Neptune — OR a GALLERY stepper through all eight, rendered by a per-pixel ray-tracing fragment shader (the same shader path as the black hole). The shader does what a mesh renderer can't do cleanly: for ringed planets the RINGS CAST A SHADOW on the globe, the PLANET CASTS ITS SHADOW across the rings, the rings are SEMI-TRANSPARENT, and backlit they GLOW by forward-scattered light. Each planet has its true character: rocky cratered worlds (Mercury, Mars with polar ice caps), thick cloud decks (Venus), blue oceans + continents + clouds (Earth), banded gas giants with storms (Jupiter's Great Red Spot, Neptune's Great Dark Spot) and rings (Saturn's bright C/B/Cassini/A system, Neptune's Adams ring ARCS, Uranus TIPPED ON ITS SIDE with vertical rings). Pass `gallery:true` for a one-planet-per-step GALLERY — a ◀ ▶ stepper (also arrow keys) flips through all eight in one World. Or pass a single `planet`. Drag to ORBIT, scroll to zoom. Three lighting looks (`scenario`): 'classic' (sunlit), 'backlit' (in the planet's shadow — glowing rings + bright limb), 'polar' (high angle); an `inclination` knob tunes the viewing angle. Served as a live three.js World at `/api/sketches/<ref>/world`. You pass a tiny recipe; the substrate stores ONLY the recipe (`manifest.kind === 'saturn-view'`, no geometry) and regenerates the shader on render. ORBIT-ONLY object study: no CSS-3D `/scene` form; open the worldUrl. Reach for this on framing like 'show me Saturn / the planets / a solar system gallery / Jupiter's Great Red Spot / Earth / Mars / Uranus on its side'.

## Parameters

Pass these in `create_view`'s `params` object. `title`, `viewBox`, `scene`, `ref`, `folder_ref` are top-level `create_view` params and may be omitted from `params`.

- `title` (string) — Title for the resulting sketch artifact.
- `gallery` (boolean) — If true, render a GALLERY stepper through all eight planets (◀ ▶ buttons + arrow keys), one per step. Ignores `planet`.
- `planet` (string) — Which planet (default 'saturn'): mercury / venus / earth / mars (rocky & cloud & ocean worlds), jupiter (Great Red Spot), saturn (the bright rings), uranus (tipped on its side), neptune (methane blue, ring arcs).
- `scenario` (string) — The lighting look (default 'classic'): 'classic' (sunlit, open rings, ring shadow on the globe), 'backlit' (in the planet's shadow — glowing translucent rings), 'polar' (high-angle, the full ring system).
- `inclination` (number) — Viewing inclination in degrees above the ring plane (2–88). Low = edge-on (rings nearly a line); high = face-on (rings wide open). Overrides the scenario default.
- `ring_outer` (number) — Outer ring radius in planet-radius units (1.6–3.0; default 2.27 ≈ the real A-ring edge).
- `scale` (number) — Reserved (default 1).
- `viewBox` (object) — Optional render size { width, height } (default 1120×780).
- `scene` (object) — Optional scene options, e.g. { bg: "#01010a" }.
- `ref` (string) — optional stable sketch ref.
- `folder_ref` (string) — optional sketch folder to file under.
