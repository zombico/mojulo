---
{
  "id": "transport-hub",
  "name": "Transport Hub",
  "family": "world",
  "entry": "compose_world",
  "summary": "Mint a 3D TRANSPORTATION HUB from a tiny RECIPE — the fractal-generation path, a sibling of create_fractal_city tuned to transit.",
  "when": "Reach for this on framing like 'make an airport / train station / bus terminal / subway station / a transit hub'.",
  "retired_tool": "create_transportation_hub"
}
---

Mint a 3D TRANSPORTATION HUB from a tiny RECIPE — the fractal-generation path, a sibling of create_fractal_city tuned to transit. You pass a `mode` plus a seed; the substrate stores ONLY the recipe (no geometry) and regenerates the whole hub deterministically on render, so it costs almost no tokens and the same seed always rebuilds the same hub. The result is a live, dependency-free CSS preserve-3d HTML scene served at `/api/sketches/<ref>/scene` (open it / embed it in an <iframe>); same artifact system as the other illustration mints (persists with `manifest.kind === 'transportation-hub'`). Unlike the uniform building-block grid of a city, a hub is organized around an anchor terminal that sprouts concourse FINGERS, each fractally filled with its mode's repeated unit. Three modes: `airport` (glass terminal + control tower + concourse piers with jet-bridge gates + parked aircraft + apron + taxiway + runways), `train-station` (head-house + parallel platforms with canopies + rail tracks + multi-car trains + a footbridge), `bus-terminal` (concourse + a sawtooth row of angled bus bays + parked buses + drive lanes). Floodlight masts light the apron at night. A fourth mode, `subway`, is the INTERIOR sibling: instead of an exterior top-down apron, it renders the inside of a wide enclosed island-platform hall — central platform with a track trough on each side, columns marching down the platform, tiled walls + a station-name frieze, a glowing ceiling-fixture strip, tunnel portals, and a multi-car train parked broadside (accurate cars with a laid-out interior — bench seats + poles + glass) — framed as a three-quarter establishing shot looking across the hall. Pass `building: true` for the 2-LEVEL version: that hall stacked under a mezzanine CONCOURSE (a full-width fare line of turnstiles + an operator booth + ticket machines + a wall map) joined by stair / escalator / elevator through a void — a traversable `subway-building` /world kind with tiled pillars, brick-bond walls and a marble floor. Either shape takes `atmosphere: true` for a moody traced-light relight (dark base + ceiling-fixture light pools + cast shadows) on its /world view. (The single hall persists as a `subway-station` scene kind with a baked /scene + PNG; the building persists as `subway-building`, /world.) Reach for this on framing like 'make an airport / train station / bus terminal / subway station / a transit hub'.

## Parameters

Pass these via `compose_world`'s `overrides` (deep-merged over the theme pack). `seed`, `title`, `ref`, `folder_ref` are top-level `compose_world` params.

- `title` (string) — Title for the resulting sketch artifact.
- `mode` (string) — Hub mode (default 'airport'): 'airport' | 'train-station' | 'bus-terminal' | 'subway' (interior station hall).
- `line` (string) — Subway only: line colour theme for the train band / frieze / roundels ('blue' | 'red' | 'green' | 'orange'). Omit to pick by seed.
- `building` (boolean) — Subway only: mint the 2-LEVEL building — the platform hall under a mezzanine concourse (fare line + turnstiles + operator booth + ticket machines + wall map) joined by stair/escalator/elevator through a void. A traversable `subway-building` /world kind (vs the single-hall `subway-station`). Default false.
- `layout` (string) — Subway building only: 'standard' (platform under a mezzanine, default) or 'interchange' — a perpendicular TWO-LINE crossing where a N-S platform sits below an E-W platform, joined by escalators through a punched crossing void (Toronto's Bloor-Yonge / St George). Implies the building.
- `line_b` (string) — Interchange only: line colour for the SECOND (upper, E-W) platform ('blue' | 'red' | 'green' | 'orange'). Omit to auto-pick a contrasting line.
- `atmosphere` (boolean) — Subway only: render with the atmospheric traced-diffusion relight — a dark low-ambient base with warm light pools at the ceiling fixtures + cast shadows (the moody chiaroscuro look), instead of the bright even lighting. Shows on the /world view. Default false.
- `gates` (integer) — Subway building only: number of turnstile lanes on the fare line (2–8, default 5).
- `seed` (integer) — Deterministic seed — the whole hub is a pure function of it. Same seed → same hub.
- `density` (number) — How full the gates/platforms/bays are with parked vehicles, 0.2–1 (default 0.6).
- `depth` (integer) — Airport only: boarding-corridor branch depth (default 2). Higher → concourses manji-hook further from the central terminal.
- `glyph` (string) — Airport only: coarse terminal topology — 'radial' (central polygon mandala + radiating concourses) or 'linear' (a long spine with perpendicular finger bays). Omit to derive from `primary`/seed.
- `primary` (string) — Airport only: the DOMINANT shape — 'core' (big central headhouse + radiating arms), 'spine' (a long dominant concourse spine), or 'hammerhead' (a primary pier ending in a perpendicular cross-bar). Omit to pick by seed.
- `asymmetry` (number) — Airport only: how far the layout breaks from regular symmetry, 0–1 (default 0.6). Higher → more varied arm lengths/angles and more stub arms.
- `chirality` (integer) — Airport only: the rotational sense of the manji hooks (the pinwheel). 1 or -1; omit to pick by seed.
- `time` (string) — Optional daylight model: 'day' (sun + cast shadows + day sky) or 'night' (flood-mast light pools + moonlight + stars).
- `region` (object) — Optional world footprint { x, y, w, d } (default a 40×34 apron).
- `viewBox` (object) — Optional render viewBox { width, height }.
- `ref` (string) — optional stable sketch ref.
- `folder_ref` (string) — optional sketch folder to file under.
