---
{
  "id": "classical",
  "name": "Classical science world (composed from Newton's laws)",
  "family": "science",
  "entry": "create_exhibit",
  "summary": "Compose a classical-physics demo from a table of laws (gravity, springs, rods, ropes, drag, buoyancy, charges, fields, surfaces, collisions) instead of picking a ready-made experiment; the solver steps it, checks it against conservation laws and the textbook answer, and the page says what is real and what is drawn.",
  "when": "Reach for this when a teacher or student wants a physics demo no ready-made kind covers, or wants to change the setup: 'a demo for my class of a ball on a spring in thick oil', 'simulate two moons orbiting a planet', 'what happens if the pendulum swings from the side', 'show a charge curling in a magnetic field', 'a ball bouncing down stairs losing energy', 'Newton's cradle with three balls', 'a block sliding down a rough ramp'. Classical means bounded by Newton's laws, at any size: an orbit and an electron in a magnet are both classical while the regime checks say so."
}
---

A classical science world is a demo **composed** from a closed table of laws, not one hand-authored experiment. You
write the model (bodies, the laws acting on them, how long to run); the solver checks every quantity's units, picks a
stepper and a step from the fastest motion, runs it, and examines it. The page plays the run on equal-time samples
(the speed on screen is the speed in the model), with a system readout and a **What's real · what's drawn** panel.

Use a ready-made kind when it already is the demo (the mechanics kind's simple machines and engines, the orbit
kind's solar system, the rocket and airplane missions). Compose a classical world when the setup is the teacher's
own, or should change.

## The recipe

```
params: {
  model:     { frame?, bodies, laws, observe?, duration, dt?, stepper? },   the part that is examined
  dress?:    { … },                                                         the part that sells the picture
  liberties?: [{ what, why }],                                              exaggerations you are taking on purpose
}
```

Effort goes where the split says: the **model** is dimension-checked, run and gated; the **dress** only changes how it
looks and never reaches the solver. Anything drawn rather than real is a liberty, and the page shows every one.

### Units

A bare number is SI (kg, m, s, N, J, C, T). A string or a pair carries its unit and is checked against what the slot
wants: `'500 g'`, `'36 km/h'`, `'30 deg'`, `[2, 'µC']`, `'2.5 yr'`. A mass given in m/s is an error, not a guess.

### The model

- `frame` — `{ g }`: the uniform gravity a `gravity-uniform` law uses (default Earth, 9.8 m/s²; or 'moon', 'mars',
  'jupiter', or a quantity). The world is z-up: down is −z.
- `bodies` — `[{ id, mass, radius?, at, v?, charge?, fixed?, on_plane?, matter?, temperature?, spin?, as? }]`. `at` and `v` are [x, y, z]. A body
  with no radius is a point mass. A `fixed` body never moves but still pulls (a sun, a pivot charge). `on_plane: '<plane
  id>'` sets a body on that surface. `matter` names what it is made of, a solid from the destructible-physics matter
  table (`'steel'`, `'glass'`, `'timber'`, …, or `{ is, …overrides }`): with a radius and no mass its mass is the
  matter's density × the sphere's volume, and a collision or plane with no `e` takes the lower bounce of the two.
  `temperature` is where it starts (kelvin, or `'20 °C'`, `'68 °F'`; `'C'` alone is the coulomb): the `heat` law moves
  it, and a hot body is weaker when struck. `spin` (`[x, y, z]` in rad/s, or `'300 rpm'`, `'8 rev/s'` per component;
  `[0, 0, 0]` for a ball that starts still) makes it a spinning sphere: see **Spin and rolling**. `as` makes it a thing
  from the studio's libraries: see **A thing from the libraries**.
- `laws` — `[{ law: '<id>', …its params }]`, from the table below. A law id the table does not have is reported as a
  **gap** that names the scale that owns it (diffusion and reaction rates are microscopic; orbitals and bonds are
  quantum), and the rest of the model still runs.
- `observe` — what the readout and the mint report: `'energy'` (default), `'momentum'`, `'angular-momentum'`, or
  `{ quantity, of: '<body>' }` for `'speed'`, `'height'`, `'apex'`, `'range'`, `'period'` (optional `axis`),
  `'position'`, `'velocity'`, `'temperature'`, `'spin'`.
- `duration` — how long the model runs (a time). `dt` and `stepper` ('verlet' or 'rk4') override the solver's
  choice; leave them out unless a gate asks.

### What the solver checks (the machine gate)

Every mint returns its gates, each `{ id, want, ok, value, detail }`. They advise; none refuse. Energy is conserved
(or, when something loses it, never gained); momentum and angular momentum hold where nothing outside acts; rods keep
their length; nothing steps through a contact; the step resolves the fastest motion; and wherever the setup has a
textbook answer the run is measured against it. Two regime gates say when the model has left classical ground:
`newtonian-regime` (speeds near light need relativity) and `classical-regime` (a de Broglie wavelength as large as
the path needs the quantum scale). Say which gates ran and what they saw; the eyes gate is a person looking.

## The dress (the interactive page)

- `bodies` — `{ <id>: { color: '#rrggbb', label: 'text' | false } }`. Moving bodies are labelled by id when there are
  several.
- `trails` (default true) — the path each body takes.
- `vectors` (default false) — velocity (green) and acceleration (orange) arrows on every moving body.
- `hud` (default true) — the system readout, the honesty panel and the labels.
- `camera` — `'side'`, `'angle'` or `'top'` to open on (default: top for motion in a plane without gravity, side
  otherwise).
- `background` — `'#rrggbb'`.
- `playback` — seconds one run lasts on screen (default the model's duration, kept between 3 and 12).
- `field` — the electric field the `coulomb` and `lorentz` rows make, drawn from the same model:
  - `'lines'`: field lines traced from the charges where the run starts, as many from each as its share of the
    largest charge (`lines`, default 12, 2 to 32), in the charges' plane when they lie in one. A uniform field is
    drawn as even lines along it, gold for E and blue for B.
  - `'volume'`: the field's strength glowing on a log scale, warm where the potential is positive and cool where
    negative, drawn by a shader over the meshes that moves with the charges.
  - `'shells'`: the potential's shells where its size doubles, the same way.

  A drawn field adds its own checks to the page and the mint: `gauss`, the flux through a sphere round each charge
  is q/ε₀ and none through one round no charge (a surface integral of the field drawn, to one part in a million);
  `field-lines`, every line leaves a positive charge and ends on a negative one or leaves the frame, each charge
  carrying lines in proportion to its charge. A volume or shells are held to the field's sums by the shader
  conformance gate in the test suite (`node scripts/science-conformance.mjs --ref <ref>`), and cannot stand in a
  world.

The drawing declares its own liberties: a scale other than one metre per unit at very large or very small sizes, a
body too small to see drawn larger (a body that touches things keeps its true size), time sped up or slowed down, and
a field drawn (its lines a way to draw it, where they start, its glow's scale).

## A thing from the libraries

A body can be a thing the studio already makes: `as: { vehicle: 'sedan' }` (any word people say for a vehicle: its mass
with its driver from the road physics table, its size from the highway fleet's true dimensions, drawn as its true
loft, or as its box where it has none) or `as: { part: 'crate', size: [0.8, 0.8, 0.8] }` (a building or prop part by its
destructible-physics class: a crate, a barrel, a door, a wall block, a boulder…; its matter and the solid share of its
box from the class table, its mass from both). It takes no `radius`: its contacts are a sphere as wide as its box's
diagonal, it is drawn resting on its base, and it does not turn as it moves (its nose points the way it first moves).
The panel says each of these, and its matter feeds the impact verdicts and the ladder like any body's.

## Spin and rolling

A body given `spin` is a rigid sphere that turns. Its moment of inertia is a uniform ball's (2/5·m·r²), or a shell's
when its matter fills less than all of it (sheet metal). On a plane with friction (`mu`, `mus`) the friction acts at the
contact point, so it rolls: static friction holds the contact point still while it can (a solid ball rolls down a ramp
at 5/7 of the slide), kinetic friction works on the slip until it rolls (a skidding ball settles to 5/7 of its speed; a
backspun one comes back), and a bounce's friction trades speed and spin. The `magnus` law lifts it in the air: topspin
dips a ball, backspin floats it, sidespin curves it. Nothing in flight turns a spin; collisions between bodies are
smooth and leave it as it was; there is no rolling resistance. Bodies without `spin` slide as they always have.

It adds the `spin-held` gate (a spin changes only where a surface holds or strikes the body) and `closed-form:rolling`
when the model is a ball rolling from rest down a ramp. `{ quantity: 'spin', of }` reads it back, on the page too.

## A liquid that sets

The `gelling` law puts the bodies in a liquid (`medium`, from the matter table: `'honey'`, `'mud'`, `'water'`, …) whose
viscosity and yield stress move along a `curve` you write, `[{ at, viscosity?, yield? }]` (between points the viscosity
moves by its logarithm, the yield linearly; with no curve, the medium's own). A body in it is dragged by Stokes's law,
stepped exactly so a near-set liquid needs no tiny step, and held once the yield carries the net force on it: a sphere
stays put while that force is under τy·π·D² / (6 × 0.048) (Beris et al. 1985), so a falling-ball viscometer slows and
stops as the liquid sets. Add `buoyancy` with the same medium for its lift. A `layer` (a thickness) of the liquid on a
surface tilted by `slope` (default upright, the tube-tilt test) flows as a Bingham film and holds once its yield passes
ρ·g·h·sin(slope). Gates: `yield-holds` (a hold is never past what the yield carries), `closed-form:bingham-film`, and
`closed-form:viscometer` for a liquid that does not set. The readout gives the curve, when each body was held, and the
layer's flux and when it held; the page shows η and τy along the run.

### Reading the liquid's state from another scale

Instead of a `curve`, a gelling law can read one from a lower rung: `from: { microscopic: <a microscopic model with an
aggregation law>, observe: 'aggregated' }` runs that model and reads the share it assembles over time, and `relations`
turns the share into the liquid's state through cited rows, never a formula of your own: `{ relation: 'percolation',
top, onset? }` sets the yield (it grows from the gel point `onset` with the percolation exponent 1.9, de Gennes 1976,
to `top` when all has assembled) and `{ relation: 'krieger-dougherty', phi }` sets the viscosity (the assembled matter
filling `phi` of the volume, Krieger & Dougherty 1959). Both rungs keep one clock; past the lower run's end its share
holds. The `handoff-held` gate says whether the lower rung held its own checks; the panel names what was read and the
rows it went through, and the page shows the share assembled beside η and τy. The `stokes-regime` gate advises when a
body moves too fast for Stokes's drag in the liquid.

## Heat

The `heat` law gives every body with a matter and a radius a temperature that moves: it loses heat to the medium
(convection, `h`: still air's order unless given, or a liquid's when `medium` names one), to the surroundings
(radiation, each surface's emissivity from the matter table, `radiation: false` to leave it out), and through a contact
spot (`contact`, 1 mm) to the bodies and the planes with matter it touches; a plane with a `temperature` is a hot plate
or a cold one. A body is one temperature throughout, and takes its latent heat at its melting point before it rises
past it. The heat is stepped along the run once the motion is solved: heat never moves a body.

It adds its gates: `heat-conserved` (every joule the bodies lose is one that leaves them), `lumped-holds` (each body's
Biot number is under 0.1, so one temperature is fair), `heat-dt-resolves`, `bodies-solid` (advises when a body would
melt; the run keeps it whole), and `closed-form:cooling` when the model is exactly Newton's cooling. The readout says,
body by body, its temperature from start to end, where its heat capacity came from, its melting point and how much of
it melted, and the share of its strength it keeps at its hottest; with matter, each contact's verdict uses the
strength the body has at that moment. The page's readout shows each body's temperature.

## Matter and the ladder of scales

A model whose bodies name a matter reads back `matter`: each body's mass and where it came from, the energy it holds
before it fails, and the worst any contact did to it (holds, dents, breaks) by the games' own impact law. The
`bodies-intact` gate advises when a body would have broken; the run never breaks one.

Each such body also carries its **ladder**: rung by rung from the body down to its nuclei, each one saying what it is.
A rung is **simulated** (the body, run and gated; the world's ground when the demo stands in one), **depicted** (drawn
at true proportions from sourced numbers: a cubic metal's cell, steel's iron, aluminium, lead) or **explained** (a cited
sentence where nothing can be drawn honestly: a grain's shape, glass's network that never repeats, an atom of more
than one electron, a nucleus tens of thousands of times smaller than its atom). Every rung gives its size, its step from the one above
and its source; a rung under a thousandth of the one above is its own, never squeezed into that frame, and where the
table has nothing further down the last rung says so. The panel lists the ladder.

- `dress.ladder: '<body id>'` draws that body's depicted rung beside the demo: the cell's atoms where the lattice puts
  them, as touching spheres, its magnification against the demo on the panel. The `ladder-depicted` gate measures the
  drawn spacings against the source (one part in a billion). A body whose ladder has no depicted rung is refused, with
  its rungs listed.

## Reading the numbers back

The measuring tool reads a classical world at tier `si`: every body's `{ t, pos, vel, speed }` and the system's
`{ t, ke, pe, e, p, L }`, from the same recorded run the page plays, with the gates beside them.

## The film

A classical world films through its shoot plan (`shot: { motion: 'plan' }`, exported to MP4 or GIF). A recipe with no
`shoot` of its own films the plan the world proposes: a wide shot of the whole run, a close **replay** of the key
moment slowed down (the sharpest change in motion, such as a bounce or a collision, else the fastest moment, such as
the bottom of a swing or the closest pass of an orbit), and an **end card** that is the honesty panel held on the last
frame. A recipe's own `shoot` replaces the proposal; a shot's `speed` slows or speeds it, and the film says so on
screen while it plays.

The film dress (`dress.film`) is what a viewer who cannot ask needs, on the model's own clock:

- `callouts` — `[{ at, text, on? }]`: a caption at a model time (`at: 1.2`) or over a span (`at: [1.2, 2]`);
  `on: '<body>'` pins it beside that body. The page's readout keeps running under them.
- `replay` — `false` for none, or `{ at?, speed? }`: the moment to replay (a model time) and how slow (0.1 to 1,
  default 0.25).
- `end_card` — `false` to end on the run.

Slow motion is a liberty: the film tags it while it plays and lists it on the end card. The interactive page never
shows the film dress; the film never shows the panel (the end card says it instead).

## In a world

A classical demo stands in any world at true size: `compose_world({ …, overrides: { science: { kind: 'classical', model, at, ground: 'from-world' } } })`. The world's ground becomes a plane law, every body's path is checked against the world's surfaces, and the model's g against the setting's. Manual: `get_view_vocab({ id: 'science-setting' })`.

## Worked examples

A wide pendulum (its period is checked against the exact elliptic-integral answer, not the small-angle one):

```
{ "model": { "bodies": [{ "id": "bob", "mass": 1, "radius": 0.05, "at": [0.866, 0, 0.5] }],
  "laws": [{ "law": "gravity-uniform" }, { "law": "rod", "between": ["bob", [0, 0, 1]] }],
  "duration": 6, "observe": ["energy", { "quantity": "period", "of": "bob" }] } }
```

The Earth around the Sun, a year in a few seconds (the drawing says how much faster time runs and how much larger
the Earth is drawn):

```
{ "model": { "bodies": [{ "id": "sun", "mass": 1.989e30, "at": [0, 0, 0] },
    { "id": "earth", "mass": 5.972e24, "at": ["1 AU", 0, 0], "v": [0, "29.78 km/s", 0] }],
  "laws": [{ "law": "gravity-newton" }], "duration": "1 yr" } }
```

Two fixed charges, a positive one twice the size of the negative, with their field lines (twice as many leave the
positive charge, and those that do not end on the negative one leave the frame):

```
{ "model": { "bodies": [{ "id": "p", "mass": 1, "radius": 0.02, "charge": "2 µC", "at": [-0.5, 0, 0], "fixed": true },
    { "id": "n", "mass": 1, "radius": 0.02, "charge": "-1 µC", "at": [0.5, 0, 0], "fixed": true }],
  "laws": [{ "law": "coulomb" }], "duration": 1 }, "dress": { "field": "lines" } }
```

A ball bouncing on a lossy floor until it rests:

```
{ "model": { "bodies": [{ "id": "ball", "mass": 0.06, "radius": 0.033, "at": [0, 0, 1.5], "v": [0.6, 0, 0] }],
  "laws": [{ "law": "gravity-uniform" }, { "law": "plane", "e": 0.75, "mu": 0.2 }],
  "duration": 5, "observe": ["energy", { "quantity": "height", "of": "ball" }] },
  "dress": { "vectors": true, "film": { "callouts": [{ "at": [0, 0.5], "text": "Dropped from 1.5 m" },
    { "at": [0.5, 1.5], "text": "Each bounce keeps 75% of the speed", "on": "ball" }] } } }
```

A steel ball set on a steel hot plate at 250 °C, warming over ten minutes while it loses heat to the room:

```
{ "model": { "bodies": [{ "id": "ball", "matter": "steel", "radius": "1 cm", "at": [0, 0, 0.01], "on_plane": "plate" }],
  "laws": [{ "law": "gravity-uniform" }, { "law": "plane", "id": "plate", "matter": "steel", "temperature": "250 °C" },
    { "law": "heat" }],
  "duration": 600, "observe": [{ "quantity": "temperature", "of": "ball" }] } }
```

A glass bead in water while a protein assembles in it: the microscopic run's assembled share becomes the water's yield
and viscosity through the cited relations, and the bead is held once the gel can carry it:

```
{ "model": { "bodies": [{ "id": "bead", "matter": "glass", "radius": "50 µm", "at": [0, 0, 0] }],
  "laws": [{ "law": "gravity-uniform" }, { "law": "buoyancy", "medium": "water", "surface": 1 },
    { "law": "gelling", "medium": "water", "layer": "0.5 mm",
      "from": { "microscopic": { "box": { "size": ["1 µm", "1 µm", "1 µm"] }, "represents": 5,
        "species": [{ "id": "protein", "radius": "2 nm", "count": 120 }],
        "laws": [{ "law": "aggregation", "of": "protein", "nucleus": 2, "nucleate": 2000, "grow": "2e6 /M/s" }], "duration": "30 s" },
        "observe": "aggregated" },
      "relations": [{ "relation": "percolation", "top": "20 Pa", "onset": 0.2 }, { "relation": "krieger-dougherty", "phi": 0.3 }] }],
  "duration": 30 } }
```

A sedan rolling into a crate on a concrete road (the car's mass and size are its tables', the crate's matter its class's):

```
{ "model": { "bodies": [
    { "id": "car", "as": { "vehicle": "sedan" }, "at": [-8, 0, 2.71], "v": [10, 0, 0], "on_plane": "road" },
    { "id": "crate", "as": { "part": "crate", "size": [0.8, 0.8, 0.8] }, "at": [0, 0, 0.7], "on_plane": "road" }],
  "laws": [{ "law": "gravity-uniform" }, { "law": "plane", "id": "road", "mu": 0.6, "matter": "concrete" }, { "law": "collision" }],
  "duration": 4 } }
```

<!-- laws:begin (generated from the law tables: node scripts/science-cards.mjs) -->

## The laws

### `gravity-uniform`

Uniform gravity: every body is pulled down (−z) with acceleration g (the frame's g unless given).

- Names its bodies with `on?: [ids]` (default: every body it can act on).
- Takes `g` (m/s²; optional).
- Leaves out: g is the same at every height (no inverse-square fall-off near the ground).
- Smallest example: `{"bodies":[{"id":"ball","mass":0.45,"radius":0.11,"at":[0,0,1],"v":[8,0,8]}],"laws":[{"law":"gravity-uniform"}],"duration":1.6}`

### `gravity-newton`

Newton's universal gravitation between every pair: F = G·m₁·m₂ / r², along the line between them.

- Names its bodies with `among?: [ids]` (default: every body it can act on).
- Takes `G` (a number, SI; default 6.6743e-11).
- Leaves out: Bodies attract as point masses (exact for uniform spheres); no relativity.
- Smallest example: `{"bodies":[{"id":"sun","mass":1000000000000,"at":[0,0,0]},{"id":"moon","mass":1,"at":[10,0,0],"v":[0,2.5,0]}],"laws":[{"law":"gravity-newton"}],"duration":50}`

### `spring`

A spring between two bodies, or a body and a fixed point: F = −k·(stretch) − damping·(stretching speed).

- Names its bodies with `between: [id, id]` or `[id, [x, y, z]]` (a fixed point).
- Takes `k` (N/m; required), `rest` (m; optional), `damping` (N·s/m; default 0).
- Leaves out: The spring is massless and obeys Hooke's law at every stretch.
- Smallest example: `{"bodies":[{"id":"mass","mass":0.5,"radius":0.05,"at":[0.3,0,0]}],"laws":[{"law":"spring","between":["mass",[0,0,0]],"k":20,"rest":0.2}],"duration":3}`

### `rod`

A rigid rod holding two bodies (or a body and a fixed pivot) at a fixed distance: a pendulum, a dumbbell.

- Names its bodies with `between: [id, id]` or `[id, [x, y, z]]` (a fixed point).
- Takes `length` (m; optional).
- Leaves out: The rod is massless and perfectly rigid; the pivot has no friction.
- Smallest example: `{"bodies":[{"id":"bob","mass":1,"radius":0.05,"at":[0.49999999999999994,0,0.1339745962155613]}],"laws":[{"law":"gravity-uniform"},{"law":"rod","between":["bob",[0,0,1]]}],"duration":4}`

### `rope`

A rope: like a rod while taut, but it only pulls; shorter than its length it goes slack.

- Names its bodies with `between: [id, id]` or `[id, [x, y, z]]` (a fixed point).
- Takes `length` (m; optional).
- Leaves out: The rope is massless and inextensible; when it snaps taut the jerk is perfectly inelastic along the rope.
- Smallest example: `{"bodies":[{"id":"weight","mass":2,"radius":0.08,"at":[0.5,0,1]}],"laws":[{"law":"gravity-uniform"},{"law":"rope","between":["weight",[0,0,1]],"length":1}],"duration":3}`

### `drag-linear`

Drag proportional to speed: F = −b·(v − wind). Give b, or a fluid viscosity for Stokes' law b = 6πηr.

- Names its bodies with `on?: [ids]` (default: every body it can act on).
- Takes `b` (N·s/m; optional), `viscosity` (Pa·s; optional), `medium` (a liquid or gas from rupa's matter table: 'water', 'air', 'honey', …; optional), `wind` ([x, y, z] in m/s; default [0, 0, 0]).
- Leaves out: Slow, smooth (viscous) flow: drag grows with speed, not its square.
- Smallest example: `{"bodies":[{"id":"bead","mass":0.01,"radius":0.005,"at":[0,0,1]}],"laws":[{"law":"gravity-uniform"},{"law":"drag-linear","b":0.05}],"duration":2}`

### `drag-quadratic`

Air drag: F = −½·ρ·Cd·A·|v − wind|·(v − wind). A defaults to the body's cross-section πr²; ρ to sea-level air.

- Names its bodies with `on?: [ids]` (default: every body it can act on).
- Takes `cd` (a number; default 0.47), `rho` (kg/m³; default 1.225), `medium` (a liquid or gas from rupa's matter table: 'water', 'air', 'honey', …; optional), `area` (m²; optional), `wind` ([x, y, z] in m/s; default [0, 0, 0]).
- Leaves out: The drag coefficient is constant with speed (no drag crisis); the body does not spin.
- Smallest example: `{"bodies":[{"id":"ball","mass":0.06,"radius":0.033,"at":[0,0,50]}],"laws":[{"law":"gravity-uniform"},{"law":"drag-quadratic"}],"duration":4}`

### `buoyancy`

Archimedes: a fluid below height `surface` pushes a sphere up with the weight of the fluid it displaces (the sunk cap's volume).

- Names its bodies with `on?: [ids]` (default: every body it can act on).
- Takes `rho` (kg/m³; default 1000), `medium` (a liquid or gas from rupa's matter table: 'water', 'air', 'honey', …; optional), `surface` (m; default 0).
- Leaves out: The fluid is still and of constant density; the body is a sphere; no added mass, no waves.
- Smallest example: `{"bodies":[{"id":"buoy","mass":2,"radius":0.1,"at":[0,0,0.2]}],"laws":[{"law":"gravity-uniform"},{"law":"buoyancy"}],"duration":3}`

### `coulomb`

Coulomb's law between every pair of charged bodies: F = k·q₁·q₂ / r²; like charges repel, unlike attract.

- Names its bodies with `among?: [ids]` (default: every body it can act on).
- Takes `k` (a number, SI; default 8987551792.3).
- Leaves out: Point charges in a vacuum; nothing radiates; speeds far below light.
- Smallest example: `{"bodies":[{"id":"p","mass":0.001,"radius":0.01,"charge":"1 µC","at":[0,0,0],"fixed":true},{"id":"q","mass":0.001,"radius":0.01,"charge":"-1 µC","at":[0.5,0,0],"v":[0,3.5,0]}],"laws":[{"law":"coulomb"}],"duration":4}`

### `lorentz`

Uniform electric and magnetic fields on charged bodies: F = q·(E + v × B). The magnetic part turns a charge without speeding it up.

- Names its bodies with `on?: [ids]` (default: every body it can act on).
- Takes `E` ([x, y, z] in V/m; default [0, 0, 0]), `B` ([x, y, z] in T; default [0, 0, 0]).
- Leaves out: The fields are uniform and steady; the charge does not radiate; speeds far below light.
- Smallest example: `{"bodies":[{"id":"ion","mass":0.000001,"charge":"1 µC","at":[0,0,0],"v":[1,0,0]}],"laws":[{"law":"lorentz","B":[0,0,1]}],"duration":15}`

### `plane`

A rigid flat surface through `point`: a floor (default), a wall (`normal`), or a ramp (`tilt` an angle, sloping down along `downhill`). Bodies bounce with restitution e, rest on it, and slide with friction μ (static μs, default μ).

- Names its bodies with `id?` (bodies sit on it with `on_plane`), `on?: [ids]`.
- Takes `point` ([x, y, z] in m; default [0, 0, 0]), `normal` (a number; optional), `tilt` (an angle: rad, or '30 deg'; optional), `downhill` (a number; default [1, 0, 0]), `e` (a number; default 1), `mu` (a number; default 0), `mus` (a number; optional), `matter` (a solid from rupa's matter table: 'steel', 'glass', 'concrete', …; optional), `temperature` (a temperature: K, or '20 °C'; optional).
- Leaves out: The surface is rigid and flat; bodies slide, they do not roll; elastic and frictionless unless e and μ say otherwise.
- Smallest example: `{"bodies":[{"id":"block","mass":1,"radius":0.05,"at":[0,0,0],"on_plane":"ramp"}],"laws":[{"law":"gravity-uniform"},{"law":"plane","id":"ramp","tilt":"30 deg","mu":0.2}],"duration":2}`

### `collision`

Spheres that touch exchange an impulse along the line of centres with restitution e: 1 bounces with no loss, 0 sticks.

- Names its bodies with `among?: [ids]` (default: every body it can act on).
- Takes `e` (a number; default 1).
- Leaves out: Contacts are instantaneous; spheres are smooth and do not spin.
- Smallest example: `{"bodies":[{"id":"a","mass":1,"radius":0.1,"at":[-1,0,0],"v":[2,0,0]},{"id":"b","mass":2,"radius":0.1,"at":[1,0,0]}],"laws":[{"law":"collision","e":0.5}],"duration":2}`

### `gelling`

A liquid that sets: the bodies in it are dragged by its viscosity (Stokes, 6πηr·v) and held once its yield stress carries them (a sphere stays put while the net force on it is under τy·π·D² / (6 × 0.048), Beris et al. 1985). `curve` moves both along the run: [{ at, viscosity?, yield? }]. A `layer` of it, that thick, on a surface tilted by `slope` flows as a Bingham film and holds once its yield passes ρ·g·h·sin(slope).

- Names its bodies with `on?: [ids]` (default: every body it can act on).
- Takes `medium` (a liquid or gas from rupa's matter table: 'water', 'air', 'honey', …; required), `curve` (`[{ at, viscosity?, yield? }]` along the run, each point keeping what it does not say; optional: the medium's own, all along), `from` (`{ microscopic: <model>, observe: 'aggregated' }`: read the curve from a microscopic run's assembled share, through `relations`; optional), `relations` (`[{ relation: 'percolation', top, onset? }, { relation: 'krieger-dougherty', phi }]`: the cited rows that turn the share into a yield and a viscosity; with `from`), `layer` (m; optional), `slope` (an angle: rad, or '30 deg'; default 90 deg).
- Leaves out: The liquid is uniform and still, and sets everywhere at once along its curve (no temperature or mixing in it); its yield resists a moving body like dry friction of the same capacity that holds it still (the drag of a yield-stress liquid on a moving sphere is more involved); a layer is wide and even, its flow the film's steady one.
- Smallest example: `{"bodies":[{"id":"ball","matter":"steel","radius":"2 mm","at":[0,0,0]}],"laws":[{"law":"gravity-uniform"},{"law":"buoyancy","medium":"honey","surface":1},{"law":"gelling","medium":"honey","curve":[{"at":"20 s","viscosity":200,"yield":100}],"layer":"5 mm"}],"duration":20}`

### `magnus`

Magnus lift on a spinning ball: F = ½·cl·ρ·π·r³·ω × (v − wind), the lift coefficient growing with the spin ratio (C_L = cl·r·ω / |v − wind|). Topspin dips a ball, backspin floats it, sidespin curves it.

- Names its bodies with `on?: [ids]` (default: every body it can act on).
- Takes `rho` (kg/m³; default 1.225), `medium` (a liquid or gas from rupa's matter table: 'water', 'air', 'honey', …; optional), `cl` (a number, SI; default 1), `wind` ([x, y, z] in m/s; default [0, 0, 0]).
- Leaves out: The lift grows in step with the spin ratio (the low-spin regime; cl is the slope, near 1 for a smooth ball); the air does not slow the spin; the ball is a sphere.
- Smallest example: `{"bodies":[{"id":"ball","mass":0.43,"radius":0.11,"at":[0,0,0.11],"v":[25,0,6],"spin":[0,0,"8 rev/s"]}],"laws":[{"law":"gravity-uniform"},{"law":"drag-quadratic","cd":0.25},{"law":"magnus"}],"duration":1.2}`

### `heat`

Heat: each body with a matter holds one temperature, moved by its heat (mass × specific heat, the latent heat taken at its melting point). It trades heat with the medium by convection (h), with the surroundings by radiation (εσT⁴), and by conduction through a contact spot with the bodies and the planes with matter it touches.

- Names its bodies with `on?: [ids]` (default: every body it can act on).
- Takes `ambient` (a temperature: K, or '20 °C'; default 20 °C), `medium` (a liquid or gas from rupa's matter table: 'water', 'air', 'honey', …; optional), `h` (W/(m²·K); optional), `radiation` (true or false; default true), `contact` (m; default 0.001).
- Leaves out: Each body is one temperature throughout (lumped: the Biot gate says when that is wrong); the medium and the surroundings stay at `ambient`, and a plane at its own; motion makes no heat (no friction or impact heating); a melted body keeps its shape and its motion.
- Smallest example: `{"bodies":[{"id":"ball","matter":"steel","radius":"2 cm","at":[0,0,0],"fixed":true,"temperature":"200 °C"}],"laws":[{"law":"heat"}],"duration":600}`

## Textbook answers the solver checks itself against

When a model is exactly one of these setups, the run is measured and compared with the closed form; the result is a gate.

- `ballistic`: apex h = v↑²/2g and range R = 2·v↑·v→/g, within 0.1%.
- `harmonic`: period T = 2π·√(m/k), within 0.1%.
- `pendulum`: period T = 4·√(L/g)·K(sin(θ₀/2)) at any amplitude, within 0.1%.
- `kepler`: period T = 2π·√(a³/μ), a from the orbit's energy, within 0.1%.
- `cyclotron`: period T = 2π·m/(|q|·B) and radius r = m·v⊥/(|q|·B), within 0.1%.
- `terminal`: terminal speed m·g/b (linear drag) or √(m·g/(½ρCdA)) (quadratic), within 0.1%.
- `viscometer`: a ball falling through a liquid that does not set, wholly under its surface, reaches Stokes's speed (m − ρ·V)·g / 6πηr, within 0.1%.
- `incline`: slide distance s = ½·g·(sin α − μ·cos α)·t² from rest (0 when μs ≥ tan α), within 0.1%.
- `rolling`: a sphere rolling from rest down a ramp: s = ½·g·sin α·t² / (1 + I/m·r²) (5/7 of the slide for a solid ball) while static friction holds it (μs ≥ tan α · I/(I + m·r²)), within 0.1%.
- `collision`: head-on final speeds v₁′, v₂′ from momentum and restitution e, within 0.1%.
- `cooling`: a body that loses heat by convection alone, touching nothing, follows Newton's cooling: T − T∞ = (T₀ − T∞)·e^(−h·A·t / m·c), within one part in a million.
- `bingham-film`: a layer of a setting liquid on its slope flows as a Bingham film: its flux, the velocity profile integrated, is ρ·g·sinθ·h³/3η·(1 − 3ζ/2 + ζ³/2), and none once the yield passes ρ·g·h·sinθ, within a millionth of its flow with no yield.

<!-- laws:end -->
