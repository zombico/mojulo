---
{
  "id": "assembler",
  "name": "Assembler",
  "family": "object",
  "entry": "mint_solid",
  "summary": "Compose several finished workbench PARTS into one worldspace by gravity-seating or superposition — the ring above the workbench (assembler makes a chariot; workbench makes chariot parts).",
  "when": "Reach for this on 'assemble / arrange / combine several parts / build a <complex thing> from workbench parts / a stair from one step / a banister from one spindle'."
}
---

Compose several finished WORKBENCH parts into ONE worldspace — the ring above the object study. The principle: the assembler makes a CHARIOT, the workbench makes chariot PARTS. A workbench is single-subject (it builds one object well), so it cannot honestly make "something complicated"; the assembler takes several whole workbench parts and arranges them. Every part already shares the same measured scale, so this is a PLACING concern, not a geometry one — the assembler never reaches inside a part. Need a part the workbench doesn't have? Mint it on the workbench first (a spindle is just its own narrow lathe), then place it here.

Placement has two modes. GRAVITY SEATING (the standard) drops a part so its lowest point — measured AFTER rotate/flip/scale — rests on its support (the ground or an earlier part's top), so you never hand-compute a z lift; a wheel rotated upright auto-seats at its own radius. SUPERPOSITION (the allowed non-standard fallback) gives a part an absolute `at:[x,y,z]` with no `on`, for parts that bridge rather than rest — a chariot's bed sits between its wheels, not on the floor. `repeat` arrays a part along a line (one spindle → a banister), and `rotate`/`flip`/`scale` adjust a single placement (flip a peg upside-down → a spindle).

Source is FROZEN AT IMPORT: each item's `source` is either an inline workbench part or a `{ ref }` to a stored workbench, copied in at mint time. There is no live binding — if a source workbench later changes, re-import and redo the adjustments. The substrate stores the frozen recipe (`manifest.kind === 'assembler'`, no geometry) and regenerates the scene deterministically on the SAME measured studio vantage as the workbench: a traversable three.js World at `/api/sketches/<ref>/world` plus preset CSS-3D shots at `/scene`. A source ref that is missing, is not a workbench, or has no renderable monomers is refused at mint; an assembly floating off the grid is flagged in `stats.warnings` (advisory, never gated).

## Spec shape

`title`, `ref`, `folder_ref` are top-level mint params. Everything below lives in `spec`. `items` is required (a non-empty array — each item places one workbench part).

```
{
  items: [
    { source, id?, at?, on?, gap?, rotate?, flip?, scale?, repeat? }
  ],
  units?:   'cm',
  viewBox?: { width, height },
  facing?:  '+y' | '-y' | '+x' | '-x' | <deg>,
  model?:   'biped',
  rig?:     { bones?, joints? }
}
```

## Items — the placed parts

Each item drops one frozen workbench part into the shared worldspace at a position.

- `source` (required) — the workbench PART, frozen inline at mint. Either an inline workbench manifest `{ lathes?:[…], extrudes?:[…], sweeps?:[…] }` (copy a part recipe in), OR `{ ref: "sk_…" }` pointing at a stored workbench sketch (its monomers are copied in here — no live link afterward).
- `id` (string) — optional name for this part so a LATER part can rest `on` it (gravity seating).
- `at` ([x,y,z], default [0,0,0]) — REPOSITION. x/y is where the part sits in shared space (z is up). With `on`, the z here is IGNORED (gravity computes it); without `on`, z is the absolute superposition height. Without any `at`, all parts pile at the origin.
- `on` ('ground' | an earlier part's id/index) — GRAVITY SEAT (standard placement). `'ground'` rests on z=0; an id/index rests on that earlier part's top. Drops the part so its lowest point, measured after rotate/flip/scale, sits on the support. Omit for superposition (absolute `at` z).
- `gap` (number) — with `on`, lift the part this far above its support (default 0).
- `rotate` ([rx,ry,rz] in DEGREES) — orient (applied Rz·Ry·Rx, after flip). Lighting tracks the rotation.
- `flip` (string) — mirror on any combo of axes (`'x'` | `'z'` | `'xy'` | `'xyz'` …); e.g. flip a candlestick peg on z → a spindle.
- `scale` (number, default 1) — uniform scale nudge within the shared scale.
- `repeat` — linear array: `{ count: N, step: [dx,dy,dz] }` replicates the part at stepped positions (one spindle → a banister); copy k sits at `at + k·step`.

## Units, framing, and the biped model

- `units` (default `'cm'`) — informational unit label surfaced in the size readout and grid (1 grid cell = 5 units).
- `viewBox` (default 900×900) — render viewBox `{ width, height }`.
- `facing` (default `'+y'`) — which way the assembled model's FRONT points, so the preset 'front' shot and opening camera look it in the face: `'+y'` / `'-y'` / `'+x'` / `'-x'` / a raw azimuth offset in degrees. Camera-only; geometry is untouched.
- `model` — optional body-model marker. `'biped'` declares a humanoid unit (head + torso + two arms + two legs of named stations), which makes it POSABLE — the figure's vajra kinematics derive a rig from the station names/geometry and compile poses into posed sibling manifests. Only `'biped'` is recognized today.
- `rig` — optional rig overrides for a `'biped'` model when the automatic derivation guesses wrong: `{ bones: { <stationId>: '<vajraBone>' }, joints: { <jointName>: {x,y,z} } }` (joints in the unit's own coordinates). Omit to let station names + geometry derive everything.

## Worked example

A banister from one spindle (repeated along a line) plus two seated posts — the mint params (`kind` + top-level `title` + the `spec` body):

```
{
  kind: 'assembler',
  title: 'baluster run',
  spec: {
    items: [
      { source: { ref: 'sk_post' },    id: 'left',  at: [0, 0, 0],  on: 'ground' },
      { source: { ref: 'sk_spindle' }, at: [4, 0, 0], on: 'ground',
        repeat: { count: 6, step: [4, 0, 0] } },
      { source: { ref: 'sk_post' },    id: 'right', at: [28, 0, 0], on: 'ground' }
    ],
    units: 'cm'
  }
}
```

Returns `{ ok, ref, worldUrl, sceneUrl, url, stats }` — `stats.parts[]` reports each part's placement + copy count, and `stats.warnings` flags an assembly floating off the measured grid. Read the warnings before opening /world.
