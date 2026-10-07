---
{
  "id": "aurora",
  "name": "Aurora borealis",
  "family": "science",
  "entry": "create_view",
  "summary": "The aurora as volume-raymarched curtains folded along the auroral oval over a dark night Earth — green oxygen low, red oxygen high, nitrogen purple at the base, widening with geomagnetic activity.",
  "when": "show my student the northern lights; why auroras are green and red; what the auroral oval is; how a geomagnetic storm changes the aurora; aurora australis"
}
---

Glowing curtains fold and drift along a ring around the magnetic pole of a
dark night Earth — the auroral OVAL, where solar-wind electrons spiral down
the field lines. The camera orbits the whole globe: from the side the curtains
read as vertical rayed sheets; from above, the oval closes into its ring. City
lights speckle the night surface below; the volume occludes the starfield
behind it.

The colour ladder is the real emission physics: green 557.7 nm atomic oxygen
at 100–150 km, red 630.0 nm oxygen above 200 km, blue-purple molecular
nitrogen fringing the base. Raising the activity level widens the oval
equatorward, multiplies and sharpens the curtain folds, and strengthens the
purple fringe — the anatomy of a geomagnetic storm.

Orbit-only object study, time-evolving (curtains surge and drift); no walk.

## Parameters

- `scenario` — `quiet` (a single thin arc, Kp 1–2) | `active` (folded
  curtains, Kp 4–5 — default) | `storm` (a wide, fast, violent oval, Kp 7+).
- `activity` — number 0..1. Overrides the scenario's activity level while
  keeping its oval geometry.
- `viewBox` — `{ width, height }` (default 1120×780).
- `scene` — `{ bg }` background hex (default near-black space).
- `title`, `ref`, `folder_ref` — the standard sketch fields.

## Examples

- The classic show: `{ scenario: 'active' }`
- Teach the storm progression: mint `quiet`, `active`, `storm` side by side —
  watch the oval widen and the folds multiply.
- A barely-there arc: `{ scenario: 'quiet', activity: 0.15 }`
