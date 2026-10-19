---
{
  "id": "microscopic",
  "name": "Microscopic science world (molecules and cells, composed from laws)",
  "family": "science",
  "entry": "create_view",
  "summary": "Compose a demo at the scale of cells and molecules from a table of laws (Brownian motion, drift, membranes, reactions in a well-mixed volume) instead of picking a ready-made one; seeded and counted, checked against Einstein's diffusion law, mass-action equilibrium and conservation, and the page says what is real and what is drawn.",
  "when": "Reach for this when a teacher or student wants to see molecules move and react: 'show diffusion of a dye in water', 'why does sugar spread out', 'a membrane that lets water through but not salt', 'how an enzyme turns substrate into product', 'binding and unbinding reach equilibrium', 'Brownian motion of a bead under a microscope', 'particles drifting in a flow'. Microscopic means bounded by these laws, from cells down to molecules: a molecule's insides (bonds, electrons) are the quantum scale's, and a ball rolling is the classical scale's."
}
---

A microscopic science world is a demo **composed** from a closed table of laws at the scale of cells and molecules.
You write the model (a box, the species in it, the laws acting on them, how long to run); the solver checks every
quantity's units, takes seeded random steps, draws reactions exactly by Gillespie's algorithm on the counts, and
examines the run. The page plays it: every shown molecule a sphere walking its recorded path, the box a frame, a
membrane a lattice, the counts per species in the readout, and a **What's real · what's drawn** panel.

Use a ready-made kind when it already is the demo (the `cellular` kind's organelles, the `dna` helix, `dna-process`
for meiosis, `energy-cycle` for photosynthesis and respiration). Compose a microscopic world when molecules have to
move, cross or react.

## The recipe

```
params: {
  model:     { box, species, laws, duration, temperature?, viscosity?, represents?, observe?, dt?, seed? },
  dress?:    { … },
  liberties?: [{ what, why }],
}
```

The **model** is examined; the **dress** only sells the picture and never reaches the solver; anything drawn rather
than real is a liberty the page shows.

### Units

A bare number is SI. A string or pair carries its unit and is checked: `'10 µm'`, `'0.38 nm'`, `'310 K'`,
`'0.89 mPa·s'`, `'600 µm²/s'`, `'5 mM'`, `'2 /s'`, `'1e6 /M/s'`, `'20 µm/s'`, `'2 pN'`.

### The model

- `box` — `{ size: [x, y, z], walls?: 'reflect' | 'periodic' }`, centred on the origin. Reflecting walls hold the
  molecules in (a cell, a cuvette); periodic walls stand for a region inside a larger fluid.
- `temperature` (default body temperature, 310.15 K) and `viscosity` (default water at 37 °C, 0.69 mPa·s) set
  every species' diffusion by Stokes–Einstein, D = kT / 6πηr.
- `species` — `[{ id, radius, D?, count | concentration, where?, mass? }]`. `D` overrides Stokes–Einstein with a
  measured value. `concentration` (`'5 mM'`) becomes a count for the box. `where`: `'everywhere'` (default),
  `'left'` / `'right'` of the first membrane, `'center'`, or `{ from: [x, y, z], to: [x, y, z] }`.
- `represents` (default 1) — each sphere stands for this many molecules. A real cell holds far too many to draw: a
  1 µm cube at 1 mM holds about 600,000 of one kind. With `represents`, concentrations and mean rates are real and
  the random ups and downs are larger (the page says by how much). At most 2,000 spheres; at most 300 are drawn.
- `laws` — `[{ law: '<id>', … }]`, from the table below. A law id the table does not have is a **gap** that names
  the scale that owns it, or what to compose instead (an enzyme is reaction rows), and the rest still runs.
- `observe` — `'counts'` (default), `'events'`, or `{ quantity, of: '<species>' }` for `'concentration'`,
  `'diffusion'` (the D in play and where it came from) and `'sides'` (how many are on the near side of the first
  membrane).
- `duration` — how long the model runs. `seed` (default 1) picks which of the sound runs it is; `dt` overrides the
  solver's step.

### What the solver checks (the machine gate)

Every mint returns its gates, each `{ id, want, ok, value, detail }`. They advise; none refuse. Statistical checks
allow four to five standard errors, so a sound run passes for any seed.

- `closed-form:diffusion` — the cloud's spread grows as 6·D·t (Einstein), measured while the molecules are far
  from the walls.
- `closed-form:drift` — the mean displacement is v·t.
- `closed-form:equilibrium` — when every reaction runs both ways, the settled mixture sits at
  [products] / [reactants] = k_forward / k_back.
- `closed-form:membrane:<species>` — a species that crosses evens out in proportion to the volumes on each side;
  `membrane-holds:<species>` — one that cannot cross never does.
- `moieties-conserved` — what no reaction can change (the enzyme's total, the atoms) stays exactly as it began.
- `dt-resolves`, `membrane-step` — the step resolves the walls, the membrane and its permeability.
- `well-mixed` — molecules cross the box faster than they react, so counting stands for the whole volume.
- `overdamped-regime`, `molecular-regime`, `low-reynolds` — the model is still at this scale (inertia gone, nothing
  smaller than an atom, no wakes).

## The dress (the interactive page)

- `species` — `{ <id>: { color: '#rrggbb', label: 'text' } }`; the label is what the readout calls it.
- `trails` (default false) — each shown molecule's path as a faint line.
- `hud`, `camera` (default `'angle'`), `background`, `playback` — as the classical world's.
- `film` — the film dress, as the classical world's (`callouts` on the model's clock, without `on`; `replay`;
  `end_card`). The proposed film replays the first reaction slowed down, when there is one.

The drawing declares its own liberties: the magnification, molecules drawn far larger than they are, the share of
molecules drawn when there are many, and the time rate.

## Reading the numbers back

The measuring tool reads a microscopic world at tier `si`: every species' count, its count on the near side of each
membrane and its spread, from the same seeded run the page plays, with the gates beside them.

## Worked examples

A bead jiggling under a microscope (the spread grows as 6·D·t, D from Stokes–Einstein):

```
{ "model": { "box": { "size": ["20 µm", "20 µm", "20 µm"] },
  "species": [{ "id": "bead", "radius": "0.5 µm", "count": 120, "where": "center" }],
  "laws": [{ "law": "brownian" }], "duration": "20 s", "observe": ["counts", { "quantity": "diffusion", "of": "bead" }] } }
```

A membrane that lets water through and holds sugar back:

```
{ "model": { "box": { "size": ["20 µm", "10 µm", "10 µm"] },
  "species": [{ "id": "water", "radius": "0.14 nm", "count": 150, "where": "left" }, { "id": "sugar", "radius": "0.5 nm", "count": 150, "where": "left" }],
  "laws": [{ "law": "brownian" }, { "law": "membrane", "permeability": { "water": "100 µm/s" } }],
  "duration": "0.3 s", "observe": ["counts", { "quantity": "sides", "of": "water" }] } }
```

An enzyme turning substrate into product (E + S ⇌ ES → E + P, composed from two reaction rows):

```
{ "model": { "box": { "size": ["1 µm", "1 µm", "1 µm"] },
  "species": [{ "id": "E", "radius": "3 nm", "count": 20 }, { "id": "S", "radius": "0.5 nm", "count": 300 },
    { "id": "ES", "radius": "3.2 nm", "count": 0 }, { "id": "P", "radius": "0.5 nm", "count": 0 }],
  "laws": [{ "law": "brownian" },
    { "law": "reaction", "from": ["E", "S"], "to": ["ES"], "rate": "1e8 /M/s", "reverse": "100 /s" },
    { "law": "reaction", "from": ["ES"], "to": ["E", "P"], "rate": "50 /s" }],
  "duration": "0.6 s", "observe": ["counts", { "quantity": "concentration", "of": "S" }] } }
```

<!-- laws:begin (generated from the law tables: node scripts/science-cards.mjs) -->

## The laws

### `brownian`

Brownian motion: every molecule takes random steps, spreading with diffusion coefficient D (its own, or Stokes–Einstein's kT / 6πηr from its radius, the temperature and the medium's viscosity).

- Leaves out: Overdamped: a molecule's inertia is gone within nanoseconds, so it moves by random steps alone; the medium is a uniform fluid.
- Smallest example: `{"box":{"size":["20 µm","20 µm","20 µm"]},"species":[{"id":"bead","radius":"0.5 µm","count":120,"where":"center"}],"laws":[{"law":"brownian"}],"duration":"20 s"}`

### `drift`

A steady drift on top of the random steps: a flow carrying molecules at `velocity`, or a `force` on each (gravity, a field), which moves it at v = F·D / kT.

- Takes `velocity` ([x, y, z] in m/s (e.g. '1 µm/s'); optional), `force` ([x, y, z] in N (e.g. '2 pN'); optional).
- Leaves out: The drift is uniform and steady; at this scale a force sets a speed, not an acceleration.
- Smallest example: `{"box":{"size":["40 µm","20 µm","20 µm"],"walls":"periodic"},"species":[{"id":"bead","radius":"0.5 µm","count":120,"where":"center"}],"laws":[{"law":"brownian"},{"law":"drift","velocity":["1 µm/s",0,0]}],"duration":"10 s"}`

### `membrane`

A membrane across the box (a plane on `axis` at `at`, default the middle) that each species crosses with its own permeability P; a species it does not list cannot cross.

- Takes `axis` ('x', 'y' or 'z'; default x), `at` (m; optional), `permeability` ({ <species>: m/s (e.g. '1 µm/s') }; optional).
- Leaves out: The membrane is a flat, infinitely thin sheet; crossing is a probability per hit set by P (no channels, pumps or binding).
- Smallest example: `{"box":{"size":["20 µm","10 µm","10 µm"]},"species":[{"id":"water","radius":"0.14 nm","count":150,"where":"left"},{"id":"sugar","radius":"0.5 nm","count":150,"where":"left"}],"laws":[{"law":"brownian"},{"law":"membrane","permeability":{"water":"100 µm/s"}}],"duration":"0.3 s"}`

### `reaction`

A reaction by mass action: `from` (one or two species) becomes `to` (one to three) at `rate` (per second for one reactant, per molar per second for two), with an optional `reverse` rate. Events are drawn exactly by Gillespie's algorithm.

- Takes `from` ([species ids]; required), `to` ([species ids]; required), `rate` (per second (one reactant) or per molar per second (two), e.g. '2 /s', '1e6 /M/s'; required), `reverse` (per second (one reactant) or per molar per second (two), e.g. '2 /s', '1e6 /M/s'; optional).
- Leaves out: The volume is well mixed: a reaction's odds depend on how many molecules there are, not on where they are (the well-mixed gate checks it).
- Smallest example: `{"box":{"size":["1 µm","1 µm","1 µm"]},"species":[{"id":"A","radius":"2 nm","count":120},{"id":"B","radius":"2 nm","count":0}],"laws":[{"law":"brownian"},{"law":"reaction","from":["A"],"to":["B"],"rate":"2 /s","reverse":"1 /s"}],"duration":"3 s"}`

<!-- laws:end -->
