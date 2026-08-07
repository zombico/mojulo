---
{
  "id": "planetary",
  "name": "Planetary",
  "family": "world",
  "entry": "compose_world",
  "summary": "Mint a SPACE-ACCURATE planetary body hung in a full celestial sphere — Earth as it reads from orbit: a sun-lit marble (day/night terminator, soft atmospheric limb), real coastlines traced as a green wireframe (geography, NOT political bord…",
  "when": "Reach for this on framing like 'put Earth in space / a space-accurate globe / a live mojulo earth / Earth, Moon and Sun right now'.",
  "retired_tool": "create_planetary"
}
---

Mint a SPACE-ACCURATE planetary body hung in a full celestial sphere — Earth as it reads from orbit: a sun-lit marble (day/night terminator, soft atmospheric limb), real coastlines traced as a green wireframe (geography, NOT political borders), relative land ELEVATION shown as a height-coloured hypsometric BLANKET draped over the continents (or as golden-angle radial spikes), no horizon, stars in every direction. Built on the rotatable-starmap basis: a live, traversable three.js World served at `/api/sketches/<ref>/world` (drag to ORBIT — the world-fixed starfield pans as you go). You pass a tiny recipe (a SUBJECT + a few knobs); the substrate stores ONLY the recipe (`manifest.kind === 'planetary'`, no geometry) and regenerates the body on render. The subject fixes two things from its CORE: the AXIS MUNDI (the body's tilted polar axis, a pole-to-pole needle) and the MANDALA (the radial graticule cage — equator + latitude rings + meridians). Currently the only subject is 'earth' (a future 'sun'/'solar-system' subject would put the Sun at the core with an orbit-ring ecliptic mandala). By DEFAULT an earth is the opinionated 'mojulo earth' view: LIVE geo-locked — the Sun, day/night terminator and Moon are placed at their TRUE positions for the CURRENT instant and re-resolve on every load (reload to advance), and the World ships Earth / Sun / Moon camera bookmarks. Pass `datetime` to FREEZE a specific moment instead, or sun_u/sun_h to drive the sun by hand. ORBIT-ONLY — there is no preset-shot CSS-3D `/scene` form; open the worldUrl. Reach for this on framing like 'put Earth in space / a space-accurate globe / a live mojulo earth / Earth, Moon and Sun right now'.

## Parameters

Pass these via `compose_world`'s `overrides` (deep-merged over the theme pack). `seed`, `title`, `ref`, `folder_ref` are top-level `compose_world` params.

- `title` (string) — Title for the resulting sketch artifact.
- `subject` (string) — The centre body (default 'earth') — fixes the axis mundi (its polar axis) and the mandala (its graticule).
- `seed` (number) — Star-field RNG seed (default 1) — same seed → same sky.
- `stars` (number) — Star density multiplier (default 1; 0 = empty void).
- `sun_u` (number) — Sun azimuth 0..1 around the body — drives where the day/night terminator falls (default 0.25).
- `sun_h` (number) — Sun elevation 0..1 relative to the equator (default 0.5 = on the equatorial plane).
- `sun` (boolean) — Pin the SUN itself as a bright luminary disc on the star sphere, at the real light direction (the lit hemisphere faces it). Default true; set false for a sun-lit body with no visible sun.
- `sun_size` (number) — Sun disc size multiplier (default 1).
- `sun_glow` (number) — Sun glow-halo brightness multiplier (default 1.3 — brighter than a horizon sun since it carries the scene against the void).
- `obliquity` (number) — Axial tilt of the axis mundi in degrees (default 23.4, Earth's obliquity).
- `mandala` (boolean) — Draw the graticule mandala + polar axis-mundi needle (default true).
- `continents` (boolean) — Trace real coastlines (Natural Earth 110m) as a green wireframe on the surface — geography, not borders (default true).
- `blanket` (boolean) — Drape a filled land surface over the continents, displaced by elevation and coloured DETERMINISTICALLY by height (hypsometric ramp, green→amber→snow); default true.
- `relief` (boolean) — Show relative land elevation as golden-angle (Fibonacci-sphere) radial spikes, hypsometric-coloured; peak ≈ 5px proud. Default false (the blanket supersedes it; set true for the bare spike field).
- `relief_scale` (number) — Multiplier on the relief spike height (default 1; e.g. 6 exaggerates mountains for a demo).
- `atmosphere` (boolean) — Draw the translucent atmospheric limb shell (default true).
- `clouds` (boolean) — Draw the wispy translucent cloud veils swirled by the general circulation (default true).
- `moon` (boolean) — Hang the MOON in the scene — a real companion body at TRUE scale (0.27 Earth radii) and TRUE mean distance (60.3 Earth radii), sun-lit so its phase is correct. As in reality it reads as a small, far disc. Default true.
- `moon_angle` (number) — The Moon's orbital position in degrees from the sub-solar point — 0 new → 90 first/last-quarter → 180 full (default 90, a half-lit quarter moon just off Earth's limb in the opening frame). Higher/lower angles swing it toward gibbous/crescent and out of the default frame.
- `moon_scale` (number) — Multiplier on the Moon radius (default 1 = true scale; raise it to exaggerate the disc for a demo).
- `night_fill` (number) — Night-side floor 0..0.6 — how far the dark (night) hemisphere is lifted out of pure black so it stays visible against the void with a readable day/night terminator (default 0.16 = a deep-navy night globe; 0 = photoreal near-black; 0.3+ = strongly visible night side). The Moon keeps its own low floor so its crescent phase still reads.
- `datetime` (string) — FREEZE the scene to a fixed real instant (ISO 8601, e.g. '2026-06-17T22:30:00-04:00'). The Sun + Moon are placed at their TRUE positions for that time — real sub-solar point (day/night terminator over the right longitude), real sub-lunar direction, true lunar distance and real phase. Overrides sun_u / sun_h / moon_angle / obliquity and turns OFF live mode (a frozen snapshot, byte-identical on every re-render). Pass 'now' instead to mean live.
- `live` (boolean) — LIVE geo-lock: the Sun, day/night terminator and Moon track the CURRENT instant, re-resolved on every /world render (reload to advance). This is the DEFAULT for the 'earth' subject (the opinionated 'mojulo earth' view) unless you froze a `datetime` or are driving the sun by hand (sun_u/sun_h). Set false for a static knob-driven globe.
- `viewBox` (object) — Optional render size { width, height } (default 1120×780).
- `ref` (string) — optional stable sketch ref.
- `folder_ref` (string) — optional sketch folder to file under.
