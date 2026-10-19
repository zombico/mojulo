---
{
  "id": "relativistic",
  "name": "Relativistic science world (spacetime round one mass, composed from laws)",
  "family": "science",
  "entry": "create_view",
  "summary": "Compose a general-relativity demo from a table of laws (the spacetime round one non-rotating mass; light bent round it and a disk's shifted glow; bodies on geodesics; clocks held still or let fall) instead of picking a ready-made one: checked against the exact shadow, the bending of light, the perihelion advance and the fall to the horizon, the light drawn by a shader held to JS, every row sourced and dated.",
  "when": "Reach for this when a teacher or student wants relativity worked, not just shown: 'what a black hole really looks like and why', 'how much light bends passing the Sun', 'why Mercury's orbit turns 43 arcseconds a century', 'a star orbiting close to a black hole', 'what happens to a clock falling into a black hole', 'why GPS clocks run fast', 'gravitational time dilation', 'the photon sphere and the innermost stable orbit'. The curated `black-hole` kind is one fixed picture; compose here when the mass, the observer or the setup is the teacher's. Newton's orbits are the classical scale's; a spinning hole, gravitational waves and special relativity are not in this table yet."
}
---

A relativistic science world is a demo **composed** from a closed table of laws for the spacetime round one
non-rotating, uncharged mass (Schwarzschild). Its stance is the quantum scale's: **faithful to the model, claiming
nothing beyond it.** The geodesic equations and their closed forms are exact and checked; what is drawn of them is a
picture, and the page says which is which. Every row carries its sources and the date it was last reviewed.

A world is one **system**, always with one `schwarzschild` row:

| System | What it is | How it runs |
|---|---|---|
| `light` | what an observer held still sees: the shadow, the photon ring, a thin disk's lensed and shifted glow, the sky bent round the mass | each pixel's light traced back from the eye by a shader, step for step the JS scheme the gates check |
| `orbit` | test bodies on geodesics: the perihelion advance, the plunge inside 3 Rs | RK4 in the body's own time, played on the far clock's |
| `clocks` | clocks held at radii, and clocks let fall | still clocks tick √(1 − Rs/r); a falling one is integrated to the horizon |

Inside, lengths are Schwarzschild radii (Rs = 2GM/c²) and times Rs/c; the page and the readout give SI.

## The recipe

```
params: {
  model:      { system, laws, duration? },
  dress?:     { … },
  liberties?: [{ what, why }],
}
```

### Units

A bare number is SI. A string or pair carries its unit and is checked: `'10 M☉'`, `'5.972e24 kg'`, `'300 km'`,
`'1 AU'`, `'20 Rs'` (Schwarzschild radii of the world's mass), `'0.2 c'`, `'58.98 km/s'`, `'75°'`, `'1 yr'`.

### The model

- `laws` — one `schwarzschild` row and the system's rows from the table below. A law id the table does not have is a
  **gap** naming the row that is (`lensing` is a light world), the scale that owns it (Newton's orbits are
  classical), or why there is none yet (`kerr`, `special-relativity`, `gravitational-waves`).
- `light`: one `observer` (distance 3 to 1000 Rs, inclination from the disk's axis) and at most one `disk`, whose
  inner edge is at or outside 3 Rs. A light world has no duration: nothing in it moves.
- `orbit`: one to eight `body` rows (`id`, `at`, `v`, with `v` as a still observer there measures it, so below c),
  and a `duration` on the far clock.
- `clocks`: one to eight `clock` rows (`at`, `falls?`), and a `duration` on the far clock.

### What the solver checks (the machine gate)

Every mint returns its gates, each `{ id, want, ok, value, detail }`. They advise; none refuse.

- `closed-form:shadow` — light below the impact parameter 3√3/2 Rs is captured, found by bisection.
- `closed-form:deflection` — light passing at 10 Rs bends by the angle the exact orbit integral gives.
- `scheme-resolves` — the step the picture is traced with resolves the shadow and the bending to half a percent.
- `energy-held:<id>` — a body's energy and angular momentum stay as they began.
- `closed-form:fate:<id>` — the body does what its effective potential says (bound, circular, plunge, escape).
- `closed-form:advance:<id>` — a bound orbit turns each lap by the exact perihelion advance (an elliptic integral),
  measured from the run over every lap it completes.
- `closed-form:isco` — no circular orbit is stable inside 3 Rs, read off the matter law itself.
- `closed-form:fall:<id>` — a falling clock's own time to the horizon is the cycloid's.

A light world's picture is drawn by a shader. The **shader conformance gate** traces the same rays in Chrome and
in JS and compares where they go, where they meet the disk and with what shift, and the shadow's size on a frame
against Synge's formula. It runs in the test suite and on request
(`node scripts/science-conformance.mjs --ref <ref>`), not on every mint.

## The dress (the interactive page)

- `sky` (light, default `'grid'`) — the far sky as a grid of lines every 15°, so its bending shows, or `'stars'`.
- `hottest` (light, default 6500) — the colour temperature the disk's hottest ring is drawn at (the real disk glows
  in X-rays; its temperatures are stretched into visible colours), and `exposure` (default 2.5).
- `camera` — light: `'observer'` (the model's), `'face-on'`, `'edge-on'`; orbit and clocks: `'side'`, `'angle'`,
  `'top'`. Moving the camera on a light page makes you another observer, held still there.
- `trails` (orbit, default true), `hud`, `background`, `playback` — as the classical world's.
- `film` — the film dress, as the classical world's (`callouts` on the model's clock, `end_card`). A light world's
  proposed film swings the eye toward the disk's plane; an orbit or clocks world films the run and its end card.

## Reading the numbers back

The measuring tool reads a relativistic world at tier `si`: each body's position, radius and own time against the
far clock (orbit), each clock's own time against the far clock's (clocks), a light world's quantities (the shadow's
angle, the photon sphere, the innermost stable orbit, the disk's g range), with the rows' sources.

## Worked examples

A black hole the mass of the one at the centre of the Milky Way, seen almost edge-on, with a thin disk:

```
{ "model": { "system": "light", "laws": [{ "law": "schwarzschild", "mass": "4.3e6 M☉" },
  { "law": "observer", "distance": "40 Rs", "inclination": "80°" }, { "law": "disk", "outer": "15 Rs" }] } }
```

Mercury's orbit turning 43″ a century (released at perihelion with its perihelion speed):

```
{ "model": { "system": "orbit", "laws": [{ "law": "schwarzschild", "mass": "1 M☉" },
  { "law": "body", "id": "mercury", "at": ["46001200 km", 0, 0], "v": [0, "58.98 km/s", 0] }], "duration": "1 yr" } }
```

A star close to a black hole, its orbit a rosette:

```
{ "model": { "system": "orbit", "laws": [{ "law": "schwarzschild", "mass": "1 M☉" },
  { "law": "body", "id": "star", "at": ["20 Rs", 0, 0], "v": [0, "0.12 c", 0] }], "duration": "200 ms" } }
```

Why GPS clocks run fast: a clock on the ground and one at GPS altitude, 45.7 µs a day apart:

```
{ "model": { "system": "clocks", "laws": [{ "law": "schwarzschild", "mass": "5.972e24 kg" },
  { "law": "clock", "at": "6371 km" }, { "law": "clock", "at": "26560 km" }], "duration": "1 d" } }
```

A clock let fall into a black hole, beside two held still:

```
{ "model": { "system": "clocks", "laws": [{ "law": "schwarzschild", "mass": "10 M☉" },
  { "law": "clock", "at": "1000 km" }, { "law": "clock", "at": "100 km" }, { "law": "clock", "at": "300 km", "falls": true }],
  "duration": "8 ms" } }
```

<!-- laws:begin (generated from the law tables: node scripts/science-cards.mjs) -->

## The laws

### Every system

#### `schwarzschild`

The spacetime round one non-rotating, uncharged `mass` (Schwarzschild). Its horizon is at Rs = 2GM/c²; light circles it at 1.5 Rs; nothing orbits stably inside 3 Rs.

- Takes `mass` (a mass, e.g. '10 M☉' or '5.972e24 kg'; required).
- Leaves out: The mass does not spin and carries no charge; nothing else bends spacetime (the bodies and the disk are test matter).
- Sources: Misner, Thorne & Wheeler, Gravitation (1973), ch. 25; Carroll, Spacetime and Geometry (2004), §5.4–5.6; CODATA 2018 recommended values (NIST); IAU 2015 Resolution B3 (nominal solar values) (reviewed 2026-10-19).
- Smallest example: `{"system":"clocks","laws":[{"law":"schwarzschild","mass":"10 M☉"},{"law":"clock","at":"1000 km"},{"law":"clock","at":"100 km"},{"law":"clock","at":"300 km","falls":true}],"duration":"8 ms"}`

### The light system

#### `observer`

Where the light ends: an observer held still at `distance` (a length, or `'20 Rs'`), looking at the mass from `inclination` (from the disk's axis; 0 is face-on).

- Takes `distance` (a length, e.g. '300 km', or in Schwarzschild radii, '20 Rs'; required), `inclination` (an angle, e.g. '75°'; default 1.2).
- Leaves out: The observer is held still (static); light's travel time to the eye is not shown.
- Sources: Hartle, Gravity: An Introduction to Einstein's General Relativity (2003), ch. 9–11; Synge, MNRAS 131, 463 (1966) (reviewed 2026-10-19).
- Smallest example: `{"system":"light","laws":[{"law":"schwarzschild","mass":"10 M☉"},{"law":"observer","distance":"30 Rs","inclination":"75°"},{"law":"disk","outer":"12 Rs"}]}`

#### `disk`

A thin disk of gas circling in the equatorial plane from `inner` (default the innermost stable orbit, 3 Rs) to `outer`. Each ring glows at a temperature ∝ r^(−3/4)·(1 − √(inner/r))^(1/4), and the light reaching the eye is shifted by g, the Doppler and gravitational factors together: the side coming toward you brighter and bluer, the inner edge dimmed and reddened.

- Takes `inner` (a length, e.g. '300 km', or in Schwarzschild radii, '20 Rs'; default 3), `outer` (a length, e.g. '300 km', or in Schwarzschild radii, '20 Rs'; required).
- Leaves out: The disk is infinitely thin and opaque only where light crosses it; its gas follows circular geodesic orbits; its glow is the thin-disk profile, not a simulated flow.
- Sources: Shakura & Sunyaev, A&A 24, 337 (1973); Page & Thorne, ApJ 191, 499 (1974); Luminet, A&A 75, 228 (1979); Cunningham, ApJ 202, 788 (1975) (reviewed 2026-10-19).
- Smallest example: `{"system":"light","laws":[{"law":"schwarzschild","mass":"4.3e6 M☉"},{"law":"observer","distance":"40 Rs","inclination":"80°"},{"law":"disk","outer":"15 Rs"}]}`

### The orbit system

#### `body`

A test body (`id`) released at `at` with velocity `v`, as a still observer there measures it (so below c). It follows a geodesic: an orbit that turns a little each lap (the perihelion advance), or a plunge when it comes too close.

- Takes `id` (a short name; required), `at` ([x, y, z], each a length, e.g. '300 km', or in Schwarzschild radii, '20 Rs'; required), `v` ([x, y, z], each a speed below c, e.g. '0.2 c' or '30 km/s'; required).
- Leaves out: The body is a test mass: it bends nothing and loses nothing to gravitational waves.
- Sources: Misner, Thorne & Wheeler, Gravitation (1973), ch. 25; Carroll, Spacetime and Geometry (2004), §5.4–5.6; Einstein, Sitzungsber. Preuss. Akad. Wiss. 831 (1915) (reviewed 2026-10-19).
- Smallest example: `{"system":"orbit","laws":[{"law":"schwarzschild","mass":"1 M☉"},{"law":"body","id":"star","at":["20 Rs",0,0],"v":[0,"0.2 c",0]}],"duration":"100 ms"}`

### The clocks system

#### `clock`

A clock at distance `at` from the centre, held there (ticking √(1 − Rs/r) as fast as a far clock), or let fall from rest (`falls: true`), its own time running out as it nears the horizon, which a far clock never sees it cross.

- Takes `at` (a length, e.g. '300 km', or in Schwarzschild radii, '20 Rs'; required), `falls` (true or false; default false).
- Leaves out: Each clock is held still (or falls straight in); clocks at one place agree; light's travel time to a far reader is not shown.
- Sources: Hartle, Gravity: An Introduction to Einstein's General Relativity (2003), ch. 9–11 (§9.3; GPS: §6.4); Ashby, Living Rev. Relativ. 6, 1 (2003) (reviewed 2026-10-19).
- Smallest example: `{"system":"clocks","laws":[{"law":"schwarzschild","mass":"5.972e24 kg"},{"law":"clock","at":"6371 km"},{"law":"clock","at":"26560 km"}],"duration":"1 d"}`

<!-- laws:end -->
