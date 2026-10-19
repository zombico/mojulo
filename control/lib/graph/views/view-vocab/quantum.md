---
{
  "id": "quantum",
  "name": "Quantum science world (states and their rules, composed from laws)",
  "family": "science",
  "entry": "create_view",
  "summary": "Compose a quantum demo from a table of laws (a particle on a line in wells, barriers and steps; the hydrogen atom's orbitals; spin through Stern–Gerlach magnets; radioactive decay) instead of picking a ready-made one: solved exactly or by a unitary stepper, checked against the textbook formulas, every row sourced and dated, and the page says what is the model and what is a picture.",
  "when": "Reach for this when a teacher or student wants to see a quantum idea worked: 'tunnelling through a barrier', 'a particle in a box and its energy levels', 'what do the hydrogen orbitals look like', 'the 2p and 3d orbitals side by side', 'why a measurement changes the spin', 'Stern–Gerlach with three magnets', 'radioactive decay and half-life', 'a wave packet spreading out', 'zero-point energy of an oscillator'. It supersedes the curated `atom` kind for orbitals: those are exact here and checked. Molecules moving and reacting are the microscopic scale's; a ball on a spring is the classical scale's."
}
---

A quantum science world is a demo **composed** from a closed table of laws. Its stance: **faithful to the model,
claiming nothing about reality.** The mathematics of each row is exact (the norm, the nodes, the energy levels, the
odds of an outcome) and is checked; what is drawn of it is a picture (a cloud of samples, a coloured sign, a beam's
path), and the page says which is which. Every row carries its sources and the date it was last reviewed, and the
page shows them.

A world is one **system**, and every law in it belongs to that system:

| System | What it is | How it runs |
|---|---|---|
| `line` | a particle on a line, ψ(x, t) under the Schrödinger equation, its potential the sum of the line's rows | Crank–Nicolson (unitary); levels by exact diagonalization |
| `atom` | the hydrogen atom's orbitals ψ_nlm, side by side | exact radial and angular functions; clouds sampled from \|ψ\|² |
| `spin` | spin-½ atoms through a chain of Stern–Gerlach magnets | each outcome drawn with its odds, cos²(θ/2), seeded |
| `decay` | unstable nuclei with a half-life | each decay moment drawn from the exponential law, seeded |

Use a ready-made kind when it already is the demo (`double-slit`, `wavepacket`, `fission`, `fusion`). The curated
`atom` kind still renders many-electron atoms as a picture; for orbitals that are the real functions, use this.

## The recipe

```
params: {
  model:      { system, laws, state, … },
  dress?:     { … },
  liberties?: [{ what, why }],
}
```

The **model** is examined; the **dress** only sells the picture and never reaches the solver; anything drawn rather
than real is a liberty the page shows.

### Units

A bare number is SI. A string or pair carries its unit and is checked: `'2 nm'`, `'0.53 Å'`, `'0.2 eV'`,
`'40 meV'`, `'120 fs'`, `'5730 yr'`.

### The model, per system

- `line` — `{ system: 'line', line: { length, points?, particle? }, laws, state, duration, dt? }`. The line is
  centred on the origin with hard walls at its ends; `points` (128 to 4096, default 1024) sets the grid;
  `particle` is `'electron'` (default), `'proton'`, `'neutron'` or `{ mass }`. `laws` are the potential's rows
  (none is a free particle). `state` is either `{ packet: { at, width, energy?, direction? } }` (a Gaussian packet
  moving `'right'` (default) or `'left'` with that mean energy) or `{ superpose: [{ n, weight?, phase? }] }` (the
  line's own levels, 1 the lowest).
- `atom` — `{ system: 'atom', laws: [{ law: 'hydrogen' }], state: { orbitals: [{ n, l, m }] }, samples? }`. One to
  six orbitals (n up to 7, 0 ≤ l < n, |m| ≤ l; the real forms a chemistry book draws: m = 1 is p_x, −1 is p_y);
  `samples` points per orbital (200 to 4000, default 1500).
- `spin` — `{ system: 'spin', laws: [stern-gerlach …], state: { along }, atoms? }`. The atoms leave pointing
  `along` (`'x'`, `'-z'` …, or `{ theta, phi }` in radians) and meet the magnets in order; `atoms` 10 to 2000.
- `decay` — `{ system: 'decay', laws: [{ law: 'decay', half_life }], state: { nuclei }, duration }`, 10 to 3000
  nuclei.

Every system takes `seed` (default 1: which of the sound runs it is) and `observe`. A law id the table does not
have is a **gap** naming the row that is (tunnelling is the barrier row), the scale that owns it (diffusion is
microscopic), or why there is none yet (bonds need more than one electron), and the rest still runs.

### What the solver checks (the machine gate)

Every mint returns its gates, each `{ id, want, ok, value, detail }`. They advise; none refuse. Sampled checks
allow five standard errors, so a sound run passes for any seed.

- `norm-held`, `energy-held` — a line's total probability and energy stay as they began (the stepper is unitary).
- `grid-resolves`, `edges-quiet` — the grid has ten points per shortest wavelength; the state stays clear of the
  line's walls.
- `closed-form:levels` — a well's or an oscillator's levels against n²π²ħ²/2ma² or (n + ½)ħω.
- `closed-form:transmission` — the share that passes a barrier or step against the textbook transmission averaged
  over the packet's momenta.
- `closed-form:ehrenfest`, `closed-form:spreading`, `closed-form:beat` — a displaced packet swings like a
  classical mass; a free packet spreads as σ₀·√(1 + (ħt/2mσ₀²)²); two levels beat at h / (E₂ − E₁).
- `quantum-regime` — the waves are not tiny next to the potential's features (else a classical world would do).
- `radial-nodes:<orbital>`, `normalized:<orbital>`, `closed-form:mean-radius:<orbital>`, `cloud-honest:<orbital>` —
  n − l − 1 radial nodes, an integral of one, the cloud's mean radius against (a₀/2)(3n² − l(l+1)), and a χ² that
  the drawn points follow |ψ|².
- `closed-form:odds:<k>` — each magnet's up count against its odds.
- `closed-form:half-life`, `counts-follow` — the half-life measured from the decays, and the nuclei left at every
  moment against N₀·2^(−t/T).

## The dress (the interactive page)

- `phase` (line, default false) — draw Re ψ beside |ψ|², to see the phase turn.
- `hud`, `camera` (`'side'`, `'angle'` or `'top'`), `background`, `playback` — as the classical world's.
- `film` — the film dress, as the classical world's (`callouts` on the model's clock, `end_card`). A line, spin or
  decay world's proposed film is the run and its end card; an atom's circles the clouds.

The drawing declares its own liberties: the magnification, the potential and |ψ|² on one picture, a cloud as
samples, the sign as colour, the nucleus far larger than it is, the beams' paths, the share drawn of many atoms or
nuclei, and the time rate.

## Reading the numbers back

The measuring tool reads a quantum world at tier `si`, per system, from the same run the page plays: a line's
⟨x⟩, spread, ⟨E⟩ (eV), total probability and the share past its barrier, with its levels; each orbital's exact
energy and mean radius beside what its cloud measures, and the sampled points; each magnet's counts beside their
odds; the nuclei left over time. The rows' sources and review date come with them.

## Worked examples

Tunnelling: an electron at 0.2 eV meets a barrier 0.3 eV high and 1 nm wide, and about 15% gets through:

```
{ "model": { "system": "line", "line": { "length": "100 nm", "points": 2048 },
  "laws": [{ "law": "barrier", "height": "0.3 eV", "width": "1 nm" }],
  "state": { "packet": { "at": "-10 nm", "width": "2.5 nm", "energy": "0.2 eV" } }, "duration": "120 fs" } }
```

A particle in a box in two levels at once: the density sloshes at h / (E₂ − E₁):

```
{ "model": { "system": "line", "line": { "length": "4 nm" }, "laws": [{ "law": "well", "width": "2 nm" }],
  "state": { "superpose": [{ "n": 1 }, { "n": 2 }] }, "duration": "30 fs" } }
```

Three hydrogen orbitals side by side (1s, 2s with its radial node, 3d_z²):

```
{ "model": { "system": "atom", "laws": [{ "law": "hydrogen" }],
  "state": { "orbitals": [{ "n": 1, "l": 0, "m": 0 }, { "n": 2, "l": 0, "m": 0 }, { "n": 3, "l": 2, "m": 0 }] } } }
```

A measurement resets the spin: keep z-up, measure x, then z again, and half come out down:

```
{ "model": { "system": "spin", "state": { "along": "z" }, "atoms": 600,
  "laws": [{ "law": "stern-gerlach", "axis": "z", "keep": "up" }, { "law": "stern-gerlach", "axis": "x", "keep": "up" },
    { "law": "stern-gerlach", "axis": "z" }] } }
```

Carbon-14's half-life over 20,000 years:

```
{ "model": { "system": "decay", "laws": [{ "law": "decay", "half_life": "5730 yr" }], "state": { "nuclei": 1000 },
  "duration": "20000 yr" } }
```

<!-- laws:begin (generated from the law tables: node scripts/science-cards.mjs) -->

## The laws

### The line system

#### `well`

An infinite square well of `width`: the particle cannot be outside it. Its allowed energies are n²π²ħ² / 2ma².

- Takes `width` (a length, e.g. '0.6 nm'; required), `center` (a length, e.g. '0.6 nm'; default 0).
- Leaves out: The walls are infinitely high and perfectly sharp (drawn as a very high step).
- Sources: Griffiths & Schroeter, Introduction to Quantum Mechanics, 3rd ed. (2018), §2.2; CODATA 2018 recommended values (NIST) (reviewed 2026-10-19).
- Smallest example: `{"system":"line","line":{"length":"4 nm"},"laws":[{"law":"well","width":"2 nm"}],"state":{"superpose":[{"n":1,"weight":1},{"n":2,"weight":1}]},"duration":"20 fs"}`

#### `harmonic`

A harmonic well, V = ½mω²x², named by its level spacing ħω (`energy`). Its allowed energies are (n + ½)ħω, and a displaced packet's centre swings back and forth like a classical mass.

- Takes `energy` (an energy, e.g. '0.2 eV'; required), `center` (a length, e.g. '0.6 nm'; default 0).
- Leaves out: The well is a perfect parabola everywhere (a real bond softens far from its bottom).
- Sources: Griffiths & Schroeter, Introduction to Quantum Mechanics, 3rd ed. (2018), §2.3; CODATA 2018 recommended values (NIST) (reviewed 2026-10-19).
- Smallest example: `{"system":"line","line":{"length":"12 nm"},"laws":[{"law":"harmonic","energy":"0.1 eV"}],"state":{"packet":{"at":"1 nm","width":"0.6 nm"}},"duration":"80 fs"}`

#### `barrier`

A rectangular barrier `height` high and `width` wide. A wave packet striking it partly reflects and partly tunnels through, even below the top, with the transmission the textbook formula gives for each energy.

- Takes `height` (an energy, e.g. '0.2 eV'; required), `width` (a length, e.g. '0.6 nm'; required), `center` (a length, e.g. '0.6 nm'; default 0).
- Leaves out: The barrier has perfectly sharp edges and a flat top.
- Sources: Griffiths & Schroeter, Introduction to Quantum Mechanics, 3rd ed. (2018), §2.6 (problem 2.33); CODATA 2018 recommended values (NIST) (reviewed 2026-10-19).
- Smallest example: `{"system":"line","line":{"length":"100 nm","points":2048},"laws":[{"law":"barrier","height":"0.2 eV","width":"0.6 nm"}],"state":{"packet":{"at":"-10 nm","width":"2.5 nm","energy":"0.15 eV"}},"duration":"140 fs"}`

#### `step`

A potential step of `height` from `at` onward: a packet partly reflects even when it has enough energy to climb it.

- Takes `height` (an energy, e.g. '0.2 eV'; required), `at` (a length, e.g. '0.6 nm'; default 0).
- Leaves out: The step is perfectly sharp.
- Sources: Griffiths & Schroeter, Introduction to Quantum Mechanics, 3rd ed. (2018), §2.6 (problem 2.35); CODATA 2018 recommended values (NIST) (reviewed 2026-10-19).
- Smallest example: `{"system":"line","line":{"length":"100 nm","points":2048},"laws":[{"law":"step","height":"0.1 eV","at":0}],"state":{"packet":{"at":"-10 nm","width":"2.5 nm","energy":"0.2 eV"}},"duration":"130 fs"}`

### The atom system

#### `hydrogen`

The hydrogen atom: the electron's exact orbitals ψ_nlm (n ≥ 1, 0 ≤ l < n, |m| ≤ l), with energies −13.6 eV / n². Each is drawn as a cloud of points sampled from |ψ|², coloured by the wavefunction's sign.

- Leaves out: The nucleus is fixed and pointlike; no spin, no fine structure, no relativity.
- Sources: Griffiths & Schroeter, Introduction to Quantum Mechanics, 3rd ed. (2018), §4.2; CODATA 2018 recommended values (NIST) (reviewed 2026-10-19).
- Smallest example: `{"system":"atom","laws":[{"law":"hydrogen"}],"state":{"orbitals":[{"n":2,"l":1,"m":0}]},"samples":1500}`

### The spin system

#### `stern-gerlach`

A Stern–Gerlach magnet measuring a spin-½ along `axis` (x, y, z, or an angle from z toward x): each atom comes out up or down, with odds cos²(θ/2) and sin²(θ/2), and leaves in the state it was found in. `keep` lets only one beam on.

- Takes `axis` ('x', 'y', 'z', '-z' …, or an angle from z toward x; default z), `keep` ('up', 'down' or 'both'; default both).
- Leaves out: Each measurement is ideal and instantaneous; the beams' paths are drawn, only the outcomes and their odds are the model.
- Sources: Griffiths & Schroeter, Introduction to Quantum Mechanics, 3rd ed. (2018), §4.4.1; Gerlach & Stern, Z. Phys. 9, 349 (1922) (reviewed 2026-10-19).
- Smallest example: `{"system":"spin","state":{"along":"x"},"laws":[{"law":"stern-gerlach","axis":"z","keep":"up"},{"law":"stern-gerlach","axis":"x"}],"atoms":300}`

### The decay system

#### `decay`

Unstable nuclei, each decaying at a random moment: none knows when, but half are gone after each `half_life`.

- Takes `half_life` (a time, e.g. '2 s'; required).
- Leaves out: Each nucleus decays independently with a constant chance per moment; the daughter is stable.
- Sources: Rutherford & Soddy, Phil. Mag. 4, 370 (1902); Gamow, Z. Phys. 51, 204 (1928) (reviewed 2026-10-19).
- Smallest example: `{"system":"decay","laws":[{"law":"decay","half_life":"2 s"}],"state":{"nuclei":400},"duration":"8 s"}`

<!-- laws:end -->
